import os
import hashlib
from flask import Blueprint, request, jsonify, session
from database import get_db
from werkzeug.utils import secure_filename

auth_bp = Blueprint("auth", __name__)

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), "..", "uploads", "certificates")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "pdf"}


def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.form
    name = data.get("name", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    role = data.get("role", "").strip()
    phone = data.get("phone", "").strip()
    latitude = data.get("latitude")
    longitude = data.get("longitude")
    address = data.get("address", "").strip()

    if not all([name, email, password, role]):
        return jsonify({"error": "Name, email, password, and role are required."}), 400

    if role not in ("donor", "recipient", "individual"):
        return jsonify({"error": "Invalid role."}), 400

    certificate_path = None
    if role == "donor":
        if "certificate" not in request.files:
            return jsonify({"error": "Donors must upload a business certificate."}), 400
        file = request.files["certificate"]
        if file.filename == "" or not allowed_file(file.filename):
            return jsonify({"error": "Invalid certificate file. Use PNG, JPG, or PDF."}), 400
        filename = secure_filename(f"{email}_{file.filename}")
        file.save(os.path.join(UPLOAD_FOLDER, filename))
        certificate_path = filename

    if role in ("recipient", "individual") and not phone:
        return jsonify({"error": "Phone number is required for recipients and individuals."}), 400

    db = get_db()
    try:
        db.execute(
            """INSERT INTO users (name, email, password, role, phone, latitude, longitude, address, certificate_path)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (name, email, hash_password(password), role, phone, latitude, longitude, address, certificate_path),
        )
        db.commit()
        return jsonify({"message": "Registration successful. Please log in."}), 201
    except Exception as e:
        if "UNIQUE constraint failed" in str(e):
            return jsonify({"error": "Email already registered."}), 409
        return jsonify({"error": str(e)}), 500
    finally:
        db.close()


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "Email and password are required."}), 400

    db = get_db()
    user = db.execute(
        "SELECT * FROM users WHERE email = ? AND password = ?",
        (email, hash_password(password)),
    ).fetchone()
    db.close()

    if not user:
        return jsonify({"error": "Invalid email or password."}), 401

    session["user_id"] = user["id"]
    session["role"] = user["role"]

    return jsonify({
        "message": "Login successful.",
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "role": user["role"],
            "phone": user["phone"],
            "latitude": user["latitude"],
            "longitude": user["longitude"],
            "address": user["address"],
        },
    }), 200


@auth_bp.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"message": "Logged out successfully."}), 200


@auth_bp.route("/me", methods=["GET"])
def me():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Not authenticated."}), 401

    db = get_db()
    user = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    db.close()

    if not user:
        return jsonify({"error": "User not found."}), 404

    return jsonify({
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "role": user["role"],
        "phone": user["phone"],
        "latitude": user["latitude"],
        "longitude": user["longitude"],
        "address": user["address"],
    }), 200
