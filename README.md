# 🍱 Servio

> Connect. Share. Nourish. — Servio bridges food donors with recipients to reduce waste.

## Quick Start

### 1. Install dependencies
```bash
cd foodbridge
pip install -r requirements.txt
```

### 2. Run the server
```bash
python app.py
```

### 3. Open the app
Visit: http://localhost:5000

---

## Project Structure

```
foodbridge/          ← Flask backend
  app.py             ← Entry point
  database.py        ← SQLite setup & schema
  requirements.txt
  routes/
    auth.py          ← Login, register, logout
    food.py          ← Post, claim, deliver, expire
    notifications.py ← Notification CRUD
    verification.py  ← Proof upload
    decomposition.py ← Composting requests
    ai_assistant.py  ← Gemini AI / rule-based fallback
  utils/
    location.py      ← Haversine distance calculation
    notifications.py ← Notification helper
  uploads/           ← Uploaded files (auto-created)

frontend/            ← Pure HTML/CSS/JS
  index.html         ← Single-page app shell
  css/
    main.css         ← All styles
    animations.css   ← Keyframes & animation classes
  js/
    api.js           ← Centralized API client
    auth.js          ← Login/register UI
    food.js          ← Food list, detail, post, claim
    map.js           ← Leaflet map with food markers
    notifications.js ← Notification panel
    ai.js            ← AI assistant chat panel
    app.js           ← Main controller & routing
```

## User Roles

| Role | Can Do |
|------|--------|
| **Donor** | Post food, mark expired, send for composting |
| **Recipient** | Browse & claim food, upload delivery proof |
| **Individual** | Same as recipient — volunteer bridge users |
| **Decomposition** | Receive expired food requests, mark collected |

## Food Status Flow

```
Available → Waiting → Claimed → Delivered
                ↓
             Expired → Decomposition
```

## API Endpoints

### Auth
- `POST /api/auth/register` — Register (multipart/form-data)
- `POST /api/auth/login` — Login
- `POST /api/auth/logout` — Logout
- `GET  /api/auth/me` — Current user

### Food
- `GET  /api/food/list?status=available` — List food
- `GET  /api/food/:id` — Food detail
- `POST /api/food/post` — Post food (donor)
- `POST /api/food/:id/claim` — Claim food
- `POST /api/food/:id/deliver` — Mark delivered
- `POST /api/food/:id/received` — Confirm receipt (donor)
- `POST /api/food/:id/expire` — Mark expired
- `GET  /api/food/my` — My posts/claims

### Notifications
- `GET  /api/notifications/` — List
- `GET  /api/notifications/unread-count`
- `POST /api/notifications/:id/read`
- `POST /api/notifications/read-all`

### Verification
- `POST /api/verification/upload/:food_id` — Upload proof
- `GET  /api/verification/:food_id` — View proof

### Decomposition
- `POST /api/decomposition/request` — Create request
- `GET  /api/decomposition/requests` — List requests
- `POST /api/decomposition/requests/:id/collect` — Mark collected

### AI Assistant
- `POST /api/ai/suggest` — Ask AI
- `GET  /api/ai/expiry-warnings` — Expiry warnings

## Optional: Gemini AI

Set the environment variable before running:
```bash
set GEMINI_API_KEY=your_key_here   # Windows
python app.py
```

Without the key, the app uses a built-in rule-based assistant.

## Map

Uses **Leaflet.js + OpenStreetMap** — completely free, no API key needed.
To switch to Google Maps, replace the tile layer in `frontend/js/map.js`.
