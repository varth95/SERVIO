import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "foodbridge.db")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    cursor = conn.cursor()

    # Users table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('donor', 'recipient', 'individual', 'decomposition')),
            phone TEXT,
            latitude REAL,
            longitude REAL,
            address TEXT,
            certificate_path TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Food posts table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS food (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            donor_id INTEGER NOT NULL,
            org_name TEXT NOT NULL,
            food_type TEXT NOT NULL CHECK(food_type IN ('veg', 'non-veg')),
            quantity REAL NOT NULL,
            quality TEXT NOT NULL CHECK(quality IN ('fresh', 'good', 'average')),
            expiry_time TEXT NOT NULL,
            pickup_address TEXT NOT NULL,
            latitude REAL,
            longitude REAL,
            image_path TEXT,
            status TEXT DEFAULT 'available' CHECK(status IN ('available', 'waiting', 'claimed', 'delivered', 'expired')),
            claimed_by INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (donor_id) REFERENCES users(id),
            FOREIGN KEY (claimed_by) REFERENCES users(id)
        )
    """)

    # Notifications table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            message TEXT NOT NULL,
            type TEXT,
            is_read INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)

    # Verification table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS verification (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            food_id INTEGER NOT NULL,
            recipient_id INTEGER NOT NULL,
            image_path TEXT,
            video_path TEXT,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (food_id) REFERENCES food(id),
            FOREIGN KEY (recipient_id) REFERENCES users(id)
        )
    """)

    # Decomposition requests table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS decomposition_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            food_id INTEGER,
            requester_id INTEGER NOT NULL,
            quantity REAL NOT NULL,
            food_type TEXT,
            latitude REAL,
            longitude REAL,
            address TEXT,
            status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'assigned', 'collected')),
            assigned_to INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (food_id) REFERENCES food(id),
            FOREIGN KEY (requester_id) REFERENCES users(id),
            FOREIGN KEY (assigned_to) REFERENCES users(id)
        )
    """)

    conn.commit()
    conn.close()
    print("Database initialized successfully.")
