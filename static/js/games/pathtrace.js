/* =============================================================
   games/pathtrace.js – Archimedes Spiral Path Tracing Test
   Parkinson's tremor & movement smoothness marker
   ============================================================= */

const PathTraceGame = (() => {
  let onCompleteCallback = null;
  let isActive = false;
  let hasStarted = false;
  let startTime = 0;
  let lastSampleTime = 0;
  let lastPos = null;
  let lastVelocity = null;
  let userPath = [];

  let metrics = {
    deviations: [],
    velocities: [],
    jerks: [],
    duration_ms: 0,
    trials: []
  };

  let canvas = null;
  let ctx = null;
  let spiralPoints = [];

  function init(opts) {
    onCompleteCallback = opts.onComplete;
    const containerEl = document.getElementById('game-container');
    if (!containerEl) return;

    _resetState();
    _renderUI(containerEl);
    _bindEvents();
  }

  let latestX = 0;
  let latestY = 0;
  let rafId = null;

  function _resetState() {
    isActive = true;
    hasStarted = false;
    startTime = 0;
    lastSampleTime = 0;
    lastPos = null;
    lastVelocity = null;
    latestX = 0;
    latestY = 0;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    userPath = [];
    metrics = { deviations: [], velocities: [], jerks: [], duration_ms: 0, trials: [] };
  }

  function _renderUI(containerEl) {
    containerEl.innerHTML = `
      <div style="max-width: 850px; margin: 0 auto;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
          <div>
            <h2 style="font-size: 1.6rem; font-weight: 700; color: #fff; margin: 0 0 0.25rem 0;">Path Trace</h2>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0;">Spiral tracing test for tremor & movement smoothness</p>
          </div>
          <button id="pathtrace-cancel-btn" class="btn btn-outline" style="font-size: 0.82rem; padding: 0.4rem 0.9rem;">Cancel Test</button>
        </div>

        <!-- Status Strip -->
        <div class="status-strip">
          <span id="pathtrace-instruction" style="color: var(--text-primary);">Click the cyan dot at the center to begin tracing.</span>
          <span class="mono-label" id="pathtrace-dev-display" style="color: var(--mint-primary);">Mean Dev: 0.0 px</span>
        </div>

        <!-- Canvas Box -->
        <div class="panel text-center" style="padding: 1rem; margin-bottom: 1.5rem; text-align: center;">
          <canvas id="pathtrace-canvas" width="760" height="440" style="background: var(--bg-input); border: 1px solid var(--border-light); border-radius: 8px; cursor: crosshair; display: block; margin: 0 auto;"></canvas>
        </div>

        <!-- Live Technical Telemetry Panel -->
        <div class="panel" style="background: var(--bg-surface); padding: 1.25rem;">
          <div class="mono-label" style="margin-bottom: 0.75rem; color: var(--mint-primary);">LIVE CLINICAL TELEMETRY</div>
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; font-family: var(--font-mono); text-align: center;">
            <div style="background: var(--bg-input); padding: 10px; border-radius: 6px; border: 1px solid var(--border-light);">
              <div style="font-size: 0.7rem; color: var(--text-muted);">MEAN DEVIATION</div>
              <div id="live-mean-dev" style="font-size: 1.1rem; color: var(--mint-primary); font-weight: 600; margin-top: 2px;">-- px</div>
            </div>
            <div style="background: var(--bg-input); padding: 10px; border-radius: 6px; border: 1px solid var(--border-light);">
              <div style="font-size: 0.7rem; color: var(--text-muted);">RMS JERK</div>
              <div id="live-rms-jerk" style="font-size: 1.1rem; color: var(--mint-primary); font-weight: 600; margin-top: 2px;">--</div>
            </div>
            <div style="background: var(--bg-input); padding: 10px; border-radius: 6px; border: 1px solid var(--border-light);">
              <div style="font-size: 0.7rem; color: var(--text-muted);">VELOCITY</div>
              <div id="live-velocity" style="font-size: 1.1rem; color: var(--mint-primary); font-weight: 600; margin-top: 2px;">-- px/s</div>
            </div>
            <div style="background: var(--bg-input); padding: 10px; border-radius: 6px; border: 1px solid var(--border-light);">
              <div style="font-size: 0.7rem; color: var(--text-muted);">SAMPLES</div>
              <div id="live-samples-count" style="font-size: 1.1rem; color: var(--mint-primary); font-weight: 600; margin-top: 2px;">0</div>
            </div>
          </div>
        </div>
      </div>
    `;

    canvas = document.getElementById('pathtrace-canvas');
    if (canvas) {
      ctx = canvas.getContext('2d');
      _generateSpiral();
      _draw();
    }
  }

  function _generateSpiral() {
    spiralPoints = [];
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const turns = 3;
    const a = 6;
    const b = 6.5;
    for (let theta = 0; theta < turns * 2 * Math.PI; theta += 0.05) {
      const r = a + b * theta;
      const x = centerX + r * Math.cos(theta);
      const y = centerY + r * Math.sin(theta);
      spiralPoints.push({ x, y });
    }
  }

  function _draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.beginPath();
    ctx.strokeStyle = '#1c362c';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 0; i < spiralPoints.length; i++) {
      if (i === 0) ctx.moveTo(spiralPoints[i].x, spiralPoints[i].y);
      else ctx.lineTo(spiralPoints[i].x, spiralPoints[i].y);
    }
    ctx.stroke();

    ctx.beginPath();
    ctx.strokeStyle = '#27483a';
    ctx.lineWidth = 2;
    for (let i = 0; i < spiralPoints.length; i++) {
      if (i === 0) ctx.moveTo(spiralPoints[i].x, spiralPoints[i].y);
      else ctx.lineTo(spiralPoints[i].x, spiralPoints[i].y);
    }
    ctx.stroke();

    if (userPath.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = '#38d9a9';
      ctx.lineWidth = 3;
      for (let i = 0; i < userPath.length; i++) {
        if (i === 0) ctx.moveTo(userPath[i].x, userPath[i].y);
        else ctx.lineTo(userPath[i].x, userPath[i].y);
      }
      ctx.stroke();
    }

    if (spiralPoints.length > 0) {
      const startPt = spiralPoints[0];
      const endPt = spiralPoints[spiralPoints.length - 1];

      ctx.beginPath();
      ctx.fillStyle = hasStarted ? '#26a676' : '#38d9a9';
      ctx.arc(startPt.x, startPt.y, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.strokeStyle = '#38d9a9';
      ctx.lineWidth = 2;
      ctx.arc(endPt.x, endPt.y, 12, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function _bindEvents() {
    if (!canvas) return;
    canvas.addEventListener('mousedown', _handleStartClick);
    canvas.addEventListener('mousemove', _handleMouseMove);

    const cancelBtn = document.getElementById('pathtrace-cancel-btn');
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

  function _getMinDistanceToSpiral(px, py) {
    let minSq = Infinity;
    for (let i = 0; i < spiralPoints.length; i++) {
      const dx = px - spiralPoints[i].x;
      const dy = py - spiralPoints[i].y;
      const sq = dx * dx + dy * dy;
      if (sq < minSq) minSq = sq;
    }
    return Math.sqrt(minSq);
  }

  function _handleStartClick(e) {
    if (!isActive || hasStarted) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const startPt = spiralPoints[0];
    const dist = Math.hypot(x - startPt.x, y - startPt.y);

    if (dist < 30) {
      hasStarted = true;
      startTime = performance.now();
      lastSampleTime = startTime;
      lastPos = { x, y };
      latestX = x;
      latestY = y;
      userPath.push({ x, y });

      const instrEl = document.getElementById('pathtrace-instruction');
      if (instrEl) instrEl.textContent = 'Trace outward to the target end circle!';
      _draw();
      _sampleLoop();
    }
  }

  function _handleMouseMove(e) {
    if (!isActive || !hasStarted || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    latestX = e.clientX - rect.left;
    latestY = e.clientY - rect.top;
  }

  function _sampleLoop() {
    if (!isActive || !hasStarted) return;

    const now = performance.now();
    const dt = (now - lastSampleTime) / 1000.0;

    if (dt >= 0.016) {
      const x = latestX;
      const y = latestY;

      userPath.push({ x, y });
      const dev = _getMinDistanceToSpiral(x, y);
      metrics.deviations.push(dev);

      const dist = Math.hypot(x - lastPos.x, y - lastPos.y);
      const vel = dist / dt;
      metrics.velocities.push(vel);

      if (lastVelocity !== null) {
        const accel = (vel - lastVelocity) / dt;
        metrics.jerks.push(Math.abs(accel));
      }

      lastPos = { x, y };
      lastVelocity = vel;
      lastSampleTime = now;

      metrics.trials.push({ type: 'sample', x, y, deviation: dev, velocity: vel, timestamp: now });

      _updateLiveTelemetry();
      _draw();

      const endPt = spiralPoints[spiralPoints.length - 1];
      if (Math.hypot(x - endPt.x, y - endPt.y) < 20 && userPath.length > 50) {
        _finish();
        return;
      }
    }

    rafId = requestAnimationFrame(_sampleLoop);
  }

  function _updateLiveTelemetry() {
    const devEl = document.getElementById('live-mean-dev');
    const jrkEl = document.getElementById('live-rms-jerk');
    const velEl = document.getElementById('live-velocity');
    const smpEl = document.getElementById('live-samples-count');

    if (metrics.deviations.length > 0) {
      const avgDev = metrics.deviations.reduce((a, b) => a + b, 0) / metrics.deviations.length;
      if (devEl) devEl.textContent = `${avgDev.toFixed(2)} px`;

      const lastVel = metrics.velocities.length > 0 ? metrics.velocities[metrics.velocities.length - 1] : 0;
      if (velEl) velEl.textContent = `${Math.round(lastVel)} px/s`;
    }

    if (metrics.jerks.length > 0) {
      const rmsJ = Math.sqrt(metrics.jerks.reduce((a, b) => a + b * b, 0) / metrics.jerks.length);
      if (jrkEl) jrkEl.textContent = rmsJ.toFixed(2);
    }

    if (smpEl) smpEl.textContent = metrics.deviations.length;
  }

  function _finish() {
    if (!isActive) return;
    isActive = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    metrics.duration_ms = Math.round(performance.now() - startTime);

    if (onCompleteCallback) {
      onCompleteCallback(metrics);
    }
  }

  function destroy() {
    isActive = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    if (canvas) {
      canvas.removeEventListener('mousedown', _handleStartClick);
      canvas.removeEventListener('mousemove', _handleMouseMove);
    }
  }

  return { init, destroy };
})();
