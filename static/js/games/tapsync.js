/* =============================================================
   games/tapsync.js – Alternating Key Tapping Test
   Parkinson's bradykinesia & rhythm consistency marker
   ============================================================= */

const TapSyncGame = (() => {
  let onCompleteCallback = null;
  let isActive = false;
  let hasStarted = false;
  let startTime = 0;
  let lastTapTime = 0;
  let lastKey = null;
  let timerInterval = null;
  let gameDuration = 10000; // 10 seconds

  let metrics = {
    intervals: [],
    tap_count: 0,
    wrong_key_count: 0,
    trials: []
  };

  let elements = {};

  function init(opts) {
    onCompleteCallback = opts.onComplete;
    const containerEl = document.getElementById('game-container');
    if (!containerEl) return;

    _resetState();
    _renderUI(containerEl);
    _bindEvents();
  }

  function _resetState() {
    isActive = true;
    hasStarted = false;
    startTime = 0;
    lastTapTime = 0;
    lastKey = null;
    metrics = { intervals: [], tap_count: 0, wrong_key_count: 0, trials: [] };
  }

  function _renderUI(containerEl) {
    containerEl.innerHTML = `
      <div style="max-width: 850px; margin: 0 auto;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
          <div>
            <h2 style="font-size: 1.6rem; font-weight: 700; color: #fff; margin: 0 0 0.25rem 0;">Tap Sync</h2>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0;">Alternating key tapping test for bradykinesia & motor rhythm</p>
          </div>
          <button id="tapsync-cancel-btn" class="btn btn-outline" style="font-size: 0.82rem; padding: 0.4rem 0.9rem;">Cancel Test</button>
        </div>

        <!-- Live Telemetry Canvas -->
        <div class="live-rhythm-box">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span class="mono-label">LIVE TAP RHYTHM – THIS SESSION</span>
            <span class="mono-label" id="tapsync-counter-display" style="color: var(--mint-primary);">0 taps captured</span>
          </div>
          <canvas id="live-tapsync-canvas" class="live-canvas" width="800" height="120"></canvas>
          <div class="mono-label" style="font-size: 0.7rem; color: var(--text-dim);">Each bar = inter-tap interval (ITI) between alternating key presses</div>
        </div>

        <!-- Assessment Area -->
        <div class="panel text-center" style="margin-bottom: 1.5rem; text-align: center;">
          <div class="mono-label" id="tapsync-timer-display" style="font-size: 2.2rem; color: var(--mint-primary); margin-bottom: 1rem;">10.0s</div>

          <div style="display: flex; justify-content: center; gap: 2rem; margin: 2rem 0;">
            <div id="key-indicator-f" style="width: 110px; height: 110px; border: 2px solid var(--border-light); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 3rem; font-weight: 700; color: var(--text-primary); font-family: var(--font-mono); background: var(--bg-input); transition: var(--transition);">F</div>
            <div id="key-indicator-j" style="width: 110px; height: 110px; border: 2px solid var(--border-light); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 3rem; font-weight: 700; color: var(--text-primary); font-family: var(--font-mono); background: var(--bg-input); transition: var(--transition);">J</div>
          </div>

          <p id="tapsync-instruction" style="font-size: 1rem; color: var(--text-secondary); font-family: var(--font-mono);">Press F or J to begin 10-second test</p>
        </div>

        <!-- Live Technical Telemetry Panel -->
        <div class="panel" style="background: var(--bg-surface); padding: 1.25rem;">
          <div class="mono-label" style="margin-bottom: 0.75rem; color: var(--mint-primary);">LIVE CLINICAL TELEMETRY</div>
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; font-family: var(--font-mono); text-align: center;">
            <div style="background: var(--bg-input); padding: 10px; border-radius: 6px; border: 1px solid var(--border-light);">
              <div style="font-size: 0.7rem; color: var(--text-muted);">MEAN ITI</div>
              <div id="live-mean-iti" style="font-size: 1.1rem; color: var(--mint-primary); font-weight: 600; margin-top: 2px;">-- ms</div>
            </div>
            <div style="background: var(--bg-input); padding: 10px; border-radius: 6px; border: 1px solid var(--border-light);">
              <div style="font-size: 0.7rem; color: var(--text-muted);">ITI CV (VARIANCE)</div>
              <div id="live-iti-cv" style="font-size: 1.1rem; color: var(--mint-primary); font-weight: 600; margin-top: 2px;">--</div>
            </div>
            <div style="background: var(--bg-input); padding: 10px; border-radius: 6px; border: 1px solid var(--border-light);">
              <div style="font-size: 0.7rem; color: var(--text-muted);">TAP COUNT</div>
              <div id="live-tap-count" style="font-size: 1.1rem; color: var(--mint-primary); font-weight: 600; margin-top: 2px;">0</div>
            </div>
            <div style="background: var(--bg-input); padding: 10px; border-radius: 6px; border: 1px solid var(--border-light);">
              <div style="font-size: 0.7rem; color: var(--text-muted);">WRONG KEYS</div>
              <div id="live-wrong-keys" style="font-size: 1.1rem; color: var(--mint-primary); font-weight: 600; margin-top: 2px;">0</div>
            </div>
          </div>
        </div>
      </div>
    `;

    elements.keyF = document.getElementById('key-indicator-f');
    elements.keyJ = document.getElementById('key-indicator-j');
    elements.timer = document.getElementById('tapsync-timer-display');
    elements.counter = document.getElementById('tapsync-counter-display');
    elements.instruction = document.getElementById('tapsync-instruction');
    _drawLiveCanvas();
  }

  function _bindEvents() {
    window.addEventListener('keydown', _handleKeyDown);

    const cancelBtn = document.getElementById('tapsync-cancel-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        destroy();
        const hubPanel  = document.getElementById('hub-panel');
        const gamePanel = document.getElementById('game-panel');
        if (gamePanel) gamePanel.classList.add('hidden');
        if (hubPanel) hubPanel.classList.remove('hidden');
      });
    }
  }

  function _handleKeyDown(e) {
    if (!isActive) return;
    if (e.code !== 'KeyF' && e.code !== 'KeyJ') return;

    const now = performance.now();
    const key = e.code === 'KeyF' ? 'f' : 'j';

    const el = key === 'f' ? elements.keyF : elements.keyJ;
    if (el) {
      el.style.borderColor = 'var(--mint-primary)';
      el.style.background = 'var(--mint-subtle)';
      el.style.boxShadow = 'var(--shadow-mint)';
      setTimeout(() => {
        if (el) {
          el.style.borderColor = 'var(--border-light)';
          el.style.background = 'var(--bg-input)';
          el.style.boxShadow = 'none';
        }
      }, 100);
    }

    if (!hasStarted) {
      hasStarted = true;
      startTime = now;
      lastTapTime = now;
      lastKey = key;
      if (elements.instruction) elements.instruction.textContent = 'Keep alternating F and J as fast as possible!';
      metrics.tap_count = 1;
      metrics.trials.push({ type: 'tap', key: key, timestamp: now, iti: 0 });
      _updateTimerDisplay(gameDuration);

      timerInterval = setInterval(() => {
        const elapsed = performance.now() - startTime;
        const remaining = Math.max(0, gameDuration - elapsed);
        _updateTimerDisplay(remaining);
        if (remaining <= 0) {
          _finish();
        }
      }, 100);
      return;
    }

    const iti = now - lastTapTime;
    if (iti < 50) return; // double press

    if (key === lastKey) {
      metrics.wrong_key_count++;
    } else {
      metrics.tap_count++;
      metrics.intervals.push(iti);
    }

    lastTapTime = now;
    lastKey = key;
    metrics.trials.push({ type: 'tap', key: key, timestamp: now, iti: iti });

    if (elements.counter) elements.counter.textContent = `${metrics.tap_count} taps captured`;
    _updateLiveTelemetry();
    _drawLiveCanvas();
  }

  function _updateLiveTelemetry() {
    const itiEl = document.getElementById('live-mean-iti');
    const cvEl  = document.getElementById('live-iti-cv');
    const tapEl = document.getElementById('live-tap-count');
    const wrgEl = document.getElementById('live-wrong-keys');

    if (metrics.intervals.length > 0) {
      const avgIti = metrics.intervals.reduce((a, b) => a + b, 0) / metrics.intervals.length;
      const variance = metrics.intervals.reduce((a, b) => a + Math.pow(b - avgIti, 2), 0) / metrics.intervals.length;
      const sd = Math.sqrt(variance);
      const cv = avgIti > 0 ? (sd / avgIti) : 0;

      if (itiEl) itiEl.textContent = `${Math.round(avgIti)} ms`;
      if (cvEl) cvEl.textContent = cv.toFixed(3);
    }

    if (tapEl) tapEl.textContent = metrics.tap_count;
    if (wrgEl) wrgEl.textContent = metrics.wrong_key_count;
  }

  function _updateTimerDisplay(remainingMs) {
    if (elements.timer) {
      elements.timer.textContent = `${(remainingMs / 1000).toFixed(1)}s`;
    }
  }

  function _drawLiveCanvas() {
    const canvas = document.getElementById('live-tapsync-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = '#1c362c';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h - 15);
    ctx.lineTo(w, h - 15);
    ctx.stroke();

    if (metrics.intervals.length === 0) return;

    const maxVal = Math.max(...metrics.intervals, 500);
    const barWidth = Math.max(3, Math.min(12, (w - 20) / metrics.intervals.length));
    const gap = 2;

    metrics.intervals.forEach((iti, i) => {
      const barHeight = Math.min(h - 25, (iti / maxVal) * (h - 30));
      const x = 10 + i * (barWidth + gap);
      const y = (h - 15) - barHeight;

      ctx.fillStyle = '#38d9a9';
      ctx.fillRect(x, y, barWidth, barHeight);
    });
  }

  function _finish() {
    if (!isActive) return;
    isActive = false;
    clearInterval(timerInterval);
    window.removeEventListener('keydown', _handleKeyDown);

    if (onCompleteCallback) {
      onCompleteCallback(metrics);
    }
  }

  function destroy() {
    isActive = false;
    clearInterval(timerInterval);
    window.removeEventListener('keydown', _handleKeyDown);
  }

  return { init, destroy };
})();
