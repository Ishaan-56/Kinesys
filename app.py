"""
app.py – Kinesys Flask application.
Routes: landing, game hub, dashboard, doctor portal, user API, doctor API, session API, trend, report, trials.
"""

from flask import Flask, jsonify, request, render_template, abort
import json
import statistics
import db
import features

app = Flask(__name__)
db.init_db()

def _err(msg, code=400):
    return jsonify({"error": msg}), code

# ── Page routes ───────────────────────────────────────────────────────────────

@app.route("/")
def landing():
    return render_template("landing.html")

@app.route("/app")
def game_hub():
    return render_template("app.html")

@app.route("/dashboard/<int:user_id>")
def dashboard(user_id):
    user = db.get_user(user_id)
    if not user:
        abort(404)
    return render_template("dashboard.html", user=user)

@app.route("/doctor")
def doctor_portal():
    return render_template("doctor.html")

# ── User API ──────────────────────────────────────────────────────────────────

@app.route("/api/users", methods=["GET"])
def list_users():
    return jsonify(db.get_all_users())

@app.route("/api/users", methods=["POST"])
def create_user():
    data = request.json or {}
    name = data.get("name", "").strip()
    if not name:
        return _err("name is required")
    user_id = db.insert_user(name, data.get("age"), data.get("email"))
    return jsonify({"user_id": user_id, "name": name}), 201

@app.route("/api/users/<int:user_id>", methods=["GET"])
def get_user(user_id):
    user = db.get_user(user_id)
    if not user:
        return _err("user not found", 404)
    return jsonify(user)

# ── Doctor API ────────────────────────────────────────────────────────────────

@app.route("/api/doctors", methods=["GET"])
def list_doctors():
    doctors = db.get_all_doctors()
    # Seed a demo doctor if the list is empty
    if not doctors:
        db.insert_doctor("Demo Doctor", "General Practice", "demo@kinesys.org")
        doctors = db.get_all_doctors()
    return jsonify(doctors)

@app.route("/api/doctors", methods=["POST"])
def create_doctor():
    data = request.json or {}
    name = data.get("name", "").strip()
    if not name:
        return _err("doctor name is required")
    doc_id = db.insert_doctor(name, data.get("specialty"), data.get("email"))
    return jsonify({"doctor_id": doc_id, "name": name, "specialty": data.get("specialty")}), 201

@app.route("/api/share", methods=["POST"])
def share_data():
    data = request.json or {}
    patient_id = data.get("patient_id")
    doctor_id = data.get("doctor_id")
    if not patient_id or not doctor_id:
        return _err("patient_id and doctor_id are required")
    if not db.get_user(patient_id):
        return _err("patient not found", 404)
    if not db.get_doctor(doctor_id):
        return _err("doctor not found", 404)
    db.share_with_doctor(patient_id, doctor_id)
    return jsonify({"status": "shared", "patient_id": patient_id, "doctor_id": doctor_id}), 201

@app.route("/api/doctor/<int:doctor_id>/patients", methods=["GET"])
def get_doctor_patient_roster(doctor_id):
    doctor = db.get_doctor(doctor_id)
    if not doctor:
        return _err("doctor not found", 404)
    patients = db.get_doctor_patients(doctor_id)
    
    roster = []
    for p in patients:
        uid = p["id"]
        # Retrieve full diagnostic report for doctor inspection
        user_scores = {}
        session_counts = {}

        for tt in features.ALL_TEST_TYPES:
            sessions = db.get_sessions(uid, tt, limit=50)
            scores_chrono = [s["composite"] for s in sessions if s["composite"] is not None]
            user_scores[tt] = scores_chrono
            session_counts[tt] = len(sessions)

        # compute overall wellness
        recent_scores = []
        for scores in user_scores.values():
            if scores:
                recent_scores.append(statistics.mean(scores[-3:]))
        overall = round(statistics.mean(recent_scores), 1) if recent_scores else None

        # Doctor uses condition-based run_diagnostics
        diag = features.run_diagnostics(user_scores, session_counts)

        total_sessions = sum(session_counts.values())
        roster.append({
            "patient": p,
            "overall_wellness_score": overall,
            "total_sessions": total_sessions,
            "status": diag["status"],
            "summary": diag["clinical_summary"],
            "flagged_conditions": [d for d in diag["details"] if d["flagged"]],
        })

    return jsonify({"doctor": doctor, "roster": roster})

@app.route("/api/patient/<int:patient_id>/doctors", methods=["GET"])
def get_patient_doctors(patient_id):
    if not db.get_user(patient_id):
        return _err("patient not found", 404)
    return jsonify(db.get_patient_doctors(patient_id))

@app.route("/api/notes", methods=["POST"])
def add_note():
    data = request.json or {}
    patient_id = data.get("patient_id")
    doctor_id = data.get("doctor_id")
    note_text = data.get("note_text", "").strip()
    sender_role = data.get("sender_role", "doctor")
    if not patient_id or not note_text:
        return _err("patient_id and note_text are required")
    note_id = db.insert_note(patient_id, doctor_id, note_text, sender_role)
    return jsonify({"note_id": note_id, "status": "created"}), 201

@app.route("/api/notes/<int:patient_id>", methods=["GET"])
def get_notes(patient_id):
    if not db.get_user(patient_id):
        return _err("patient not found", 404)
    return jsonify(db.get_notes(patient_id))



# ── Session (game result) API ─────────────────────────────────────────────────

@app.route("/api/session", methods=["POST"])
def log_session():
    data = request.json or {}
    user_id = data.get("user_id")
    test_type = data.get("test_type")
    metrics = data.get("metrics", {})

    if not user_id or not test_type:
        return _err("user_id and test_type are required")

    if not db.get_user(user_id):
        return _err("user not found", 404)

    if test_type not in features.ALL_TEST_TYPES:
        return _err(f"unknown test_type: {test_type}")

    signals = features.extract_signals(test_type, metrics)
    if signals is None:
        return _err("not enough data in metrics to compute signals")

    baseline_str = db.get_baseline(user_id, test_type)
    baseline_dict = json.loads(baseline_str) if baseline_str else None

    # Score the session (returns None if no baseline)
    score = features.composite_score(test_type, signals, baseline_dict)

    # Store session (returns session_id)
    session_id = db.insert_session(user_id, test_type, metrics, score)

    # Store per-trial data if present
    trials_data = metrics.get("trials", [])
    for i, trial in enumerate(trials_data):
        db.insert_trial(session_id, i, trial)

    # Lock in real baseline once 3 sessions are completed
    if not baseline_dict:
        history = db.get_sessions(user_id, test_type, limit=20)
        if len(history) == 3:
            signal_dicts = []
            for s in history:
                m = json.loads(s["metrics"]) if isinstance(s["metrics"], str) else s["metrics"]
                sig = features.extract_signals(test_type, m)
                if sig:
                    signal_dicts.append(sig)
            
            if len(signal_dicts) == 3:
                baseline_dict = features.average_signals(signal_dicts)
                db.upsert_baseline(user_id, test_type, json.dumps(baseline_dict))
                # Now go back and retroactively score the 3 sessions!
                for s in history:
                    m = json.loads(s["metrics"]) if isinstance(s["metrics"], str) else s["metrics"]
                    sig = features.extract_signals(test_type, m)
                    new_score = features.composite_score(test_type, sig, baseline_dict)
                    if new_score is not None:
                        db.update_session_score(s["id"], new_score)
                        if s["id"] == session_id:
                            score = new_score

    return jsonify({"score": score, "session_id": session_id}), 201


# ── Trend API ─────────────────────────────────────────────────────────────────

@app.route("/api/trend/<int:user_id>")
def trend(user_id):
    if not db.get_user(user_id):
        return _err("user not found", 404)

    test_type = request.args.get("test")
    test_types = [test_type] if test_type else features.ALL_TEST_TYPES

    result = {}
    for tt in test_types:
        sessions = db.get_sessions(user_id, tt, limit=50)
        scores_chrono = [s["composite"] for s in sessions if s["composite"] is not None]
        baseline_str = db.get_baseline(user_id, tt)
        
        drift = features.compute_drift(scores_chrono)
        
        result[tt] = {
            "sessions": [
                {
                    "created_at": s["created_at"],
                    "composite": s["composite"],
                }
                for s in sessions
            ],
            "drift": drift,
            "baseline": 50.0 if baseline_str else None,
            "count": len(sessions),
        }

    return jsonify(result)


# ── Report API ────────────────────────────────────────────────────────────────

@app.route("/api/report/<int:user_id>")
def report(user_id):
    user = db.get_user(user_id)
    if not user:
        return _err("user not found", 404)

    trend_data = {}
    user_scores = {}
    session_counts = {}

    for tt in features.ALL_TEST_TYPES:
        sessions = db.get_sessions(user_id, tt, limit=50)
        scores_chrono = [s["composite"] for s in sessions if s["composite"] is not None]
        baseline_str = db.get_baseline(user_id, tt)
        drift = features.compute_drift(scores_chrono)
        count = len(sessions)

        recent_metrics = {}
        if sessions:
            try:
                latest_m = json.loads(sessions[-1]["metrics"]) if isinstance(sessions[-1]["metrics"], str) else (sessions[-1]["metrics"] or {})
                recent_metrics = features.extract_detailed_features(tt, latest_m)
            except Exception:
                recent_metrics = {}

        trend_data[tt] = {
            "drift": drift,
            "baseline": 50.0 if baseline_str else None,
            "count": count,
            "latest_metrics": recent_metrics,
        }

        user_scores[tt] = scores_chrono
        session_counts[tt] = count

    # Overall wellness (average of all recent scores)
    recent_scores = []
    for scores in user_scores.values():
        if scores:
            recent_scores.append(statistics.mean(scores[-3:]))
    overall_wellness = round(statistics.mean(recent_scores), 2) if recent_scores else None

    # Patient uses domain-based run_domain_summary
    domain_report = features.run_domain_summary(user_scores, session_counts)
    
    # We also include doctor diagnostics in the same payload for dashboard.js to conditionally render
    doctor_report = features.run_diagnostics(user_scores, session_counts)
    
    return jsonify({
        "user": user,
        "overall_wellness_score": overall_wellness,
        "tests": trend_data,
        "summary": domain_report,
        "diagnostics": doctor_report,
    })


# ── Trials API ────────────────────────────────────────────────────────────────

@app.route("/api/trials/<int:user_id>/<test_type>")
def get_user_trials(user_id, test_type):
    if not db.get_user(user_id):
        return _err("user not found", 404)

    sessions = db.get_sessions(user_id, test_type, limit=20)
    result = []
    for s in sessions:
        session_data = db.get_session_with_trials(s["id"])
        if session_data:
            result.append(session_data)

    return jsonify(result)


if __name__ == "__main__":
    app.run(debug=True, port=5000)
