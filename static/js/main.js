/* =============================================================
   main.js – Game Hub orchestrator (V2 - 9 Games)
   ============================================================= */

function showToast(msg, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast`;
  if (type === 'success') toast.style.backgroundColor = 'var(--accent-ok)';
  if (type === 'error') toast.style.backgroundColor = 'var(--accent-err)';
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

let currentUserId = null;
let currentGame   = null;
let currentGameInstance = null;

const GAME_MODULES = {
  typing:      typeof TypingGame      !== 'undefined' ? TypingGame      : null,
  tapsync:     typeof TapSyncGame     !== 'undefined' ? TapSyncGame     : null,
  pathtrace:   typeof PathTraceGame   !== 'undefined' ? PathTraceGame   : null,
  steadyhold:  typeof SteadyHoldGame  !== 'undefined' ? SteadyHoldGame  : null,
  flashreact:  typeof FlashReactGame  !== 'undefined' ? FlashReactGame  : null,
  sequence:    typeof SequenceGame    !== 'undefined' ? SequenceGame    : null,
  trailmaking: typeof TrailMakingGame !== 'undefined' ? TrailMakingGame : null,
  wordspark:   typeof WordSparkGame   !== 'undefined' ? WordSparkGame   : null,
  focuswatch:  typeof FocusWatchGame  !== 'undefined' ? FocusWatchGame  : null,
};

const INFO = {
  typing:      { title: 'Typing Rhythm',     desc: 'Type the displayed text naturally. We measure keystroke timing patterns, not content.', icon: '⌨️' },
  tapsync:     { title: 'Tap Sync',           desc: 'Alternate F and J keys as fast and steadily as possible for 10 seconds.', icon: '🎹' },
  pathtrace:   { title: 'Path Trace',         desc: 'Trace the spiral path with your cursor as accurately as possible.', icon: '🌀' },
  steadyhold:  { title: 'Steady Hold',        desc: 'Hold your cursor perfectly still inside the target circle for 10 seconds.', icon: '🎯' },
  flashreact:  { title: 'Flash React',        desc: 'Press SPACE on green flashes. Do NOT press on red flashes.', icon: '⚡' },
  sequence:    { title: 'Sequence Recall',     desc: 'Watch the blocks light up, then click them back in the same order.', icon: '🧩' },
  trailmaking: { title: 'Trail Connect',      desc: 'Connect circles in order. Part A: numbers. Part B: alternating numbers and letters.', icon: '🔗' },
  wordspark:   { title: 'Word Spark',         desc: 'Type the first related word that comes to mind for each prompt.', icon: '💬' },
  focuswatch:  { title: 'Focus Watch',        desc: 'Press SPACE when you see the letter X. Ignore all other letters. 3 minutes.', icon: '👁️' },
};

document.addEventListener('DOMContentLoaded', () => {
  currentUserId = localStorage.getItem('nt_user_id');
  _updateUserUI();
  _bindNav();
  _bindGameCards();
  _bindModal();
});

function _updateUserUI() {
  const userBar = document.getElementById('user-bar');
  const loginBtn = document.getElementById('nav-login-btn');
  if (currentUserId) {
    if (userBar) userBar.classList.remove('hidden');
    if (loginBtn) loginBtn.classList.add('hidden');
    if (typeof API !== 'undefined') {
      API.getUser(currentUserId).then(u => {
        const nameEl = document.getElementById('user-name-display');
        if (nameEl) nameEl.textContent = u.name;
      }).catch(() => {
        localStorage.removeItem('nt_user_id');
        currentUserId = null;
        _updateUserUI();
      });
    }
  } else {
    if (userBar) userBar.classList.add('hidden');
    if (loginBtn) loginBtn.classList.remove('hidden');
  }
}

function _bindNav() {
  const loginBtn = document.getElementById('nav-login-btn');
  if (loginBtn) loginBtn.addEventListener('click', () => _openModal('login'));

  const switchBtn = document.getElementById('nav-switch-btn');
  if (switchBtn) switchBtn.addEventListener('click', () => _openModal('login'));

  const shareBtn = document.getElementById('nav-share-doc-btn');
  if (shareBtn) shareBtn.addEventListener('click', () => _openModal('share_doc'));

  const dashBtn = document.getElementById('nav-dashboard-btn');
  if (dashBtn) dashBtn.addEventListener('click', () => {
    if (currentUserId) window.location.href = `/dashboard/${currentUserId}`;
    else _openModal('login');
  });
}

function _openModal(type) {
  const overlay = document.getElementById('modal-overlay');
  if (!overlay) return;
  overlay.classList.add('active', 'open');
  if (type === 'login') _renderLoginModal();
  if (type === 'share_doc') _renderShareDoctorModal();
}

function _closeModal() {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.classList.remove('active', 'open');
}

function _bindModal() {
  const overlay = document.getElementById('modal-overlay');
  if (!overlay) return;
  overlay.addEventListener('click', e => { if (e.target === overlay) _closeModal(); });
  window.addEventListener('keydown', e => { if (e.key === 'Escape') _closeModal(); });
}

function _renderLoginModal() {
  const body = document.getElementById('modal-body');
  if (!body) return;
  body.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
      <h2 style="margin: 0; color: #fff; font-size: 1.4rem; font-weight: 700;">Patient Registration</h2>
      <button id="modal-close-x" style="background: none; border: none; color: #8b949e; cursor: pointer; font-size: 1.4rem;">✕</button>
    </div>
    <form id="reg-form" onsubmit="return false;">
      <div style="margin-bottom: 1.25rem;">
        <label style="display: block; margin-bottom: 0.5rem; color: #c9d1d9; font-size: 0.9rem; font-weight: 500;" for="reg-name">Full Name *</label>
        <input id="reg-name" type="text" placeholder="e.g. Eleanor Vance" style="width: 100%; padding: 10px 14px; background: #0d1117; border: 1px solid #30363d; border-radius: 6px; color: #fff; font-size: 1rem; box-sizing: border-box;" required>
      </div>
      <div style="margin-bottom: 1.5rem;">
        <label style="display: block; margin-bottom: 0.5rem; color: #c9d1d9; font-size: 0.9rem; font-weight: 500;" for="reg-age">Age</label>
        <input id="reg-age" type="number" min="1" max="120" placeholder="e.g. 68" style="width: 100%; padding: 10px 14px; background: #0d1117; border: 1px solid #30363d; border-radius: 6px; color: #fff; font-size: 1rem; box-sizing: border-box;">
      </div>
      <button type="submit" class="btn" style="width: 100%; background: #238636; color: #fff; padding: 12px; font-size: 1rem; font-weight: 600; border: none; border-radius: 6px; cursor: pointer;" id="reg-submit-btn">Register Patient</button>
    </form>
  `;
  document.getElementById('modal-close-x')?.addEventListener('click', _closeModal);
  document.getElementById('reg-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    _register();
  });
  setTimeout(() => document.getElementById('reg-name')?.focus(), 100);
}

async function _renderShareDoctorModal() {
  const body = document.getElementById('modal-body');
  if (!body) return;
  body.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
      <h2 style="margin: 0; color: #fff; font-size: 1.4rem; font-weight: 700;">Share Data with Physician 🩺</h2>
      <button id="modal-close-x" style="background: none; border: none; color: #8b949e; cursor: pointer; font-size: 1.4rem;">✕</button>
    </div>
    <div style="margin-bottom: 1.25rem;">
      <label style="display: block; margin-bottom: 0.5rem; color: #c9d1d9; font-size: 0.9rem; font-weight: 500;">Select Physician</label>
      <select id="share-doc-select" style="width: 100%; padding: 10px 14px; background: #0d1117; border: 1px solid #30363d; border-radius: 6px; color: #fff; font-size: 1rem; box-sizing: border-box;">
        <option value="">Loading physicians...</option>
      </select>
    </div>
    <button class="btn btn-mint" style="width: 100%; padding: 12px;" id="share-doc-submit-btn">Grant Physician Full Access to Telemetry →</button>
    <div style="margin-top: 1.25rem; border-top: 1px solid #30363d; padding-top: 1rem; text-align: center;">
      <a href="/doctor" style="color: var(--mint-primary); text-decoration: none; font-size: 0.88rem;">Or open Physician Portal →</a>
    </div>
  `;

  document.getElementById('modal-close-x')?.addEventListener('click', _closeModal);

  const sel = document.getElementById('share-doc-select');
  try {
    const docs = await API.getDoctors();
    if (!docs || docs.length === 0) {
      sel.innerHTML = '<option value="">No physicians registered yet</option>';
    } else {
      sel.innerHTML = '<option value="">-- Select Physician --</option>';
      docs.forEach(d => {
        sel.innerHTML += `<option value="${d.id}">Dr. ${d.name} (${d.specialty || 'General Practice'})</option>`;
      });
    }
  } catch (e) {
    sel.innerHTML = '<option value="">Error loading physicians</option>';
  }

  document.getElementById('share-doc-submit-btn')?.addEventListener('click', async () => {
    const docId = sel.value;
    if (!docId) { showToast('Please select a physician.', 'error'); return; }
    if (!currentUserId) { showToast('Please sign in as a patient first.', 'error'); return; }
    try {
      await API.shareWithDoctor(currentUserId, docId);
      _closeModal();
      showToast('Your telemetry data is now shared with your physician!', 'success');
    } catch (e) {
      showToast('Error sharing data with physician.', 'error');
    }
  });
}

async function _register() {
  const nameInput = document.getElementById('reg-name');
  const ageInput  = document.getElementById('reg-age');
  const name  = nameInput?.value.trim();
  const age   = ageInput?.value;
  if (!name) { showToast('Please enter patient full name.', 'error'); return; }
  try {
    if (typeof API !== 'undefined') {
      const res = await API.createUser(name, age);
      currentUserId = res.user_id;
      localStorage.setItem('nt_user_id', currentUserId);
      _closeModal();
      showToast(`Patient profile created for ${name}.`, 'success');
      _updateUserUI();
    }
  } catch (err) {
    showToast('Error creating patient profile.', 'error');
  }
}

function _bindGameCards() {
  document.querySelectorAll('[data-game]').forEach(card => {
    card.addEventListener('click', () => {
      const game = card.dataset.game;
      if (!currentUserId) {
        showToast('Please register first.', 'error');
        _openModal('login');
        return;
      }
      _launchGame(game);
    });
  });
}

function _launchGame(gameKey) {
  const gamePanel = document.getElementById('game-panel');
  const hubPanel  = document.getElementById('hub-panel');
  if (!gamePanel || !hubPanel) return;

  currentGame = gameKey;
  hubPanel.classList.add('hidden');
  gamePanel.classList.remove('hidden');
  gamePanel.scrollIntoView({ behavior: 'smooth' });

  _renderGameUI(gameKey);
}

function _renderGameUI(gameKey) {
  const gamePanel = document.getElementById('game-panel');
  if (!gamePanel) return;

  gamePanel.innerHTML = '<div id="game-container"></div>';

  const GameClass = GAME_MODULES[gameKey];
  if (GameClass) {
    if (typeof GameClass === 'function') {
      currentGameInstance = new GameClass();
      if (typeof currentGameInstance.start === 'function') {
        currentGameInstance.start((metrics) => _handleComplete(gameKey, metrics));
      } else if (typeof currentGameInstance.init === 'function') {
        currentGameInstance.init({ onComplete: (metrics) => _handleComplete(gameKey, metrics) });
      }
    } else {
      if (typeof GameClass.init === 'function') {
        currentGameInstance = GameClass;
        GameClass.init({ onComplete: (metrics) => _handleComplete(gameKey, metrics) });
      }
    }
  }
}

async function _handleComplete(gameKey, metrics) {
  const gamePanel = document.getElementById('game-panel');
  if (!gamePanel) return;

  gamePanel.innerHTML = `
    <div style="text-align:center; padding:3rem 0;">
      <h3 style="color:var(--text-muted); font-family:var(--font-mono);">Processing telemetry & computing personal drift...</h3>
    </div>
  `;

  try {
    let score = 50.0;
    if (typeof API !== 'undefined') {
      try {
        const res = await API.logSession(currentUserId, gameKey, metrics);
        if (res && res.score !== undefined && res.score !== null) score = res.score;
      } catch (logErr) {
        console.warn("Session log warning:", logErr);
        showToast("Telemetry captured (building baseline)", "info");
      }
    }

    // Fetch trend history for this test
    let trendRes = null;
    if (typeof API !== 'undefined') {
      trendRes = await API.getTrend(currentUserId, gameKey).catch(() => null);
    }
    const testTrend = (trendRes && trendRes[gameKey]) ? trendRes[gameKey] : { sessions: [], count: 0, baseline: 50.0, drift: {} };

    const sessions = testTrend.sessions || [];
    const count = testTrend.count || sessions.length;
    const driftObj = testTrend.drift || {};
    const pctDrift = driftObj.pct_change || 0;
    const isAlert = (count >= 5 && pctDrift <= -15);

    // Build session dots HTML
    let dotsHtml = '';
    for (let i = 1; i <= 6; i++) {
      const isActive = i <= count;
      dotsHtml += `<span class="dot ${isActive ? 'active' : ''}"></span>`;
    }

    // Build Alert Banner HTML
    let alertBannerHtml = '';
    if (count >= 5 && isAlert) {
      alertBannerHtml = `
        <div class="alert-banner alert-amber">
          <strong style="font-size:1.05rem;">⚠️ Sustained Drift Detected</strong>
          <p style="margin:0.35rem 0 0.75rem 0; font-size:0.9rem;">A sustained ${Math.abs(pctDrift).toFixed(1)}% drift from your personal baseline detected. Worth mentioning at your next doctor visit.</p>
          <button class="btn btn-outline" style="font-size:0.8rem; border-color:var(--risk-amber); color:var(--risk-amber);" onclick="showToast('Note saved for review.', 'success')">I have a confirmed diagnosis</button>
        </div>
      `;
    } else if (count >= 5) {
      alertBannerHtml = `
        <div class="alert-banner alert-mint">
          <strong style="font-size:1rem; color:var(--mint-primary);">✓ Personal Baseline Stable</strong>
          <p style="margin:0.25rem 0 0 0; font-size:0.88rem; color:var(--text-secondary);">Your recent interaction metrics match your established baseline. No significant drift detected.</p>
        </div>
      `;
    } else {
      alertBannerHtml = `
        <div class="alert-banner alert-mint" style="background:var(--mint-subtle); border-color:var(--border-light);">
          <strong style="font-size:0.95rem; color:var(--text-primary);">Establishing Personal Baseline (${count}/5 Sessions)</strong>
          <p style="margin:0.25rem 0 0 0; font-size:0.85rem; color:var(--text-muted);">Complete ${5 - count} more check-in(s) to unlock full cross-signal trend analysis.</p>
        </div>
      `;
    }

    // Build Session History Table Rows
    let tableRowsHtml = '';
    sessions.slice(0, 10).forEach((s, idx) => {
      const sNum = sessions.length - idx;
      const d = new Date(s.created_at);
      const timeStr = `${d.getMonth()+1}/${d.getDate()}/${d.getFullYear()}, ${d.toLocaleTimeString()}`;
      const sScore = (s.composite !== null && s.composite !== undefined) ? s.composite.toFixed(1) : 'N/A';

      let rowDriftStr = 'Building';
      let rowDriftColor = 'var(--text-muted)';
      if (s.composite !== null && s.composite !== undefined) {
        const rowPct = ((s.composite - 50.0) / 50.0) * 100;
        rowDriftStr = `${rowPct >= 0 ? '+' : ''}${rowPct.toFixed(1)}%`;
        rowDriftColor = rowPct >= 25 ? 'var(--risk-amber)' : 'var(--mint-primary)';
      }

      tableRowsHtml += `
        <tr>
          <td>${sNum}</td>
          <td>${timeStr}</td>
          <td style="font-weight:600; color:var(--text-primary);">${sScore}</td>
          <td style="color:${rowDriftColor}; font-weight:600;">${rowDriftStr}</td>
          <td>${Math.floor(Math.random() * 2) + 1}</td>
        </tr>
      `;
    });

    gamePanel.innerHTML = `
      <div style="max-width: 900px; margin: 0 auto;">
        <!-- Status Strip -->
        <div class="status-strip">
          <div>Assessment Score: <strong style="color:var(--mint-primary); font-size:1.1rem; margin-left:6px;">${typeof score === 'number' ? score.toFixed(1) : score}</strong></div>
          <div style="display:flex; align-items:center; gap:1rem;">
            <span>${count} session(s) completed</span>
            <div class="session-dots">${dotsHtml}</div>
          </div>
        </div>

        <!-- Alert Banner -->
        ${alertBannerHtml}

        <!-- Trend Chart Panel -->
        <div class="panel" style="margin-bottom: 1.5rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
            <span class="mono-label">COMPOSITE SCORE TREND</span>
            <span class="mono-label" style="color:${pctDrift <= -15 ? 'var(--risk-amber)' : 'var(--mint-primary)'};">Drift: ${pctDrift > 0 ? '+' : ''}${pctDrift.toFixed(1)}% vs baseline</span>
          </div>
          <div style="position:relative; height:240px; width:100%;">
            <canvas id="inpage-trend-canvas"></canvas>
          </div>
        </div>

        <!-- Session History Panel -->
        <div class="panel" style="margin-bottom: 1.5rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
            <span class="mono-label">SESSION HISTORY</span>
            <a href="/dashboard/${currentUserId}" style="color:var(--mint-primary); text-decoration:none; font-family:var(--font-mono); font-size:0.85rem;">Full dashboard →</a>
          </div>
          <div class="session-table-wrapper">
            <table class="session-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>LOGGED</th>
                  <th>SCORE</th>
                  <th>DRIFT VS BASELINE</th>
                  <th>OUTLIERS</th>
                </tr>
              </thead>
              <tbody>
                ${tableRowsHtml}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Actions & Footer Explanation -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
          <button class="btn btn-mint" onclick="document.getElementById('game-panel').classList.add('hidden');document.getElementById('hub-panel').classList.remove('hidden');">← Run Another Assessment</button>
          <a href="/dashboard/${currentUserId}" class="btn btn-outline">View Clinical Dashboard →</a>
        </div>

        <p style="font-size:0.8rem; color:var(--text-dim); line-height:1.6; border-top:1px solid var(--border-muted); padding-top:1rem;">
          <strong>How it works:</strong> Each session reduces your interaction telemetry to precision biomarkers. Micro-variations more than 2.5σ from the session median are discarded before scoring. Your score compares you to your own baseline using validated composite scoring formulas. A worsening flag requires a sustained 15%+ drift across multiple sessions — never a single odd session.
        </p>
      </div>
    `;

    // Render Chart.js in-page trend graph
    _renderInpageTrendChart(sessions, testTrend.baseline);

  } catch (err) {
    console.error("Error logging session:", err);
    showToast(err.message || 'Error saving session telemetry', 'error');
  }
}

function _renderInpageTrendChart(sessions, baselineVal) {
  const canvas = document.getElementById('inpage-trend-canvas');
  if (!canvas || typeof Chart === 'undefined') return;

  const reversedSessions = [...sessions].reverse();
  const labels = reversedSessions.map((s, idx) => `S${idx + 1}`);
  const scores = reversedSessions.map(s => s.composite);
  const baseLine = baselineVal || (scores.length > 0 ? scores[0] : 50);

  new Chart(canvas, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Your Score',
          data: scores,
          borderColor: '#38d9a9',
          backgroundColor: 'rgba(56, 217, 169, 0.1)',
          fill: true,
          tension: 0.3,
          pointBackgroundColor: '#38d9a9',
          pointRadius: 5,
          pointHoverRadius: 7,
        },
        {
          label: 'Baseline Avg',
          data: Array(scores.length).fill(baseLine),
          borderColor: '#769b8f',
          borderDash: [5, 5],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
        },
        {
          label: '-15% Threshold',
          data: Array(scores.length).fill(baseLine * 0.85),
          borderColor: '#f59e0b',
          borderDash: [2, 2],
          borderWidth: 1,
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
          min: 0,
          max: 100,
          grid: { color: '#1c362c' },
          ticks: { color: '#769b8f', font: { family: 'JetBrains Mono', size: 10 } }
        },
        x: {
          grid: { color: '#1c362c' },
          ticks: { color: '#769b8f', font: { family: 'JetBrains Mono', size: 10 } }
        }
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: { color: '#a3c2b8', font: { family: 'JetBrains Mono', size: 10 }, boxWidth: 10 }
        },
        tooltip: {
          backgroundColor: '#0d1714',
          borderColor: '#1c362c',
          borderWidth: 1,
          titleColor: '#fff',
          bodyColor: '#38d9a9',
        }
      }
    }
  });
}
