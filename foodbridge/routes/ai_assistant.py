import os
from flask import Blueprint, request, jsonify, session
from database import get_db

ai_bp = Blueprint("ai", __name__)

# Gemini API integration (optional — requires GEMINI_API_KEY env variable)
GEMINI_AVAILABLE = False
model = None

try:
    from google import genai
    GEMINI_KEY = os.environ.get("GEMINI_API_KEY")
    if GEMINI_KEY:
        _client = genai.Client(api_key=GEMINI_KEY)
        GEMINI_AVAILABLE = True
        print("✅ Gemini AI loaded successfully.")
    else:
        print("ℹ️  No GEMINI_API_KEY found — using rule-based AI fallback.")
except ImportError:
    print("ℹ️  google-genai not installed — using rule-based AI fallback.")
except Exception as e:
    print(f"⚠️  Gemini init error: {e} — using rule-based AI fallback.")


@ai_bp.route("/suggest", methods=["POST"])
def suggest():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Authentication required."}), 401

    data = request.get_json(silent=True) or {}
    query = data.get("query", "").strip()

    if not query:
        return jsonify({"error": "Query is required."}), 400

    if not GEMINI_AVAILABLE:
        return _rule_based_suggestion(query, user_id)

    try:
        context = (
            "You are Servio AI, an assistant for a food donation platform. "
            "Help users find NGOs, warn about expiring food, and navigate the app. "
            "Be concise and helpful. "
        )
        response = _client.models.generate_content(
            model="gemini-2.0-flash",
            contents=context + query,
        )
        return jsonify({"response": response.text}), 200
    except Exception as e:
        # Fall back to rule-based on any Gemini error
        return _rule_based_suggestion(query, user_id)


def _rule_based_suggestion(query, user_id):
    """Simple rule-based fallback when Gemini is not available."""
    query_lower = query.lower()
    db = get_db()

    if "ngo" in query_lower or "recipient" in query_lower or "nearest" in query_lower:
        recipients = db.execute(
            "SELECT name, address, phone FROM users WHERE role = 'recipient' LIMIT 5"
        ).fetchall()
        db.close()
        if recipients:
            suggestions = [
                f"{r['name']} — {r['address'] or 'No address'} ({r['phone'] or 'No phone'})"
                for r in recipients
            ]
            return jsonify({"response": "Nearby recipients:\n" + "\n".join(suggestions)}), 200
        return jsonify({"response": "No recipients registered yet."}), 200

    if "expir" in query_lower or "waste" in query_lower:
        db.close()
        return jsonify({
            "response": (
                "Tip: Post food at least 2 hours before expiry so recipients have time to claim it. "
                "If food is about to expire, use the 'Mark Almost Wasted' option to forward it to a decomposition center."
            )
        }), 200

    if "how" in query_lower or "help" in query_lower or "guide" in query_lower:
        db.close()
        return jsonify({
            "response": (
                "Servio Guide:\n"
                "1. Donors post surplus food with quantity, quality, and expiry.\n"
                "2. Nearby recipients get notified and can claim food.\n"
                "3. After delivery, upload proof to complete the transaction.\n"
                "4. Expired food is auto-forwarded to decomposition centers."
            )
        }), 200

    db.close()
    return jsonify({
        "response": "I can help you find NGOs, understand expiry warnings, or navigate the app. What do you need?"
    }), 200


@ai_bp.route("/expiry-warnings", methods=["GET"])
def expiry_warnings():
    """Return the donor's available food posts sorted by expiry time."""
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Authentication required."}), 401

    db = get_db()
    foods = db.execute(
        """SELECT id, org_name, food_type, quantity, expiry_time, pickup_address
           FROM food WHERE status = 'available' AND donor_id = ?
           ORDER BY expiry_time ASC""",
        (user_id,),
    ).fetchall()
    db.close()

    return jsonify([dict(f) for f in foods]), 200
