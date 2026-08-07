/* =============================================================
   games/sequence.js – Corsi Block Spatial Working Memory Test
   Alzheimer's spatial working memory marker
   ============================================================= */

const SequenceGame = (() => {
  let onCompleteCallback = null;
  let isActive = false;
  let spanLength = 3;
  let maxSpanAchieved = 3;
  let attemptsAtSpan = 0;
  let currentSequence = [];
  let userSequence = [];
  let phase = 'idle';
  let sequenceStartTime = 0;

  let metrics = {
    max_span: 3,
    total_correct: 0,
    total_trials: 0,
    response_latencies: [],
    trials: []
  };

  let blocks = [];

  function init(opts) {
    onCompleteCallback = opts.onComplete;
    const containerEl = document.getElementById('game-container');
    if (!containerEl) return;

    _resetState();
    _renderUI(containerEl);
    _bindEvents();
    _nextTrial();
  }

  function _resetState() {
    isActive = true;
    spanLength = 3;
    maxSpanAchieved = 3;
    attemptsAtSpan = 0;
    metrics = { max_span: 3, total_correct: 0, total_trials: 0, response_latencies: [], trials: [] };
  }

  function _renderUI(containerEl) {
    containerEl.innerHTML = `
      <div style="max-width: 850px; margin: 0 auto;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
          <div>
            <h2 style="font-size: 1.6rem; font-weight: 700; color: #fff; margin: 0 0 0.25rem 0;">Sequence Recall</h2>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0;">Corsi block tapping test for spatial working memory</p>
          </div>
          <button id="sequence-cancel-btn" class="btn btn-outline" style="font-size: 0.82rem; padding: 0.4rem 0.9rem;">Cancel Test</button>
        </div>

        <!-- Status Strip -->
        <div class="status-strip">
          <span id="sequence-instruction" style="color: var(--text-primary);">Watch the block sequence...</span>
          <span class="mono-label" id="sequence-counter" style="color: var(--mint-primary);">Span Length: 3</span>
        </div>

        <!-- 3x3 Grid Area -->
        <div class="panel text-center" style="padding: 2rem; margin-bottom: 1.5rem; text-align: center;">
          <div id="corsi-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.25rem; max-width: 360px; margin: 0 auto;">
            ${[0,1,2,3,4,5,6,7,8].map(i => `
              <div class="corsi-block" data-index="${i}" style="height: 100px; background: var(--bg-input); border: 2px solid var(--border-light); border-radius: 12px; cursor: pointer; transition: var(--transition);"></div>
            `).join('')}
          </div>
        </div>

        <!-- Live Technical Telemetry Panel -->
        <div class="panel" style="background: var(--bg-surface); padding: 1.25rem;">
          <div class="mono-label" style="margin-bottom: 0.75rem; color: var(--mint-primary);">LIVE CLINICAL TELEMETRY</div>
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; font-family: var(--font-mono); text-align: center;">
            <div style="background: var(--bg-input); padding: 10px; border-radius: 6px; border: 1px solid var(--border-light);">
              <div style="font-size: 0.7rem; color: var(--text-muted);">CURRENT SPAN</div>
              <div id="live-span" style="font-size: 1.1rem; color: var(--mint-primary); font-weight: 600; margin-top: 2px;">3</div>
            </div>
            <div style="background: var(--bg-input); padding: 10px; border-radius: 6px; border: 1px solid var(--border-light);">
              <div style="font-size: 0.7rem; color: var(--text-muted);">MAX SPAN</div>
              <div id="live-max-span" style="font-size: 1.1rem; color: var(--mint-primary); font-weight: 600; margin-top: 2px;">3</div>
            </div>
            <div style="background: var(--bg-input); padding: 10px; border-radius: 6px; border: 1px solid var(--border-light);">
              <div style="font-size: 0.7rem; color: var(--text-muted);">ACCURACY</div>
              <div id="live-seq-acc" style="font-size: 1.1rem; color: var(--mint-primary); font-weight: 600; margin-top: 2px;">100 %</div>
            </div>
            <div style="background: var(--bg-input); padding: 10px; border-radius: 6px; border: 1px solid var(--border-light);">
              <div style="font-size: 0.7rem; color: var(--text-muted);">CLICK LATENCY</div>
              <div id="live-seq-lat" style="font-size: 1.1rem; color: var(--mint-primary); font-weight: 600; margin-top: 2px;">-- ms</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function _bindEvents() {
    blocks = Array.from(document.querySelectorAll('.corsi-block'));
    blocks.forEach(b => {
      b.addEventListener('click', () => {
        const idx = parseInt(b.dataset.index);
        _handleBlockClick(idx);
      });
    });

    const cancelBtn = document.getElementById('sequence-cancel-btn');
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

  function _nextTrial() {
    if (!isActive) return;
    phase = 'showing';
    userSequence = [];
    currentSequence = [];

    const counterEl = document.getElementById('sequence-counter');
    const instrEl   = document.getElementById('sequence-instruction');

    if (counterEl) counterEl.textContent = `Span Length: ${spanLength}`;
    if (instrEl) instrEl.textContent = 'Watch the illuminated sequence...';

    while (currentSequence.length < spanLength) {
      const idx = Math.floor(Math.random() * 9);
      currentSequence.push(idx);
    }

    _playSequence();
  }

  async function _playSequence() {
    for (let i = 0; i < currentSequence.length; i++) {
      if (!isActive) return;
      await _sleep(600);
      const bIdx = currentSequence[i];
      _flashBlock(bIdx, 'var(--mint-primary)', 500);
      await _sleep(500);
    }

    if (!isActive) return;
    phase = 'user';
    sequenceStartTime = performance.now();
    const instrEl = document.getElementById('sequence-instruction');
    if (instrEl) instrEl.textContent = 'Repeat the sequence by clicking the blocks in order!';
  }

  function _handleBlockClick(idx) {
    if (!isActive || phase !== 'user') return;
    const now = performance.now();
    const lat = now - sequenceStartTime;
    metrics.response_latencies.push(lat);
    sequenceStartTime = now;

    userSequence.push(idx);
    const expectedIdx = currentSequence[userSequence.length - 1];

    if (idx === expectedIdx) {
      _flashBlock(idx, 'var(--mint-primary)', 250);
      if (userSequence.length === currentSequence.length) {
        metrics.total_correct++;
        metrics.total_trials++;
        metrics.trials.push({ type: 'sequence', span: spanLength, correct: true, timestamp: Math.round(now) });

        maxSpanAchieved = Math.max(maxSpanAchieved, spanLength);
        spanLength++;
        attemptsAtSpan = 0;

        _updateLiveTelemetry();
        const instrEl = document.getElementById('sequence-instruction');
        if (instrEl) instrEl.textContent = '✓ Correct! Increasing span length...';
        setTimeout(_nextTrial, 1200);
      }
    } else {
      _flashBlock(idx, 'var(--risk-red)', 500);
      metrics.total_trials++;
      metrics.trials.push({ type: 'sequence', span: spanLength, correct: false, timestamp: Math.round(now) });

      attemptsAtSpan++;
      _updateLiveTelemetry();

      const instrEl = document.getElementById('sequence-instruction');

      if (attemptsAtSpan >= 2) {
        if (instrEl) instrEl.textContent = '✗ Test complete.';
        setTimeout(_finish, 1200);
      } else {
        if (instrEl) instrEl.textContent = '✗ Incorrect. Retrying same span length...';
        setTimeout(_nextTrial, 1200);
      }
    }
  }

  function _updateLiveTelemetry() {
    const spanEl = document.getElementById('live-span');
    const mSpanEl = document.getElementById('live-max-span');
    const accEl  = document.getElementById('live-seq-acc');
    const latEl  = document.getElementById('live-seq-lat');

    if (spanEl) spanEl.textContent = spanLength;
    if (mSpanEl) mSpanEl.textContent = maxSpanAchieved;
    if (accEl) {
      const pct = metrics.total_trials > 0 ? (metrics.total_correct / metrics.total_trials * 100) : 100;
      accEl.textContent = `${pct.toFixed(0)} %`;
    }
    if (latEl && metrics.response_latencies.length > 0) {
      const avgLat = metrics.response_latencies.reduce((a, b) => a + b, 0) / metrics.response_latencies.length;
      latEl.textContent = `${Math.round(avgLat)} ms`;
    }
  }

  function _flashBlock(idx, color, durationMs) {
    const b = blocks[idx];
    if (!b) return;
    b.style.background = color;
    b.style.borderColor = color;
    b.style.boxShadow = 'var(--shadow-mint)';
    setTimeout(() => {
      if (b) {
        b.style.background = 'var(--bg-input)';
        b.style.borderColor = 'var(--border-light)';
        b.style.boxShadow = 'none';
      }
    }, durationMs);
  }

  function _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function _finish() {
    if (!isActive) return;
    isActive = false;
    metrics.max_span = maxSpanAchieved;

    if (onCompleteCallback) {
      onCompleteCallback(metrics);
    }
  }

  function destroy() {
    isActive = false;
  }

  return { init, destroy };
})();
