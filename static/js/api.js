/* =============================================================
   api.js – Centralised fetch wrapper for Kinesys backend
   ============================================================= */

const API = (() => {
  const BASE = '';   // same-origin Flask; change to 'http://localhost:5000' if decoupled

  async function _request(method, path, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res = await fetch(BASE + path, opts);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
    return json;
  }

  return {
    get:  (path)       => _request('GET',  path),
    post: (path, body) => _request('POST', path, body),

    // ── Users ──────────────────────────────────────────────
    createUser(name, age, email) {
      return this.post('/api/users', { name, age: age ? Number(age) : undefined, email: email || undefined });
    },

    getUser(userId) {
      return this.get(`/api/users/${userId}`);
    },

    // ── Doctors ─────────────────────────────────────────────
    createDoctor(name, specialty, email) {
      return this.post('/api/doctors', { name, specialty, email });
    },

    getDoctors() {
      return this.get('/api/doctors');
    },

    shareWithDoctor(patientId, doctorId) {
      return this.post('/api/share', { patient_id: patientId, doctor_id: doctorId });
    },

    getDoctorPatients(doctorId) {
      return this.get(`/api/doctor/${doctorId}/patients`);
    },

    getPatientDoctors(patientId) {
      return this.get(`/api/patient/${patientId}/doctors`);
    },

    // ── Sessions ────────────────────────────────────────────
    logSession(userId, testType, metrics) {
      return this.post('/api/session', {
        user_id:   userId,
        test_type: testType,
        metrics,
      });
    },

    // ── Trend / Report ──────────────────────────────────────
    getTrend(userId, testType) {
      const q = testType ? `?test=${testType}` : '';
      return this.get(`/api/trend/${userId}${q}`);
    },

    getReport(userId) {
      return this.get(`/api/report/${userId}`);
    },

    // ── Notes ───────────────────────────────────────────────
    sendNote(patientId, doctorId, noteText, senderRole = 'doctor') {
      return this.post('/api/notes', {
        patient_id:  patientId,
        doctor_id:   doctorId,
        note_text:   noteText,
        sender_role: senderRole,
      });
    },

    getNotes(patientId) {
      return this.get(`/api/notes/${patientId}`);
    },
  };
})();
