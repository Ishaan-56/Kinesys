/* =============================================================
   games/steadyhold.js – Steady Cursor Hold Test
   Huntington's chorea & Parkinson's postural tremor marker
   ============================================================= */

const SteadyHoldGame = (() => {
  let onCompleteCallback = null;
  let isActive = false;
  let hasStarted = false;
  let startTime = 0;
  let lastPos = null;
  let sampleTimer = null;
  let countdownTimer = null;

  let metrics = {
    distances: [],
    drift_path_length: 0,
    max_drift: 0,
    trials: []
  };

  let elements = {};
  let targetX = 0;
  let targetY = 0;
  let holdDurationMs = 10000; // 10s

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
    lastPos = null;
    metrics = { distances: [], drift_path_length: 0, max_drift: 0, trials: [] };
  }

  function _renderUI(containerEl) {
    containerEl.innerHTML = `
      <div style="max-width: 850px; margin: 0 auto;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
          <div>
            <h2 style="font-size: 1.6rem; font-weight: 700; color: #fff; margin: 0 0 0.25rem 0;">Steady Hold</h2>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0;">Cursor hold test for involuntary tremor & postural stability</p>
          </div>
          <button id="steadyhold-cancel-btn" class="btn btn-outline" style="font-size: 0.82rem; padding: 0.4rem 0.9rem;">Cancel Test</button>
        </div>

        <!-- Status Strip -->
        <div class="status-strip">
          <span id="hold-instruction" style="color: var(--text-primary);">Move your cursor into the center target circle to begin 10s hold.</span>
          <span class="mono-label" id="hold-timer-display" style="color: var(--mint-primary);">10.0s</span>
        </div>

        <!-- Hold Target Area -->
        <div class="panel text-center" style="padding: 1.5rem; margin-bottom: 1.5rem; text-align: center;">
          <div id="hold-area" style="width: 100%; height: 380px; background: var(--bg-input); border: 1px solid var(--border-light); border-radius: 8px; position: relative; overflow: hidden; cursor: crosshair; display: flex; align-items: center; justify-content: center; margin: 0 auto;">
            <div id="hold-target" style="width: 100px; height: 100px; border: 3px solid var(--mint-primary); border-radius: 50%; position: absolute; pointer-events: none; transition: border-color 0.15s ease; box-shadow: 0 0 15px var(--mint-glow);"></div>
          </div>
          <div style="width: 100%; height: 6px; background: var(--bg-surface); margin-top: 1rem; border-radius: 3px; overflow: hidden;">
            <div id="hold-progress" style="width: 0%; height: 100%; background: var(--mint-primary); transition: width 0.1s linear;"></div>
          </div>
        </div>

        <!-- Live Technical Telemetry Panel -->
        <div class="panel" style="background: var(--bg-surface); padding: 1.25rem;">
          <div class="mono-label" style="margin-bottom: 0.75rem; color: var(--mint-primary);">LIVE CLINICAL TELEMETRY</div>
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; font-family: var(--font-mono); text-align: center;">
            <div style="background: var(--bg-input); padding: 10px; border-radius: 6px; border: 1px solid var(--border-light);">
              <div style="font-size: 0.7rem; color: var(--text-muted);">RMS DRIFT</div>
              <div id="live-rms-drift" style="font-size: 1.1rem; color: var(--mint-primary); font-weight: 600; margin-top: 2px;">-- px</div>
            </div>
            <div style="background: var(--bg-input); padding: 10px; border-radius: 6px; border: 1px solid var(--border-light);">
              <div style="font-size: 0.7rem; color: var(--text-muted);">MAX DRIFT</div>
              <div id="live-max-drift" style="font-size: 1.1rem; color: var(--mint-primary); font-weight: 600; margin-top: 2px;">-- px</div>
            </div>
            <div style="background: var(--bg-input); padding: 10px; border-radius: 6px; border: 1px solid var(--border-light);">
              <div style="font-size: 0.7rem; color: var(--text-muted);">PATH LENGTH</div>
              <div id="live-path-length" style="font-size: 1.1rem; color: var(--mint-primary); font-weight: 600; margin-top: 2px;">-- px</div>
            </div>
            <div style="background: var(--bg-input); padding: 10px; border-radius: 6px; border: 1px solid var(--border-light);">
              <div style="font-size: 0.7rem; color: var(--text-muted);">SAMPLES</div>
              <div id="live-hold-samples" style="font-size: 1.1rem; color: var(--mint-primary); font-weight: 600; margin-top: 2px;">0</div>
            </div>
          </div>
        </div>
      </div>
    `;

    elements.area = document.getElementById('hold-area');
    elements.target = document.getElementById('hold-target');
    elements.progress = document.getElementById('hold-progress');
    elements.instruction = document.getElementById('hold-instruction');
    elements.timer = document.getElementById('hold-timer-display');

    if (elements.area) {
      targetX = elements.area.offsetWidth / 2;
      targetY = elements.area.offsetHeight / 2;
    }
  }

  function _bindEvents() {
    if (!elements.area) return;
    elements.area.addEventListener('mousemove', _handleMouseMove);
    elements.area.addEventListener('mouseleave', _handleMouseLeave);

    const cancelBtn = document.getElementById('steadyhold-cancel-btn');
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

  function _handleMouseMove(e) {
    if (!isActive) return;
    const rect = elements.area.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    targetX = elements.area.offsetWidth / 2;
    targetY = elements.area.offsetHeight / 2;
    const distToCenter = Math.hypot(x - targetX, y - targetY);

    if (!hasStarted) {
      if (distToCenter <= 50) {
        _startGame(x, y);
      }
      return;
    }

    if (lastPos) {
      const stepDist = Math.hypot(x - lastPos.x, y - lastPos.y);
      metrics.drift_path_length += stepDist;
    }
    lastPos = { x, y };

    if (elements.target) {
      if (distToCenter <= 50) {
        elements.target.style.borderColor = 'var(--mint-primary)';
        elements.target.style.boxShadow = '0 0 20px var(--mint-glow)';
      } else {
        elements.target.style.borderColor = 'var(--risk-red)';
        elements.target.style.boxShadow = '0 0 20px rgba(255, 123, 114, 0.4)';
      }
    }
  }

  function _handleMouseLeave() {
    if (isActive && hasStarted) {
      metrics.drift_path_length += 100;
    }
  }

  function _startGame(x, y) {
    hasStarted = true;
    startTime = performance.now();
    lastPos = { x, y };

    if (elements.instruction) elements.instruction.textContent = 'Hold steady in the circle!';

    sampleTimer = setInterval(() => {
      if (!isActive || !hasStarted || !lastPos) return;
      const now = performance.now();
      const dist = Math.hypot(lastPos.x - targetX, lastPos.y - targetY);

      metrics.distances.push(dist);
      metrics.max_drift = Math.max(metrics.max_drift, dist);
      metrics.trials.push({ type: 'sample', distance: dist, x: lastPos.x, y: lastPos.y, timestamp: now });

      _updateLiveTelemetry();
    }, 50);

    countdownTimer = setInterval(() => {
      if (!isActive || !hasStarted) return;
      const elapsed = performance.now() - startTime;
      const remaining = Math.max(0, holdDurationMs - elapsed);
      const pct = Math.min(100, (elapsed / holdDurationMs) * 100);

      if (elements.progress) elements.progress.style.width = `${pct}%`;
      if (elements.timer) elements.timer.textContent = `${(remaining / 1000).toFixed(1)}s`;

      if (remaining <= 0) {
        _finish();
      }
    }, 100);
  }

  function _updateLiveTelemetry() {
    const rmsEl  = document.getElementById('live-rms-drift');
    const maxEl  = document.getElementById('live-max-drift');
    const pathEl = document.getElementById('live-path-length');
    const smpEl  = document.getElementById('live-hold-samples');

    if (metrics.distances.length > 0) {
      const rms = Math.sqrt(metrics.distances.reduce((a, b) => a + b * b, 0) / metrics.distances.length);
      if (rmsEl) rmsEl.textContent = `${rms.toFixed(2)} px`;
    }
    if (maxEl) maxEl.textContent = `${metrics.max_drift.toFixed(1)} px`;
    if (pathEl) pathEl.textContent = `${Math.round(metrics.drift_path_length)} px`;
    if (smpEl) smpEl.textContent = metrics.distances.length;
  }

  function _finish() {
    if (!isActive) return;
    isActive = false;
    clearInterval(sampleTimer);
    clearInterval(countdownTimer);

    if (metrics.drift_path_length < 2) {
      metrics.static_warning = true;
      if (elements.instruction) {
        elements.instruction.textContent = '⚠️ Static cursor detected (mouse stationary). Please hold the mouse actively.';
      }
    }

    if (onCompleteCallback) {
      onCompleteCallback(metrics);
    }
  }

  function destroy() {
    isActive = false;
    clearInterval(sampleTimer);
    clearInterval(countdownTimer);
    if (elements.area) {
      elements.area.removeEventListener('mousemove', _handleMouseMove);
      elements.area.removeEventListener('mouseleave', _handleMouseLeave);
    }
  }

  return { init, destroy };
})();
