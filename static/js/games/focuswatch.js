/* =============================================================
   games/focuswatch.js – Continuous Performance Test (CPT)
   ADHD sustained attention & d' sensitivity index marker
   ============================================================= */

const FocusWatchGame = (() => {
  let onCompleteCallback = null;
  let isActive = false;
  let currentTrialIndex = 0;
  let totalDurationMs = 30000; // 30 seconds
  let startTime = 0;
  let currentStimulus = '';
  let stimulusOnset = 0;
  let hasResponded = false;
  let timerInterval = null;
  let stimulusTimer = null;

  let metrics = {
    hit_rate: 0,
    false_alarm_rate: 0,
    d_prime: 0,
    omission_count: 0,
    commission_count: 0,
    lapse_count: 0,
    reaction_times: [],
    trials: []
  };

  let hits = 0;
  let targetCount = 0;
  let nonTargetCount = 0;
  let falseAlarms = 0;

  let elements = {};

  function init(opts) {
    onCompleteCallback = opts.onComplete;
    const containerEl = document.getElementById('game-container');
    if (!containerEl) return;

    _resetState();
    _renderUI(containerEl);
    _bindEvents();
    _startTest();
  }

  function _resetState() {
    isActive = true;
    currentTrialIndex = 0;
    startTime = 0;
    hits = 0;
    targetCount = 0;
    nonTargetCount = 0;
    falseAlarms = 0;
    metrics = { hit_rate: 0, false_alarm_rate: 0, d_prime: 0, omission_count: 0, commission_count: 0, lapse_count: 0, reaction_times: [], trials: [] };
  }

  function _renderUI(containerEl) {
    containerEl.innerHTML = `
      <div style="max-width: 850px; margin: 0 auto;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
          <div>
            <h2 style="font-size: 1.6rem; font-weight: 700; color: #fff; margin: 0 0 0.25rem 0;">Focus Watch</h2>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0;">Continuous Performance Test for sustained attention & d' sensitivity index</p>
          </div>
          <button id="focuswatch-cancel-btn" class="btn btn-outline" style="font-size: 0.82rem; padding: 0.4rem 0.9rem;">Cancel Test</button>
        </div>

        <!-- Status Strip -->
        <div class="status-strip">
          <span style="color: var(--text-primary);">Press SPACE when you see the letter X. Ignore all other letters.</span>
          <div style="display:flex; gap:1.5rem; align-items:center;">
            <span class="mono-label" id="focus-counter" style="color: var(--text-muted);">Trial: 0</span>
            <span class="mono-label" id="focus-timer" style="color: var(--risk-red);">0:30</span>
          </div>
        </div>

        <!-- Stimulus Display Box -->
        <div class="panel text-center" style="padding: 2.5rem 1.5rem; margin-bottom: 1.5rem; text-align: center;">
          <div id="focus-stimulus" style="width: 100%; height: 220px; background: var(--bg-input); border: 1px solid var(--border-light); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 7rem; font-weight: 800; font-family: var(--font-mono); color: var(--mint-primary); margin: 0 auto;">
            +
          </div>
        </div>

        <!-- Live Technical Telemetry Panel -->
        <div class="panel" style="background: var(--bg-surface); padding: 1.25rem;">
          <div class="mono-label" style="margin-bottom: 0.75rem; color: var(--mint-primary);">LIVE CLINICAL TELEMETRY</div>
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; font-family: var(--font-mono); text-align: center;">
            <div style="background: var(--bg-input); padding: 10px; border-radius: 6px; border: 1px solid var(--border-light);">
              <div style="font-size: 0.7rem; color: var(--text-muted);">HIT RATE</div>
              <div id="live-hit-rate" style="font-size: 1.1rem; color: var(--mint-primary); font-weight: 600; margin-top: 2px;">-- %</div>
            </div>
            <div style="background: var(--bg-input); padding: 10px; border-radius: 6px; border: 1px solid var(--border-light);">
              <div style="font-size: 0.7rem; color: var(--text-muted);">FALSE ALARMS</div>
              <div id="live-fa-rate" style="font-size: 1.1rem; color: var(--mint-primary); font-weight: 600; margin-top: 2px;">0</div>
            </div>
            <div style="background: var(--bg-input); padding: 10px; border-radius: 6px; border: 1px solid var(--border-light);">
              <div style="font-size: 0.7rem; color: var(--text-muted);">d' SENSITIVITY INDEX</div>
              <div id="live-dprime" style="font-size: 1.1rem; color: var(--mint-primary); font-weight: 600; margin-top: 2px;">--</div>
            </div>
            <div style="background: var(--bg-input); padding: 10px; border-radius: 6px; border: 1px solid var(--border-light);">
              <div style="font-size: 0.7rem; color: var(--text-muted);">LAPSE COUNT</div>
              <div id="live-lapses" style="font-size: 1.1rem; color: var(--mint-primary); font-weight: 600; margin-top: 2px;">0</div>
            </div>
          </div>
        </div>
      </div>
    `;

    elements.stimulus = document.getElementById('focus-stimulus');
    elements.timer = document.getElementById('focus-timer');
    elements.counter = document.getElementById('focus-counter');
  }

  function _bindEvents() {
    window.addEventListener('keydown', _handleKeyDown);

    const cancelBtn = document.getElementById('focuswatch-cancel-btn');
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

  function _startTest() {
    startTime = performance.now();
    timerInterval = setInterval(() => {
      if (!isActive) return;
      const elapsed = performance.now() - startTime;
      const remaining = Math.max(0, totalDurationMs - elapsed);
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);

      if (elements.timer) {
        elements.timer.textContent = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
      }

      if (remaining <= 0) {
        _finish();
      }
    }, 500);

    _nextStimulus();
  }

  function _nextStimulus() {
    if (!isActive) return;
    currentTrialIndex++;
    if (elements.counter) elements.counter.textContent = `Trial: ${currentTrialIndex}`;

    const isTarget = Math.random() < 0.7;
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWYZ';
    currentStimulus = isTarget ? 'X' : alphabet[Math.floor(Math.random() * alphabet.length)];

    if (isTarget) targetCount++;
    else nonTargetCount++;

    hasResponded = false;
    stimulusOnset = performance.now();

    if (elements.stimulus) {
      elements.stimulus.textContent = currentStimulus;
      elements.stimulus.style.color = currentStimulus === 'X' ? 'var(--mint-primary)' : 'var(--text-secondary)';
    }

    setTimeout(() => {
      if (elements.stimulus && isActive) elements.stimulus.textContent = '';
    }, 250);

    const isi = 1000 + Math.random() * 800;
    stimulusTimer = setTimeout(() => {
      if (!hasResponded) {
        const now = performance.now();
        if (currentStimulus === 'X') {
          metrics.omission_count++;
          metrics.trials.push({ type: 'target', stimulus: currentStimulus, responded: false, rt: null, timestamp: Math.round(now) });
        } else {
          metrics.trials.push({ type: 'nontarget', stimulus: currentStimulus, responded: false, rt: null, timestamp: Math.round(now) });
        }
      }
      _updateLiveTelemetry();
      _nextStimulus();
    }, isi);
  }

  function _handleKeyDown(e) {
    if (!isActive || e.code !== 'Space' || hasResponded) return;
    e.preventDefault();
    hasResponded = true;
    const now = performance.now();
    const rt = now - stimulusOnset;

    if (currentStimulus === 'X') {
      hits++;
      metrics.reaction_times.push(rt);
      metrics.trials.push({ type: 'target', stimulus: currentStimulus, responded: true, rt: Math.round(rt), timestamp: Math.round(now) });
    } else {
      falseAlarms++;
      metrics.commission_count++;
      metrics.trials.push({ type: 'nontarget', stimulus: currentStimulus, responded: true, rt: Math.round(rt), timestamp: Math.round(now) });
    }
    _updateLiveTelemetry();
  }

  function _updateLiveTelemetry() {
    const hrEl = document.getElementById('live-hit-rate');
    const faEl = document.getElementById('live-fa-rate');
    const dpEl = document.getElementById('live-dprime');
    const lpEl = document.getElementById('live-lapses');

    const hitRate = targetCount > 0 ? (hits / targetCount) : 0;
    const faRate  = nonTargetCount > 0 ? (falseAlarms / nonTargetCount) : 0;

    const zHit = _normInv(Math.min(0.99, Math.max(0.01, hitRate)));
    const zFA  = _normInv(Math.min(0.99, Math.max(0.01, faRate)));
    const dPrime = zHit - zFA;

    metrics.hit_rate = hitRate;
    metrics.false_alarm_rate = faRate;
    metrics.d_prime = Math.round(dPrime * 100) / 100;

    if (hrEl) hrEl.textContent = `${(hitRate * 100).toFixed(0)} %`;
    if (faEl) faEl.textContent = falseAlarms;
    if (dpEl) dpEl.textContent = dPrime.toFixed(2);

    if (metrics.reaction_times.length > 2) {
      const sorted = [...metrics.reaction_times].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      const lapses = metrics.reaction_times.filter(r => r > 2 * median).length;
      metrics.lapse_count = lapses;
      if (lpEl) lpEl.textContent = lapses;
    }
  }

  function _finish() {
    if (!isActive) return;
    isActive = false;
    clearInterval(timerInterval);
    clearTimeout(stimulusTimer);
    window.removeEventListener('keydown', _handleKeyDown);

    if (onCompleteCallback) {
      onCompleteCallback(metrics);
    }
  }

  function _normInv(p) {
    const a1 = -39.69683028665376, a2 = 220.9400984204308, a3 = -275.9285104469687;
    const a4 = 138.3577518672690, a5 = -30.66479806614716, a6 = 2.506628277459239;
    const b1 = -54.47609879822406, b2 = 161.5858368580409, b3 = -155.6989798598866;
    const b4 = 66.80131188771972, b5 = -13.28068155288572;
    const q = p - 0.5;
    if (Math.abs(q) < 0.42) {
      const r = q * q;
      return q * (((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) /
                 (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1);
    }
    const r = p < 0.5 ? p : 1 - p;
    const s = Math.sqrt(-2 * Math.log(r));
    const val = s - (2.515517 + 0.802853 * s + 0.010328 * s * s) / (1 + 1.432788 * s + 0.189269 * s * s + 0.001308 * s * s * s);
    return p < 0.5 ? -val : val;
  }

  function destroy() {
    isActive = false;
    clearInterval(timerInterval);
    clearTimeout(stimulusTimer);
    window.removeEventListener('keydown', _handleKeyDown);
  }

  return { init, destroy };
})();
