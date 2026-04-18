def create_notification(db, user_id: int, message: str, notif_type: str = "general"):
    """
    Insert a notification record for a user.
    db must be an open database connection.
    """
    db.execute(
        "INSERT INTO notifications (user_id, message, type) VALUES (?, ?, ?)",
        (user_id, message, notif_type),
    )
