/* =============================================================
   dashboard.js – Kinesys personal-trends dashboard & doctor view
   ============================================================= */

const TEST_LABELS = {
  typing:      { label: 'Typing Rhythm',   icon: '⌨️',  domain: 'Rhythm & Steadiness', disease: "Parkinson's Disease (neuroQWERTY Keystroke Dynamics)" },
  tapsync:     { label: 'Tap Sync',        icon: '🎹',  domain: 'Rhythm & Steadiness', disease: "Parkinson's Bradykinesia / Motor Tapping" },
  pathtrace:   { label: 'Path Trace',      icon: '🌀',  domain: 'Movement Smoothness', disease: "Parkinson's Action Tremor & Spiral Smoothness" },
  steadyhold:  { label: 'Steady Hold',     icon: '🎯',  domain: 'Movement Smoothness', disease: "Huntington's Chorea & Postural Instability" },
  flashreact:  { label: 'Flash React',     icon: '⚡',  domain: 'Attention & Focus', disease: "Schizophrenia Go/No-Go Reaction Variability" },
  sequence:    { label: 'Sequence Recall', icon: '🧩',  domain: 'Memory & Recall', disease: "Alzheimer's Corsi Spatial Working Memory" },
  trailmaking: { label: 'Trail Connect',   icon: '🔗',  domain: 'Processing Speed', disease: "Alzheimer's Executive Function & Switching" },
  wordspark:   { label: 'Word Spark',      icon: '💬',  domain: 'Word-Finding & Fluency', disease: "General Subcortical Verbal Fluency Latency" },
  focuswatch:  { label: 'Focus Watch',     icon: '👁️',  domain: 'Attention & Focus', disease: "ADHD Continuous Performance Attention (d' Index)" },
};

const DOMAIN_BLURBS = {
  'Rhythm & Steadiness':     'Measures keystroke hold/flight timing and alternating tap regularity.',
  'Movement Smoothness':     'Measures micro-tremor, spiral path deviation, and postural stability.',
  'Attention & Focus':       'Measures Go/No-Go reaction time variability and sustained CPT d-prime index.',
  'Memory & Recall':         'Measures spatial working memory span and sequential recall latency.',
  'Processing Speed':        'Measures task-switching speed and trail-making Part B/A completion ratio.',
  'Word-Finding & Fluency':  'Measures verbal prompt-to-type reaction latency and production time.',
};

let currentUserId = null;

document.addEventListener('DOMContentLoaded', () => {
  currentUserId = window.NT_USER_ID;
  if (!currentUserId) {
    const summaryEl = document.getElementById('diagnostics-container');
    if (summaryEl) summaryEl.innerHTML = '<div class="panel"><p style="color:var(--text-muted);">No patient profile selected.</p></div>';
    return;
  }

  const patientIdEl = document.getElementById('patient-id');
  if (patientIdEl) patientIdEl.textContent = currentUserId;

  const dateEl = document.getElementById('date-assessed');
  const printDateEl = document.getElementById('print-date');
  const todayStr = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  if (dateEl) dateEl.textContent = todayStr;
  if (printDateEl) printDateEl.textContent = todayStr;

  const printPatientIdEl = document.getElementById('print-patient-id');
  if (printPatientIdEl) printPatientIdEl.textContent = currentUserId;

  if (typeof Chart !== 'undefined') {
    Chart.defaults.color = '#8b949e';
    Chart.defaults.font.family = "'Inter', sans-serif";
  }

  _loadReport(currentUserId);
  _loadTrend(currentUserId);
  _loadNotes(currentUserId);
});

async function _loadReport(userId) {
  try {
    const res = await API.getReport(userId);
    if (res.user && res.user.name) {
      const patientIdEl = document.getElementById('patient-id');
      if (patientIdEl) patientIdEl.textContent = `${res.user.name} (Age: ${res.user.age || 'N/A'}, ID #${userId})`;
      const printPatientIdEl = document.getElementById('print-patient-id');
      if (printPatientIdEl) printPatientIdEl.textContent = `${res.user.name} (ID #${userId})`;
    }
    
    // Check if Doctor View mode is requested via URL query string ?view=doctor
    const isDoctorView = new URLSearchParams(window.location.search).get('view') === 'doctor';

    _renderConsolidatedCards(res.tests || {}, userId, isDoctorView);
    _renderSummary(res.summary || {}, res.diagnostics || {}, isDoctorView);
    _populatePrintReport(res);
  } catch (e) {
    console.error("Error loading report:", e);
  }
}

function _renderConsolidatedCards(tests, userId, isDoctorView) {
  const grid = document.getElementById('overview-grid');
  if (!grid) return;
  grid.innerHTML = '';

  Object.keys(TEST_LABELS).forEach(key => {
    const info = TEST_LABELS[key];
    const testData = tests[key] || {};
    const count = testData.count || 0;
    const drift = testData.drift || {};
    const latest = testData.latest_metrics || {};

    let scoreHtml = 'Building baseline';
    let driftBadge = '<span class="mono-label" style="color:var(--text-muted); font-size:0.75rem;">BUILDING BASELINE</span>';

    if (count > 0 && drift.recent_avg !== undefined) {
      const delta = drift.recent_avg - 50;
      scoreHtml = `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}% vs baseline`;
      if (delta >= 25) {
        driftBadge = '<span class="mono-label" style="color:var(--risk-amber); background:rgba(210,153,34,0.15); padding:3px 8px; border-radius:4px; font-size:0.75rem;">DRIFT DETECTED</span>';
      } else {
        driftBadge = '<span class="mono-label" style="color:var(--mint-primary); background:var(--mint-subtle); padding:3px 8px; border-radius:4px; font-size:0.75rem;">STABLE BASELINE</span>';
      }
    }

    // Build key-value metric rows table
    let metricRowsHtml = '<tr><td colspan="2" style="color:var(--text-muted); text-align:center; font-size:0.8rem;">No raw metrics captured yet</td></tr>';
    const varKeys = Object.keys(latest);
    if (varKeys.length > 0) {
      metricRowsHtml = '';
      varKeys.slice(0, 4).forEach(vKey => {
        const val = latest[vKey];
        const valStr = val !== null && val !== undefined ? val : 'N/A';
        const labelStr = vKey.replace(/_/g, ' ').toUpperCase();
        metricRowsHtml += `
          <tr>
            <td class="metric-label">${labelStr}</td>
            <td class="metric-value">${valStr}</td>
          </tr>
        `;
      });
    }

    let doctorDiseaseHtml = '';
    if (isDoctorView) {
      doctorDiseaseHtml = `<div class="disease-tag">🩺 Correlated Clinical Marker: ${info.disease}</div>`;
    }

    grid.innerHTML += `
      <div class="consolidated-card">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.5rem;">
            <div>
              <div style="font-size:1.6rem; line-height:1; margin-bottom:4px;">${info.icon}</div>
              <h3 style="margin:0; color:#fff; font-size:1.15rem;">${info.label}</h3>
              <div style="font-size:0.78rem; color:var(--accent-blue); margin-top:2px;">Domain: ${info.domain}</div>
            </div>
            <div>${driftBadge}</div>
          </div>

          ${doctorDiseaseHtml}

          <table class="metric-table">
            ${metricRowsHtml}
          </table>
        </div>

        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.82rem; margin-bottom:0.75rem; border-top:1px solid var(--border-muted); padding-top:0.75rem;">
            <span style="color:var(--text-muted);">Sessions Completed: <strong>${count}</strong></span>
            <span style="color:var(--text-primary); font-weight:600;">${scoreHtml}</span>
          </div>
          <button class="btn btn-outline" style="width:100%; font-size:0.78rem; padding:6px;" onclick="_toggleTrialLog('${userId}', '${key}', this)">🔍 Expand Raw Trial Stream</button>
          <div id="trial-log-${key}" style="display:none; margin-top:8px; background:var(--bg-input); padding:8px; border-radius:4px; border:1px solid var(--border-light); max-height:160px; overflow-y:auto; font-family:var(--font-mono); font-size:0.72rem; color:var(--text-secondary);"></div>
        </div>
      </div>
    `;
  });
}

function _renderSummary(domainSummary, doctorDiag, isDoctorView) {
  const container = document.getElementById('diagnostics-container');
  if (!container) return;

  if (isDoctorView) {
    // Show Doctor Diagnostic View with explicit condition notes
    let detailsHtml = '';
    (doctorDiag.details || []).forEach(d => {
      const color = d.flagged ? 'var(--risk-amber)' : 'var(--mint-primary)';
      const icon = d.flagged ? '⚠️' : '✓';
      detailsHtml += `
        <div style="background:var(--bg-input); padding:10px 14px; border-radius:6px; border:1px solid var(--border-light); margin-bottom:8px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong style="color:#fff; font-size:0.95rem;">${icon} Potential Marker for ${d.condition}</strong>
            <span style="color:${color}; font-size:0.8rem; font-weight:600;">${d.flagged ? 'PATTERN CHANGE DETECTED' : 'CLEAR'}</span>
          </div>
          <p style="margin:4px 0 6px 0; font-size:0.82rem; color:var(--text-muted);">${d.description}</p>
          <div style="font-family:var(--font-mono); font-size:0.78rem; color:var(--text-secondary);">${d.evidence.join(' | ')}</div>
        </div>
      `;
    });

    container.innerHTML = `
      <div class="panel" style="border-top:3px solid var(--mint-primary);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
          <h2 style="margin:0; color:#fff; font-size:1.3rem;">Physician Clinical Decision Support Engine</h2>
          <span class="mono-label" style="color:var(--mint-primary); background:var(--mint-subtle); padding:4px 10px; border-radius:4px;">DOCTOR INSPECTION MODE</span>
        </div>
        <p style="font-size:0.95rem; color:var(--text-secondary); margin-bottom:1rem; line-height:1.5;">${doctorDiag.clinical_summary || 'No diagnostic notes available.'}</p>
        <div>${detailsHtml}</div>
      </div>
    `;
  } else {
    // Patient View - Calm, Non-Diagnostic Domain Summary
    let statusClass = 'status-pending';
    let badgeColor = 'var(--text-muted)';
    let badgeText = 'BUILDING BASELINE';

    if (domainSummary.status === 'notice') {
      badgeColor = 'var(--risk-amber)';
      badgeText = 'CHANGE NOTICED';
    } else if (domainSummary.status === 'stable') {
      badgeColor = 'var(--mint-primary)';
      badgeText = 'CONSISTENT WITH BASELINE';
    }

    container.innerHTML = `
      <div class="panel" style="border-top:3px solid ${badgeColor};">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
          <h2 style="margin:0; color:#fff; font-size:1.3rem;">Personal Pattern Summary</h2>
          <span style="background:${badgeColor}22; color:${badgeColor}; border:1px solid ${badgeColor}66; padding:4px 12px; border-radius:99px; font-size:0.75rem; font-weight:700;">${badgeText}</span>
        </div>
        <p style="font-size:0.98rem; line-height:1.6; color:var(--text-secondary);">${domainSummary.summary || 'Still building your personal baseline.'}</p>
      </div>
    `;
  }
}

async function _toggleTrialLog(userId, testType, btnEl) {
  const container = document.getElementById(`trial-log-${testType}`);
  if (!container) return;

  if (container.style.display === 'none') {
    container.style.display = 'block';
    btnEl.textContent = '▲ Hide Raw Trial Stream';
    container.innerHTML = '<span style="color:var(--text-muted)">Loading trial stream...</span>';
    try {
      const res = await API.get(`/api/trials/${userId}/${testType}`);
      const trials = res || [];
      if (trials.length === 0) {
        container.innerHTML = '<span style="color:var(--text-muted)">No per-trial raw logs found.</span>';
      } else {
        let html = `<strong>Captured Sessions: ${trials.length}</strong><hr style="border-color:var(--border-muted); margin:4px 0;">`;
        trials.slice(0, 5).forEach((sess, i) => {
          const trialRows = sess.trials || [];
          html += `<div>[Session ${i+1}] ${trialRows.length} trials recorded</div>`;
        });
        container.innerHTML = html;
      }
    } catch (e) {
      container.innerHTML = '<span style="color:var(--risk-red)">Failed to load telemetry stream.</span>';
    }
  } else {
    container.style.display = 'none';
    btnEl.textContent = '🔍 Expand Raw Trial Stream';
  }
}

function _populatePrintReport(res) {
  const summaryEl = document.getElementById('print-summary-text');
  if (summaryEl) {
    summaryEl.textContent = (res.summary && res.summary.summary) ? res.summary.summary : 'Patterns remain consistent across measured protocols.';
  }

  const tableBody = document.getElementById('print-table-body');
  if (!tableBody) return;
  tableBody.innerHTML = '';

  Object.keys(TEST_LABELS).forEach(key => {
    const info = TEST_LABELS[key];
    const testData = (res.tests || {})[key] || {};
    const count = testData.count || 0;
    const drift = testData.drift || {};
    const latest = testData.latest_metrics || {};

    let driftStr = 'Building baseline';
    if (count > 0 && drift.recent_avg !== undefined) {
      const delta = drift.recent_avg - 50;
      driftStr = `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}% vs baseline`;
    }

    let keyMetricStr = 'N/A';
    const varKeys = Object.keys(latest);
    if (varKeys.length > 0) {
      const k = varKeys[0];
      keyMetricStr = `${k.replace(/_/g, ' ')}: ${latest[k]}`;
    }

    tableBody.innerHTML += `
      <tr>
        <td><strong>${info.label}</strong></td>
        <td>${info.domain}</td>
        <td>${count}</td>
        <td>${driftStr}</td>
        <td>${keyMetricStr}</td>
      </tr>
    `;
  });
}

// ── Doctor-Patient Notes & Communication AJAX System ─────────────────────────

async function _loadNotes(userId) {
  const listEl = document.getElementById('notes-list');
  const printListEl = document.getElementById('print-notes-list');
  if (!listEl) return;

  try {
    const notes = await API.getNotes(userId);
    if (!notes || notes.length === 0) {
      listEl.innerHTML = '<p style="color:var(--text-muted); font-size:0.85rem; margin:0;">No consultation notes logged yet.</p>';
      if (printListEl) printListEl.innerHTML = '<div>No consultation notes recorded.</div>';
      return;
    }

    let html = '';
    let printHtml = '';
    notes.forEach(n => {
      const isDoc = n.sender_role === 'doctor';
      const senderName = isDoc ? (n.doctor_name ? `Dr. ${n.doctor_name}` : 'Physician') : (n.patient_name || 'Patient');
      const roleClass = isDoc ? 'doctor' : 'patient';
      const dateStr = new Date(n.created_at).toLocaleString();

      html += `
        <div class="note-bubble ${roleClass}">
          <div style="display:flex; justify-content:space-between; font-size:0.78rem; color:var(--text-muted); margin-bottom:4px;">
            <strong style="color:${isDoc ? 'var(--mint-primary)' : 'var(--accent-blue)'};">${senderName}</strong>
            <span>${dateStr}</span>
          </div>
          <div style="color:var(--text-primary); line-height:1.4;">${n.note_text}</div>
        </div>
      `;

      printHtml += `
        <div style="margin-bottom:6px; border-bottom:1px solid #eee; padding-bottom:4px;">
          <strong>[${dateStr}] ${senderName}:</strong> ${n.note_text}
        </div>
      `;
    });

    listEl.innerHTML = html;
    if (printListEl) printListEl.innerHTML = printHtml;
  } catch (e) {
    listEl.innerHTML = '<p style="color:var(--text-muted); font-size:0.85rem;">Error loading notes.</p>';
  }
}

async function _submitNote(e) {
  e.preventDefault();
  const input = document.getElementById('note-input');
  if (!input || !input.value.trim() || !currentUserId) return;

  const noteText = input.value.trim();
  const docId = localStorage.getItem('kinesys_doc_id') || 1;
  const isDoctorView = new URLSearchParams(window.location.search).get('view') === 'doctor';
  const role = isDoctorView ? 'doctor' : 'patient';

  try {
    await API.sendNote(currentUserId, docId, noteText, role);
    input.value = '';
    _loadNotes(currentUserId);
  } catch (err) {
    console.error("Error sending note:", err);
  }
}

async function _loadTrend(userId) {
  try {
    const res = await API.getTrend(userId);
    Object.keys(TEST_LABELS).forEach(key => {
      const testTrend = res[key] || {};
      _renderChart(key, testTrend);
    });
  } catch (e) {
    console.error("Error loading trends:", e);
  }
}

function _renderChart(testKey, testTrend) {
  const canvasId = `chart-${testKey}`;
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  const sessions = testTrend.sessions || [];
  if (sessions.length === 0) {
    const parent = ctx.parentElement;
    if (parent) {
      parent.innerHTML = '<div style="display:flex;height:100%;align-items:center;justify-content:center;color:var(--text-muted);font-size:0.85rem;">No sessions recorded yet</div>';
    }
    return;
  }

  const labels = sessions.map(s => {
    const d = new Date(s.created_at);
    return `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${d.getMinutes()<10?'0':''}${d.getMinutes()}`;
  });
  const scores = sessions.map(s => s.composite);
  const baselineVal = 50;

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Session score (50 = baseline)',
          data: scores,
          borderColor: '#58a6ff',
          backgroundColor: 'rgba(88, 166, 255, 0.1)',
          fill: true,
          tension: 0.3,
          pointBackgroundColor: '#58a6ff',
          pointRadius: 4,
          pointHoverRadius: 6,
          spanGaps: true,
        },
        {
          label: 'Personal baseline',
          data: Array(sessions.length).fill(baselineVal),
          borderColor: '#38d9a9',
          borderDash: [5, 5],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          grid: { color: 'rgba(139, 148, 158, 0.1)' },
          ticks: { color: '#8b949e' },
        },
        x: {
          grid: { color: 'rgba(139, 148, 158, 0.1)' },
          ticks: { color: '#8b949e', maxRotation: 45, minRotation: 0 },
        }
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: { color: '#8b949e', boxWidth: 12, font: { size: 11 } }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: '#161b22',
          titleColor: '#fff',
          bodyColor: '#c9d1d9',
          borderColor: '#30363d',
          borderWidth: 1,
        }
      }
    }
  });
}
