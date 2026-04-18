from flask import Blueprint, request, jsonify, session
from database import get_db
from utils.location import haversine_distance
from utils.notifications import create_notification

decomp_bp = Blueprint("decomposition", __name__)


@decomp_bp.route("/request", methods=["POST"])
def create_request():
    """Donor directly sends food for composting."""
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Authentication required."}), 401

    db = get_db()
    user = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if not user or user["role"] != "donor":
        db.close()
        return jsonify({"error": "Only donors can create decomposition requests."}), 403

    data = request.get_json()
    quantity = data.get("quantity")
    food_type = data.get("food_type", "")
    latitude = data.get("latitude") or user["latitude"]
    longitude = data.get("longitude") or user["longitude"]
    address = data.get("address") or user["address"]

    if not quantity:
        db.close()
        return jsonify({"error": "Quantity is required."}), 400

    # Find nearest decomposition center
    centers = db.execute(
        "SELECT id, name, latitude, longitude FROM users WHERE role = 'decomposition'"
    ).fetchall()

    assigned_to = None
    nearest_name = None
    if centers and latitude and longitude:
        nearest = min(
            centers,
            key=lambda c: haversine_distance(
                float(latitude), float(longitude),
                c["latitude"] or 0, c["longitude"] or 0
            ) if c["latitude"] else float("inf"),
        )
        assigned_to = nearest["id"]
        nearest_name = nearest["name"]

    cursor = db.execute(
        """INSERT INTO decomposition_requests
           (requester_id, quantity, food_type, latitude, longitude, address, status, assigned_to)
           VALUES (?, ?, ?, ?, ?, ?, 'assigned', ?)""",
        (user_id, quantity, food_type, latitude, longitude, address, assigned_to),
    )
    req_id = cursor.lastrowid
    db.commit()

    if assigned_to:
        create_notification(
            db,
            assigned_to,
            f"New decomposition request #{req_id} from {user['name']}. Please collect.",
            "decomposition_assigned",
        )
        db.commit()

    db.close()
    return jsonify({
        "message": "Decomposition request created.",
        "request_id": req_id,
        "assigned_to": nearest_name or "No center available nearby",
    }), 201


@decomp_bp.route("/requests", methods=["GET"])
def list_requests():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Authentication required."}), 401

    db = get_db()
    user = db.execute("SELECT role FROM users WHERE id = ?", (user_id,)).fetchone()

    if user["role"] == "decomposition":
        requests = db.execute(
            """SELECT dr.*, u.name as requester_name
               FROM decomposition_requests dr
               JOIN users u ON dr.requester_id = u.id
               WHERE dr.assigned_to = ? ORDER BY dr.created_at DESC""",
            (user_id,),
        ).fetchall()
    elif user["role"] == "donor":
        requests = db.execute(
            """SELECT dr.*, u.name as center_name
               FROM decomposition_requests dr
               LEFT JOIN users u ON dr.assigned_to = u.id
               WHERE dr.requester_id = ? ORDER BY dr.created_at DESC""",
            (user_id,),
        ).fetchall()
    else:
        db.close()
        return jsonify({"error": "Not authorized."}), 403

    db.close()
    return jsonify([dict(r) for r in requests]), 200


@decomp_bp.route("/requests/<int:req_id>/collect", methods=["POST"])
def mark_collected(req_id):
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Authentication required."}), 401

    db = get_db()
    user = db.execute("SELECT role FROM users WHERE id = ?", (user_id,)).fetchone()
    if not user or user["role"] != "decomposition":
        db.close()
        return jsonify({"error": "Only decomposition centers can mark as collected."}), 403

    req = db.execute(
        "SELECT * FROM decomposition_requests WHERE id = ? AND assigned_to = ?",
        (req_id, user_id),
    ).fetchone()
    if not req:
        db.close()
        return jsonify({"error": "Request not found or not assigned to you."}), 404

    db.execute(
        "UPDATE decomposition_requests SET status = 'collected' WHERE id = ?", (req_id,)
    )
    db.commit()

    create_notification(
        db,
        req["requester_id"],
        f"Your decomposition request #{req_id} has been collected. Thank you!",
        "decomposition_collected",
    )
    db.commit()
    db.close()

    return jsonify({"message": "Marked as collected."}), 200
