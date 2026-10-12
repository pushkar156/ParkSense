import sqlite3
import time
from pathlib import Path
from typing import Optional
from config import Config

def get_db_path(db_path: Optional[str | Path] = None) -> Path:
    if db_path is not None:
        return Path(db_path)
    return Config.DB_PATH

def get_connection(db_path: Optional[str | Path] = None) -> sqlite3.Connection:
    target_path = get_db_path(db_path)
    conn = sqlite3.connect(target_path, timeout=10.0)
    conn.row_factory = sqlite3.Row
    # Enable WAL mode for high concurrency between reader/writer threads
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    return conn

def init_db(db_path: Optional[str | Path] = None) -> None:
    target_path = get_db_path(db_path)
    target_path.parent.mkdir(parents=True, exist_ok=True)
    conn = get_connection(target_path)
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS readings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp INTEGER NOT NULL,
            distance_cm REAL,
            occupied INTEGER,
            measurement_valid INTEGER NOT NULL DEFAULT 1,
            mode TEXT NOT NULL DEFAULT 'AUTO',
            threshold_cm REAL NOT NULL DEFAULT 15.0,
            red_led INTEGER NOT NULL DEFAULT 0,
            green_led INTEGER NOT NULL DEFAULT 1,
            source TEXT NOT NULL DEFAULT 'hardware'
        )
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_readings_ts ON readings(timestamp DESC)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_readings_source ON readings(source)")

    cur.execute("""
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp INTEGER NOT NULL,
            event_type TEXT NOT NULL,
            distance_cm REAL,
            previous_state TEXT NOT NULL,
            new_state TEXT NOT NULL,
            mode TEXT NOT NULL DEFAULT 'AUTO',
            source TEXT NOT NULL DEFAULT 'hardware',
            details TEXT NOT NULL
        )
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_events_ts ON events(timestamp DESC)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_events_source ON events(source)")

    cur.execute("""
        CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY,
            threshold_cm REAL NOT NULL DEFAULT 15.0,
            mode TEXT NOT NULL DEFAULT 'AUTO',
            simulation_enabled INTEGER NOT NULL DEFAULT 0,
            updated_at INTEGER NOT NULL
        )
    """)

    cur.execute("SELECT id FROM settings WHERE id = 1")
    if not cur.fetchone():
        now_ts = int(time.time() * 1000)
        cur.execute("""
            INSERT INTO settings (id, threshold_cm, mode, simulation_enabled, updated_at)
            VALUES (1, ?, 'AUTO', ?, ?)
        """, (Config.DEFAULT_THRESHOLD_CM, 1 if Config.SIMULATION_ENABLED else 0, now_ts))

    conn.commit()
    conn.close()
