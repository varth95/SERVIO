import os
from flask import Blueprint, request, jsonify, session
from database import get_db
from werkzeug.utils import secure_filename
from utils.location import haversine_distance
from utils.notifications import create_notification

food_bp = Blueprint("food", __name__)

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), "..", "uploads", "food")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "mp4", "mov"}


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


@food_bp.route("/post", methods=["POST"])
def post_food():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Authentication required."}), 401

    db = get_db()
    user = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if not user or user["role"] != "donor":
        db.close()
        return jsonify({"error": "Only donors can post food."}), 403

    data = request.form
    org_name = data.get("org_name", "").strip()
    food_type = data.get("food_type", "").strip()
    quantity = data.get("quantity")
    quality = data.get("quality", "").strip()
    expiry_time = data.get("expiry_time", "").strip()
    pickup_address = data.get("pickup_address", "").strip()
    latitude = data.get("latitude") or None
    longitude = data.get("longitude") or None

    if not all([org_name, food_type, quantity, quality, expiry_time, pickup_address]):
        db.close()
        return jsonify({"error": "All fields are required."}), 400

    try:
        quantity = float(quantity)
    except (ValueError, TypeError):
        db.close()
        return jsonify({"error": "Quantity must be a number."}), 400

    if latitude:
        try:
            latitude = float(latitude)
        except ValueError:
            latitude = None
    if longitude:
        try:
            longitude = float(longitude)
        except ValueError:
            longitude = None

    image_path = None
    if "image" in request.files:
        file = request.files["image"]
        if file and file.filename and allowed_file(file.filename):
            filename = secure_filename(f"{user_id}_{file.filename}")
            file.save(os.path.join(UPLOAD_FOLDER, filename))
            image_path = filename

    cursor = db.execute(
        """INSERT INTO food (donor_id, org_name, food_type, quantity, quality, expiry_time,
           pickup_address, latitude, longitude, image_path, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available')""",
        (user_id, org_name, food_type, quantity, quality, expiry_time,
         pickup_address, latitude, longitude, image_path),
    )
    food_id = cursor.lastrowid
    db.commit()

    # Notify nearby recipients/individuals
    _notify_nearby_users(db, food_id, latitude, longitude, quantity)
    db.commit()
    db.close()

    return jsonify({"message": "Food posted successfully.", "food_id": food_id}), 201


def _notify_nearby_users(db, food_id, lat, lon, quantity):
    """Notify nearby recipients and individuals about a new food post."""
    # Large quantities (>5kg) prioritise NGOs; smaller ones also notify individuals
    if quantity > 5:
        roles = ("recipient",)
    else:
        roles = ("recipient", "individual")

    placeholders = ",".join("?" * len(roles))
    users = db.execute(
        f"SELECT id, latitude, longitude FROM users WHERE role IN ({placeholders})",
        roles,
    ).fetchall()

    for u in users:
        if u["latitude"] and u["longitude"] and lat and lon:
            dist = haversine_distance(float(lat), float(lon), float(u["latitude"]), float(u["longitude"]))
            if dist <= 20:  # 20 km radius
                create_notification(
                    db, u["id"],
                    f"New food available nearby ({dist:.1f} km away). Check it out!",
                    "food_posted",
                )
        else:
            create_notification(db, u["id"], "New food has been posted. Check it out!", "food_posted")


@food_bp.route("/list", methods=["GET"])
def list_food():
    status = request.args.get("status", "available")
    db = get_db()
    foods = db.execute(
        """SELECT f.*, u.name as donor_name, u.email as donor_email
           FROM food f JOIN users u ON f.donor_id = u.id
           WHERE f.status = ? ORDER BY f.created_at DESC""",
        (status,),
    ).fetchall()
    db.close()
    return jsonify([dict(f) for f in foods]), 200


@food_bp.route("/my", methods=["GET"])
def my_food():
    """Must be defined before /<int:food_id> to avoid route conflict."""
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Authentication required."}), 401

    db = get_db()
    user = db.execute("SELECT role FROM users WHERE id = ?", (user_id,)).fetchone()
    if not user:
        db.close()
        return jsonify({"error": "User not found."}), 404

    if user["role"] == "donor":
        foods = db.execute(
            "SELECT * FROM food WHERE donor_id = ? ORDER BY created_at DESC", (user_id,)
        ).fetchall()
    else:
        foods = db.execute(
            "SELECT * FROM food WHERE claimed_by = ? ORDER BY created_at DESC", (user_id,)
        ).fetchall()

    db.close()
    return jsonify([dict(f) for f in foods]), 200


@food_bp.route("/<int:food_id>", methods=["GET"])
def get_food(food_id):
    db = get_db()
    food = db.execute(
        """SELECT f.*, u.name as donor_name, u.phone as donor_phone
           FROM food f JOIN users u ON f.donor_id = u.id
           WHERE f.id = ?""",
        (food_id,),
    ).fetchone()
    db.close()
    if not food:
        return jsonify({"error": "Food post not found."}), 404
    return jsonify(dict(food)), 200


@food_bp.route("/<int:food_id>/claim", methods=["POST"])
def claim_food(food_id):
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Authentication required."}), 401

    db = get_db()
    user = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if not user or user["role"] not in ("recipient", "individual"):
        db.close()
        return jsonify({"error": "Only recipients or individuals can claim food."}), 403

    food = db.execute("SELECT * FROM food WHERE id = ?", (food_id,)).fetchone()
    if not food:
        db.close()
        return jsonify({"error": "Food post not found."}), 404
    if food["status"] != "available":
        db.close()
        return jsonify({"error": f"Food is not available (current status: {food['status']})."}), 409

    db.execute(
        "UPDATE food SET status = 'waiting', claimed_by = ? WHERE id = ?",
        (user_id, food_id),
    )
    create_notification(
        db, food["donor_id"],
        f"Your food post has been claimed by {user['name']}. Delivery in progress.",
        "food_claimed",
    )
    db.commit()
    db.close()

    return jsonify({"message": "Food claimed successfully. Status set to waiting."}), 200


@food_bp.route("/<int:food_id>/deliver", methods=["POST"])
def mark_delivered(food_id):
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Authentication required."}), 401

    db = get_db()
    food = db.execute("SELECT * FROM food WHERE id = ?", (food_id,)).fetchone()
    if not food:
        db.close()
        return jsonify({"error": "Food post not found."}), 404

    if food["claimed_by"] != user_id:
        db.close()
        return jsonify({"error": "You did not claim this food."}), 403

    if food["status"] != "waiting":
        db.close()
        return jsonify({"error": "Food must be in 'waiting' status to mark as delivered."}), 409

    db.execute("UPDATE food SET status = 'claimed' WHERE id = ?", (food_id,))
    create_notification(
        db, food["donor_id"],
        "Food has been delivered to the recipient. Please confirm receipt.",
        "delivery_started",
    )
    db.commit()
    db.close()

    return jsonify({"message": "Delivery confirmed. Awaiting donor verification."}), 200


@food_bp.route("/<int:food_id>/received", methods=["POST"])
def mark_received(food_id):
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Authentication required."}), 401

    db = get_db()
    food = db.execute("SELECT * FROM food WHERE id = ?", (food_id,)).fetchone()
    if not food:
        db.close()
        return jsonify({"error": "Food post not found."}), 404

    if food["donor_id"] != user_id:
        db.close()
        return jsonify({"error": "Only the donor can confirm receipt."}), 403

    if food["status"] != "claimed":
        db.close()
        return jsonify({"error": "Food must be in 'claimed' status to confirm receipt."}), 409

    db.execute("UPDATE food SET status = 'delivered' WHERE id = ?", (food_id,))

    if food["claimed_by"]:
        create_notification(
            db, food["claimed_by"],
            "Donor has confirmed food receipt. Thank you for your service!",
            "food_received",
        )
    db.commit()
    db.close()

    return jsonify({"message": "Food marked as delivered. Transaction complete."}), 200


@food_bp.route("/<int:food_id>/expire", methods=["POST"])
def mark_expired(food_id):
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Authentication required."}), 401

    db = get_db()
    food = db.execute("SELECT * FROM food WHERE id = ?", (food_id,)).fetchone()
    if not food:
        db.close()
        return jsonify({"error": "Food post not found."}), 404

    # Donor or claimer can mark as expired
    if food["donor_id"] != user_id and food["claimed_by"] != user_id:
        db.close()
        return jsonify({"error": "Not authorized."}), 403

    db.execute("UPDATE food SET status = 'expired' WHERE id = ?", (food_id,))
    _forward_to_decomposition(db, food)
    db.commit()
    db.close()

    return jsonify({"message": "Food marked as expired and forwarded to decomposition."}), 200


def _forward_to_decomposition(db, food):
    """Find nearest decomposition center and create a request."""
    centers = db.execute(
        "SELECT id, latitude, longitude FROM users WHERE role = 'decomposition'"
    ).fetchall()

    assigned_to = None
    if centers and food["latitude"] and food["longitude"]:
        def dist_key(c):
            if c["latitude"] and c["longitude"]:
                return haversine_distance(
                    float(food["latitude"]), float(food["longitude"]),
                    float(c["latitude"]), float(c["longitude"])
                )
            return float("inf")

        nearest = min(centers, key=dist_key)
        assigned_to = nearest["id"]

    db.execute(
        """INSERT INTO decomposition_requests
           (food_id, requester_id, quantity, food_type, latitude, longitude, address, status, assigned_to)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'assigned', ?)""",
        (food["id"], food["donor_id"], food["quantity"], food["food_type"],
         food["latitude"], food["longitude"], food["pickup_address"], assigned_to),
    )

    if assigned_to:
        create_notification(
            db, assigned_to,
            f"New decomposition request assigned. Food ID: {food['id']}. Please collect.",
            "decomposition_assigned",
        )
