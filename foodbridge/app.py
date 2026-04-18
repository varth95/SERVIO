import os
import sys
from flask import Flask, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv

# Load .env from project root (one level up from foodbridge/)
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

# Ensure the foodbridge directory is on sys.path so relative imports work
# when running as: python foodbridge/app.py from the project root
sys.path.insert(0, os.path.dirname(__file__))

from database import init_db
from routes.auth import auth_bp
from routes.food import food_bp
from routes.notifications import notif_bp
from routes.verification import verify_bp
from routes.decomposition import decomp_bp
from routes.ai_assistant import ai_bp

# Absolute path to the frontend folder
FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))

app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path="")

# Secret key — use env var in production
app.secret_key = os.environ.get("SECRET_KEY", "servio_dev_secret_key_2024")

# Session cookie settings — required for cross-origin requests from the browser
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SECURE"] = False  # Set True in production with HTTPS

# Allow CORS with credentials so session cookies work
CORS(app, supports_credentials=True, origins=["http://localhost:5000", "http://127.0.0.1:5000"])

# Register blueprints
app.register_blueprint(auth_bp, url_prefix="/api/auth")
app.register_blueprint(food_bp, url_prefix="/api/food")
app.register_blueprint(notif_bp, url_prefix="/api/notifications")
app.register_blueprint(verify_bp, url_prefix="/api/verification")
app.register_blueprint(decomp_bp, url_prefix="/api/decomposition")
app.register_blueprint(ai_bp, url_prefix="/api/ai")

# Serve uploaded files
UPLOADS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "uploads"))

@app.route("/uploads/<path:filename>")
def serve_upload(filename):
    return send_from_directory(UPLOADS_DIR, filename)

# Serve frontend SPA — catch-all so JS routing works
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    # Don't intercept API routes
    if path.startswith("api/"):
        from flask import abort
        abort(404)
    target = os.path.join(FRONTEND_DIR, path)
    if path and os.path.exists(target):
        return send_from_directory(FRONTEND_DIR, path)
    return send_from_directory(FRONTEND_DIR, "index.html")

if __name__ == "__main__":
    # Create upload directories
    for folder in ["certificates", "food", "verification"]:
        os.makedirs(os.path.join(UPLOADS_DIR, folder), exist_ok=True)
    init_db()
    print("\n✅ Servio running at http://localhost:5000\n")
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=False, host="0.0.0.0", port=port)
