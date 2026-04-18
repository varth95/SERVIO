import os
from flask import Blueprint, request, jsonify, session
from database import get_db
from werkzeug.utils import secure_filename
from utils.notifications import create_notification

verify_bp = Blueprint("verification", __name__)

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), "..", "uploads", "verification")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "mp4", "mov"}


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


@verify_bp.route("/upload/<int:food_id>", methods=["POST"])
def upload_proof(food_id):
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
        return jsonify({"error": "Only the claimer can upload verification proof."}), 403

    image_path = None
    video_path = None

    if "image" in request.files:
        file = request.files["image"]
        if file.filename and allowed_file(file.filename):
            filename = secure_filename(f"proof_img_{food_id}_{file.filename}")
            file.save(os.path.join(UPLOAD_FOLDER, filename))
            image_path = filename

    if "video" in request.files:
        file = request.files["video"]
        if file.filename and allowed_file(file.filename):
            filename = secure_filename(f"proof_vid_{food_id}_{file.filename}")
            file.save(os.path.join(UPLOAD_FOLDER, filename))
            video_path = filename

    notes = request.form.get("notes", "")

    db.execute(
        """INSERT INTO verification (food_id, recipient_id, image_path, video_path, notes)
           VALUES (?, ?, ?, ?, ?)""",
        (food_id, user_id, image_path, video_path, notes),
    )
    db.commit()

    # Notify donor
    create_notification(
        db,
        food["donor_id"],
        f"Verification proof uploaded for food ID {food_id}. Please review.",
        "verification_uploaded",
    )
    db.commit()
    db.close()

    return jsonify({"message": "Verification proof uploaded successfully."}), 201


@verify_bp.route("/<int:food_id>", methods=["GET"])
def get_verification(food_id):
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Authentication required."}), 401

    db = get_db()
    food = db.execute("SELECT * FROM food WHERE id = ?", (food_id,)).fetchone()
    if not food:
        db.close()
        return jsonify({"error": "Food post not found."}), 404

    # Only donor or claimer can view verification
    if food["donor_id"] != user_id and food["claimed_by"] != user_id:
        db.close()
        return jsonify({"error": "Not authorized."}), 403

    verifications = db.execute(
        "SELECT * FROM verification WHERE food_id = ? ORDER BY created_at DESC",
        (food_id,),
    ).fetchall()
    db.close()

    return jsonify([dict(v) for v in verifications]), 200
