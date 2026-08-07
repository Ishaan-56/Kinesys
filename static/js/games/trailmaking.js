/* =============================================================
   games/trailmaking.js – Trail Making Test Part A & B
   Alzheimer's executive function & task switching marker
   ============================================================= */

const TrailMakingGame = (() => {
  let onCompleteCallback = null;
  let isActive = false;
  let part = 'A';
  let currentTargetIndex = 0;
  let errors = 0;
  let startTime = 0;
  let timeA = 0;
  let timeB = 0;
  let lastClickTime = 0;
  let clickedPoints = [];

  let metrics = {
    time_a_ms: 0,
    time_b_ms: 0,
    errors: 0,
    inter_click_intervals: [],
    trials: []
  };

  let canvas = null;
  let ctx = null;
  let nodes = [];

  const PART_A_TARGETS = ['1','2','3','4','5','6','7','8','9','10','11','12'];
  const PART_B_TARGETS = ['1','A','2','B','3','C','4','D','5','E','6','F'];

  function init(opts) {
    onCompleteCallback = opts.onComplete;
    const containerEl = document.getElementById('game-container');
    if (!containerEl) return;

    _resetState();
    _renderUI(containerEl);
    _bindEvents();
    _startPart('A');
  }

  function _resetState() {
    isActive = true;
    part = 'A';
    currentTargetIndex = 0;
    errors = 0;
    startTime = 0;
    timeA = 0;
    timeB = 0;
    clickedPoints = [];
    metrics = { time_a_ms: 0, time_b_ms: 0, errors: 0, inter_click_intervals: [], trials: [] };
  }

  function _renderUI(containerEl) {
    containerEl.innerHTML = `
      <div style="max-width: 850px; margin: 0 auto;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
          <div>
            <h2 style="font-size: 1.6rem; font-weight: 700; color: #fff; margin: 0 0 0.25rem 0;">Trail Connect</h2>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0;">Trail Making Test Part A & B for executive function & switching</p>
          </div>
          <button id="trail-cancel-btn" class="btn btn-outline" style="font-size: 0.82rem; padding: 0.4rem 0.9rem;">Cancel Test</button>
        </div>

        <!-- Status Strip -->
        <div class="status-strip">
          <span id="trail-instruction" style="color: var(--text-primary);">Part A: Connect numbers in numerical order (1 → 2 → 3...)</span>
          <div style="display:flex; gap:1.5rem; align-items:center;">
            <span class="mono-label" id="trail-part-badge" style="color: var(--mint-primary);">PART A</span>
            <span class="mono-label" id="trail-error-display" style="color: var(--risk-red);">Errors: 0</span>
          </div>
        </div>

        <!-- Canvas Area -->
        <div class="panel text-center" style="padding: 1rem; margin-bottom: 1.5rem; text-align: center;">
          <canvas id="trail-canvas" width="760" height="440" style="background: var(--bg-input); border: 1px solid var(--border-light); border-radius: 8px; cursor: pointer; display: block; margin: 0 auto;"></canvas>
        </div>

        <!-- Live Technical Telemetry Panel -->
        <div class="panel" style="background: var(--bg-surface); padding: 1.25rem;">
          <div class="mono-label" style="margin-bottom: 0.75rem; color: var(--mint-primary);">LIVE CLINICAL TELEMETRY</div>
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; font-family: var(--font-mono); text-align: center;">
            <div style="background: var(--bg-input); padding: 10px; border-radius: 6px; border: 1px solid var(--border-light);">
              <div style="font-size: 0.7rem; color: var(--text-muted);">PART A TIME</div>
              <div id="live-time-a" style="font-size: 1.1rem; color: var(--mint-primary); font-weight: 600; margin-top: 2px;">-- s</div>
            </div>
            <div style="background: var(--bg-input); padding: 10px; border-radius: 6px; border: 1px solid var(--border-light);">
              <div style="font-size: 0.7rem; color: var(--text-muted);">PART B TIME</div>
              <div id="live-time-b" style="font-size: 1.1rem; color: var(--mint-primary); font-weight: 600; margin-top: 2px;">-- s</div>
            </div>
            <div style="background: var(--bg-input); padding: 10px; border-radius: 6px; border: 1px solid var(--border-light);">
              <div style="font-size: 0.7rem; color: var(--text-muted);">EXECUTIVE B/A RATIO</div>
              <div id="live-ba-ratio" style="font-size: 1.1rem; color: var(--mint-primary); font-weight: 600; margin-top: 2px;">--</div>
            </div>
            <div style="background: var(--bg-input); padding: 10px; border-radius: 6px; border: 1px solid var(--border-light);">
              <div style="font-size: 0.7rem; color: var(--text-muted);">ERRORS</div>
              <div id="live-trail-errors" style="font-size: 1.1rem; color: var(--mint-primary); font-weight: 600; margin-top: 2px;">0</div>
            </div>
          </div>
        </div>
      </div>
    `;

    canvas = document.getElementById('trail-canvas');
    if (canvas) {
      ctx = canvas.getContext('2d');
    }
  }

  function _startPart(p) {
    part = p;
    currentTargetIndex = 0;
    clickedPoints = [];
    const targets = (part === 'A') ? PART_A_TARGETS : PART_B_TARGETS;

    const instrEl = document.getElementById('trail-instruction');
    const badgeEl = document.getElementById('trail-part-badge');

    if (badgeEl) badgeEl.textContent = `PART ${part}`;
    if (instrEl) {
      if (part === 'A') instrEl.textContent = 'Part A: Click circles in order (1 → 2 → 3 ... → 12)';
      else instrEl.textContent = 'Part B: Alternating numbers & letters (1 → A → 2 → B ... → 6 → F)';
    }

    _generateNodes(targets);
    startTime = performance.now();
    lastClickTime = startTime;
    _draw();
  }

  function _generateNodes(targets) {
    nodes = [];
    const margin = 50;
    const w = canvas.width - margin * 2;
    const h = canvas.height - margin * 2;

    targets.forEach((label, idx) => {
      let x, y, overlap;
      let tries = 0;
      do {
        x = margin + Math.random() * w;
        y = margin + Math.random() * h;
        overlap = nodes.some(n => Math.hypot(n.x - x, n.y - y) < 55);
        tries++;
      } while (overlap && tries < 200);

      nodes.push({ label, x, y, idx });
    });
  }

  function _draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (clickedPoints.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = '#38d9a9';
      ctx.lineWidth = 3;
      for (let i = 0; i < clickedPoints.length; i++) {
        if (i === 0) ctx.moveTo(clickedPoints[i].x, clickedPoints[i].y);
        else ctx.lineTo(clickedPoints[i].x, clickedPoints[i].y);
      }
      ctx.stroke();
    }

    nodes.forEach((node) => {
      const isClicked = node.idx < currentTargetIndex;
      const isCurrent = node.idx === currentTargetIndex;

      ctx.beginPath();
      ctx.arc(node.x, node.y, 22, 0, Math.PI * 2);

      if (isClicked) {
        ctx.fillStyle = '#1c362c';
        ctx.strokeStyle = '#26a676';
        ctx.lineWidth = 2;
      } else if (isCurrent) {
        ctx.fillStyle = 'rgba(56, 217, 169, 0.15)';
        ctx.strokeStyle = '#38d9a9';
        ctx.lineWidth = 3;
      } else {
        ctx.fillStyle = '#0d1714';
        ctx.strokeStyle = '#1c362c';
        ctx.lineWidth = 1.5;
      }
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isCurrent ? '#38d9a9' : (isClicked ? '#769b8f' : '#e6f4f0');
      ctx.font = '600 16px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.label, node.x, node.y);
    });
  }

  function _bindEvents() {
    if (!canvas) return;
    canvas.addEventListener('click', _handleClick);

    const cancelBtn = document.getElementById('trail-cancel-btn');
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

  function _handleClick(e) {
    if (!isActive) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const now = performance.now();

    const clickedNode = nodes.find(n => Math.hypot(n.x - x, n.y - y) <= 25);
    if (!clickedNode) return;

    const targets = (part === 'A') ? PART_A_TARGETS : PART_B_TARGETS;

    if (clickedNode.idx === currentTargetIndex) {
      const ici = now - lastClickTime;
      metrics.inter_click_intervals.push(ici);
      lastClickTime = now;

      clickedPoints.push({ x: clickedNode.x, y: clickedNode.y });
      currentTargetIndex++;
      metrics.trials.push({ type: 'click', part, target: clickedNode.label, correct: true, timestamp: Math.round(now) });

      if (part === 'A') {
        timeA = now - startTime;
        metrics.time_a_ms = Math.round(timeA);
      } else {
        timeB = now - startTime;
        metrics.time_b_ms = Math.round(timeB);
      }

      _updateLiveTelemetry();

      if (currentTargetIndex >= targets.length) {
        if (part === 'A') {
          setTimeout(() => _startPart('B'), 800);
        } else {
          setTimeout(_finish, 500);
        }
      }
    } else {
      errors++;
      metrics.errors++;
      metrics.trials.push({ type: 'click', part, target: clickedNode.label, correct: false, timestamp: Math.round(now) });

      const errEl = document.getElementById('trail-error-display');
      if (errEl) errEl.textContent = `Errors: ${errors}`;
      _updateLiveTelemetry();
    }

    _draw();
  }

  function _updateLiveTelemetry() {
    const tAEl  = document.getElementById('live-time-a');
    const tBEl  = document.getElementById('live-time-b');
    const ratioEl = document.getElementById('live-ba-ratio');
    const errEl = document.getElementById('live-trail-errors');

    if (metrics.time_a_ms > 0) {
      if (tAEl) tAEl.textContent = `${(metrics.time_a_ms / 1000).toFixed(1)} s`;
    }
    if (metrics.time_b_ms > 0) {
      if (tBEl) tBEl.textContent = `${(metrics.time_b_ms / 1000).toFixed(1)} s`;
    }
    if (metrics.time_a_ms > 0 && metrics.time_b_ms > 0) {
      const ratio = metrics.time_b_ms / metrics.time_a_ms;
      if (ratioEl) ratioEl.textContent = ratio.toFixed(2);
    }
    if (errEl) errEl.textContent = metrics.errors;
  }

  function _finish() {
    if (!isActive) return;
    isActive = false;

    if (onCompleteCallback) {
      onCompleteCallback(metrics);
    }
  }

  function destroy() {
    isActive = false;
    if (canvas) canvas.removeEventListener('click', _handleClick);
  }

  return { init, destroy };
})();
