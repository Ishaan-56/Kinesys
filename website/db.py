"""
db.py – NeuroType V3 database layer.
SQLite with users, sessions, trials, and baselines tables.
"""

import sqlite3
import json
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "neurotype.db")


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_conn()
    c = conn.cursor()

    c.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT    NOT NULL,
            age         INTEGER,
            email       TEXT    UNIQUE,
            created_at  TEXT    DEFAULT (datetime('now'))
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id     INTEGER NOT NULL REFERENCES users(id),
            test_type   TEXT    NOT NULL,
            metrics     TEXT    NOT NULL,
            composite   REAL,
            created_at  TEXT    DEFAULT (datetime('now'))
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS trials (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id  INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
            trial_index INTEGER NOT NULL,
            data        TEXT    NOT NULL
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS baselines (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id     INTEGER NOT NULL REFERENCES users(id),
            test_type   TEXT    NOT NULL,
            baseline    TEXT    NOT NULL,
            computed_at TEXT    DEFAULT (datetime('now')),
            UNIQUE(user_id, test_type)
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS doctors (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT    NOT NULL,
            specialty   TEXT,
            email       TEXT    UNIQUE,
            created_at  TEXT    DEFAULT (datetime('now'))
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS patient_doctors (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            doctor_id   INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
            created_at  TEXT    DEFAULT (datetime('now')),
            UNIQUE(patient_id, doctor_id)
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS doctor_notes (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            doctor_id   INTEGER REFERENCES doctors(id) ON DELETE CASCADE,
            sender_role TEXT    NOT NULL DEFAULT 'doctor',
            note_text   TEXT    NOT NULL,
            created_at  TEXT    DEFAULT (datetime('now'))
        )
    """)

    # Performance Indexes for Instant Query Execution
    c.execute("CREATE INDEX IF NOT EXISTS idx_sessions_user_test ON sessions(user_id, test_type);")
    c.execute("CREATE INDEX IF NOT EXISTS idx_trials_session ON trials(session_id);")
    c.execute("CREATE INDEX IF NOT EXISTS idx_notes_patient ON doctor_notes(patient_id);")

    conn.commit()
    conn.close()


# ── Users ─────────────────────────────────────────────────────────────────────

def insert_user(name, age=None, email=None):
    conn = get_conn()
    c = conn.cursor()
    c.execute(
        "INSERT INTO users (name, age, email) VALUES (?, ?, ?)",
        (name, age, email),
    )
    user_id = c.lastrowid
    conn.commit()
    conn.close()
    return user_id


def get_user(user_id):
    conn = get_conn()
    row = conn.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def get_all_users():
    conn = get_conn()
    rows = conn.execute("SELECT * FROM users ORDER BY created_at DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ── Sessions ──────────────────────────────────────────────────────────────────

def insert_session(user_id, test_type, metrics: dict, composite: float):
    """Insert a session and return the new session_id."""
    conn = get_conn()
    c = conn.cursor()
    c.execute(
        "INSERT INTO sessions (user_id, test_type, metrics, composite) VALUES (?,?,?,?)",
        (user_id, test_type, json.dumps(metrics), composite),
    )
    session_id = c.lastrowid
    conn.commit()
    conn.close()
    return session_id


def get_sessions(user_id, test_type=None, limit=50):
    conn = get_conn()
    if test_type:
        rows = conn.execute(
            "SELECT * FROM sessions WHERE user_id=? AND test_type=? ORDER BY created_at ASC, id ASC LIMIT ?",
            (user_id, test_type, limit),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM sessions WHERE user_id=? ORDER BY created_at ASC, id ASC LIMIT ?",
            (user_id, limit),
        ).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def update_session_score(session_id, score):
    conn = get_conn()
    conn.execute(
        "UPDATE sessions SET composite=? WHERE id=?",
        (score, session_id),
    )
    conn.commit()
    conn.close()


# ── Trials ────────────────────────────────────────────────────────────────────

def insert_trial(session_id, trial_index, data_dict):
    conn = get_conn()
    conn.execute(
        "INSERT INTO trials (session_id, trial_index, data) VALUES (?,?,?)",
        (session_id, trial_index, json.dumps(data_dict)),
    )
    conn.commit()
    conn.close()


def get_trials(session_id):
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM trials WHERE session_id=? ORDER BY trial_index ASC",
        (session_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_session_with_trials(session_id):
    conn = get_conn()
    session = conn.execute("SELECT * FROM sessions WHERE id=?", (session_id,)).fetchone()
    if not session:
        conn.close()
        return None
    result = dict(session)
    trials = conn.execute(
        "SELECT * FROM trials WHERE session_id=? ORDER BY trial_index ASC",
        (session_id,),
    ).fetchall()
    result["trials"] = [dict(t) for t in trials]
    conn.close()
    return result


# ── Baselines ─────────────────────────────────────────────────────────────────

def upsert_baseline(user_id, test_type, value):
    conn = get_conn()
    conn.execute(
        """INSERT INTO baselines (user_id, test_type, baseline)
           VALUES (?,?,?)
           ON CONFLICT(user_id, test_type) DO UPDATE SET baseline=excluded.baseline, computed_at=datetime('now')""",
        (user_id, test_type, value),
    )
    conn.commit()
    conn.close()


def get_baseline(user_id, test_type):
    conn = get_conn()
    row = conn.execute(
        "SELECT baseline FROM baselines WHERE user_id=? AND test_type=?",
        (user_id, test_type),
    ).fetchone()
    conn.close()
    return row["baseline"] if row else None


# ── Doctors ───────────────────────────────────────────────────────────────────

def insert_doctor(name, specialty=None, email=None):
    conn = get_conn()
    c = conn.cursor()
    c.execute(
        "INSERT INTO doctors (name, specialty, email) VALUES (?, ?, ?)",
        (name, specialty, email),
    )
    doc_id = c.lastrowid
    conn.commit()
    conn.close()
    return doc_id


def get_doctor(doctor_id):
    conn = get_conn()
    row = conn.execute("SELECT * FROM doctors WHERE id=?", (doctor_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def get_all_doctors():
    conn = get_conn()
    rows = conn.execute("SELECT * FROM doctors ORDER BY created_at DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def share_with_doctor(patient_id, doctor_id):
    conn = get_conn()
    conn.execute(
        "INSERT OR IGNORE INTO patient_doctors (patient_id, doctor_id) VALUES (?, ?)",
        (patient_id, doctor_id),
    )
    conn.commit()
    conn.close()


def get_doctor_patients(doctor_id):
    conn = get_conn()
    rows = conn.execute(
        """SELECT u.*, pd.created_at as shared_at 
           FROM users u 
           JOIN patient_doctors pd ON u.id = pd.patient_id 
           WHERE pd.doctor_id=? 
           ORDER BY pd.created_at DESC""",
        (doctor_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_patient_doctors(patient_id):
    conn = get_conn()
    rows = conn.execute(
        """SELECT d.*, pd.created_at as shared_at 
           FROM doctors d 
           JOIN patient_doctors pd ON d.id = pd.doctor_id 
           WHERE pd.patient_id=? 
           ORDER BY pd.created_at DESC""",
        (patient_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ── Doctor-Patient Notes ───────────────────────────────────────────────────────

def insert_note(patient_id, doctor_id, note_text, sender_role="doctor"):
    conn = get_conn()
    c = conn.cursor()
    c.execute(
        "INSERT INTO doctor_notes (patient_id, doctor_id, note_text, sender_role) VALUES (?, ?, ?, ?)",
        (patient_id, doctor_id, note_text, sender_role),
    )
    note_id = c.lastrowid
    conn.commit()
    conn.close()
    return note_id


def get_notes(patient_id):
    conn = get_conn()
    rows = conn.execute(
        """SELECT n.*, d.name as doctor_name, u.name as patient_name
           FROM doctor_notes n
           LEFT JOIN doctors d ON n.doctor_id = d.id
           LEFT JOIN users u ON n.patient_id = u.id
           WHERE n.patient_id=?
           ORDER BY n.created_at ASC""",
        (patient_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


