from flask import Blueprint, jsonify, session
from database import get_db

notif_bp = Blueprint("notifications", __name__)


@notif_bp.route("/", methods=["GET"])
def get_notifications():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Authentication required."}), 401

    db = get_db()
    notifs = db.execute(
        "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
        (user_id,),
    ).fetchall()
    db.close()
    return jsonify([dict(n) for n in notifs]), 200


@notif_bp.route("/unread-count", methods=["GET"])
def unread_count():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Authentication required."}), 401

    db = get_db()
    count = db.execute(
        "SELECT COUNT(*) as cnt FROM notifications WHERE user_id = ? AND is_read = 0",
        (user_id,),
    ).fetchone()
    db.close()
    return jsonify({"unread": count["cnt"]}), 200


@notif_bp.route("/<int:notif_id>/read", methods=["POST"])
def mark_read(notif_id):
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Authentication required."}), 401

    db = get_db()
    db.execute(
        "UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?",
        (notif_id, user_id),
    )
    db.commit()
    db.close()
    return jsonify({"message": "Notification marked as read."}), 200


@notif_bp.route("/read-all", methods=["POST"])
def mark_all_read():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Authentication required."}), 401

    db = get_db()
    db.execute(
        "UPDATE notifications SET is_read = 1 WHERE user_id = ?", (user_id,)
    )
    db.commit()
    db.close()
    return jsonify({"message": "All notifications marked as read."}), 200
