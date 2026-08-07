/* =============================================================
   games/flashreact.js – Go/No-Go Reaction Time Test
   Schizophrenia RT variability & ADHD impulsivity marker
   ============================================================= */

const FlashReactGame = (() => {
  let onCompleteCallback = null;
  let isActive = false;
  let currentTrialIndex = 0;
  let totalTrials = 20;
  let trialSequence = [];
  let trialState = 'idle';
  let stimulusOnset = 0;
  let itiTimer = null;
  let stimulusTimer = null;

  let metrics = {
    reaction_times: [],
    commission_errors: 0,
    omission_errors: 0,
    go_trials: 0,
    nogo_trials: 0,
    trials: []
  };

  let elements = {};

  function init(opts) {
    onCompleteCallback = opts.onComplete;
    const containerEl = document.getElementById('game-container');
    if (!containerEl) return;

    _resetState();
    _generateSequence();
    _renderUI(containerEl);
    _bindEvents();
    _nextTrial();
  }

  function _resetState() {
    isActive = true;
    currentTrialIndex = 0;
    trialSequence = [];
    trialState = 'idle';
    metrics = { reaction_times: [], commission_errors: 0, omission_errors: 0, go_trials: 0, nogo_trials: 0, trials: [] };
  }

  function _generateSequence() {
    const seq = Array(14).fill('go').concat(Array(6).fill('nogo'));
    for (let i = seq.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [seq[i], seq[j]] = [seq[j], seq[i]];
    }
    trialSequence = seq;
  }

  function _renderUI(containerEl) {
    containerEl.innerHTML = `
      <div style="max-width: 850px; margin: 0 auto;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
          <div>
            <h2 style="font-size: 1.6rem; font-weight: 700; color: #fff; margin: 0 0 0.25rem 0;">Flash React</h2>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0;">Go/No-Go reaction time variability & impulse control test</p>
          </div>
          <button id="flashreact-cancel-btn" class="btn btn-outline" style="font-size: 0.82rem; padding: 0.4rem 0.9rem;">Cancel Test</button>
        </div>

        <!-- Status Strip -->
        <div class="status-strip">
          <span id="flashreact-instruction" style="color: var(--text-primary);">Press SPACE on GREEN. Do NOT press on RED.</span>
          <span class="mono-label" id="flashreact-counter" style="color: var(--mint-primary);">Trial 1 / 20</span>
        </div>

        <!-- Flash Area -->
        <div class="panel text-center" style="padding: 1rem; margin-bottom: 1.5rem; text-align: center;">
          <div id="flash-screen" style="width: 100%; height: 320px; background: var(--bg-input); border: 1px solid var(--border-light); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 2.5rem; font-weight: 700; font-family: var(--font-mono); color: #fff; transition: background-color 0.1s ease; margin: 0 auto;">
            Wait...
          </div>
        </div>

        <!-- Live Technical Telemetry Panel -->
        <div class="panel" style="background: var(--bg-surface); padding: 1.25rem;">
          <div class="mono-label" style="margin-bottom: 0.75rem; color: var(--mint-primary);">LIVE CLINICAL TELEMETRY</div>
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; font-family: var(--font-mono); text-align: center;">
            <div style="background: var(--bg-input); padding: 10px; border-radius: 6px; border: 1px solid var(--border-light);">
              <div style="font-size: 0.7rem; color: var(--text-muted);">MEAN GO RT</div>
              <div id="live-mean-rt" style="font-size: 1.1rem; color: var(--mint-primary); font-weight: 600; margin-top: 2px;">-- ms</div>
            </div>
            <div style="background: var(--bg-input); padding: 10px; border-radius: 6px; border: 1px solid var(--border-light);">
              <div style="font-size: 0.7rem; color: var(--text-muted);">RT CV (VARIANCE)</div>
              <div id="live-rt-cv" style="font-size: 1.1rem; color: var(--mint-primary); font-weight: 600; margin-top: 2px;">--</div>
            </div>
            <div style="background: var(--bg-input); padding: 10px; border-radius: 6px; border: 1px solid var(--border-light);">
              <div style="font-size: 0.7rem; color: var(--text-muted);">COMMISSIONS</div>
              <div id="live-commissions" style="font-size: 1.1rem; color: var(--mint-primary); font-weight: 600; margin-top: 2px;">0</div>
            </div>
            <div style="background: var(--bg-input); padding: 10px; border-radius: 6px; border: 1px solid var(--border-light);">
              <div style="font-size: 0.7rem; color: var(--text-muted);">OMISSIONS</div>
              <div id="live-omissions" style="font-size: 1.1rem; color: var(--mint-primary); font-weight: 600; margin-top: 2px;">0</div>
            </div>
          </div>
        </div>
      </div>
    `;

    elements.screen = document.getElementById('flash-screen');
    elements.counter = document.getElementById('flashreact-counter');
    elements.instruction = document.getElementById('flashreact-instruction');
  }

  function _bindEvents() {
    window.addEventListener('keydown', _handleKeyDown);

    const cancelBtn = document.getElementById('flashreact-cancel-btn');
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
    if (!isActive || e.code !== 'Space') return;
    e.preventDefault();

    const now = performance.now();

    if (trialState === 'waiting') {
      _feedback('Too early!', 'var(--risk-amber)');
      return;
    }

    if (trialState === 'stimulus') {
      const type = trialSequence[currentTrialIndex];
      const rt = now - stimulusOnset;

      clearTimeout(stimulusTimer);

      if (type === 'go') {
        if (rt < 120) {
          _feedback('Too fast!', 'var(--risk-amber)');
        } else {
          metrics.reaction_times.push(rt);
          metrics.go_trials++;
          metrics.trials.push({ type: 'go', rt: Math.round(rt), correct: true, timestamp: Math.round(now) });
          _feedback(`${Math.round(rt)} ms`, 'var(--mint-primary)');
        }
      } else {
        metrics.commission_errors++;
        metrics.nogo_trials++;
        metrics.trials.push({ type: 'nogo', responded: true, correct: false, timestamp: Math.round(now) });
        _feedback('Error! Do not press on Red', 'var(--risk-red)');
      }

      _updateLiveTelemetry();
      currentTrialIndex++;
      setTimeout(_nextTrial, 1000);
    }
  }

  function _nextTrial() {
    if (!isActive) return;

    if (currentTrialIndex >= totalTrials) {
      _finish();
      return;
    }

    trialState = 'waiting';
    if (elements.counter) elements.counter.textContent = `Trial ${currentTrialIndex + 1} / ${totalTrials}`;
    if (elements.screen) {
      elements.screen.style.background = 'var(--bg-input)';
      elements.screen.textContent = 'Wait...';
      elements.screen.style.color = 'var(--text-muted)';
    }

    const randomIti = 1000 + Math.random() * 2000;
    itiTimer = setTimeout(() => {
      _showStimulus();
    }, randomIti);
  }

  function _showStimulus() {
    if (!isActive) return;
    trialState = 'stimulus';
    stimulusOnset = performance.now();
    const type = trialSequence[currentTrialIndex];

    if (elements.screen) {
      if (type === 'go') {
        elements.screen.style.background = '#1b4d3e';
        elements.screen.style.color = 'var(--mint-primary)';
        elements.screen.textContent = 'PRESS SPACE!';
      } else {
        elements.screen.style.background = '#4d1b1b';
        elements.screen.style.color = 'var(--risk-red)';
        elements.screen.textContent = 'DON\'T PRESS!';
      }
    }

    stimulusTimer = setTimeout(() => {
      if (trialState === 'stimulus') {
        const now = performance.now();
        if (type === 'go') {
          metrics.omission_errors++;
          metrics.go_trials++;
          metrics.trials.push({ type: 'go', rt: null, correct: false, timestamp: Math.round(now) });
          _feedback('Missed!', 'var(--risk-red)');
        } else {
          metrics.nogo_trials++;
          metrics.trials.push({ type: 'nogo', responded: false, correct: true, timestamp: Math.round(now) });
          _feedback('Correct!', 'var(--mint-primary)');
        }

        _updateLiveTelemetry();
        currentTrialIndex++;
        setTimeout(_nextTrial, 1000);
      }
    }, 1500);
  }

  function _updateLiveTelemetry() {
    const rtEl  = document.getElementById('live-mean-rt');
    const cvEl  = document.getElementById('live-rt-cv');
    const comEl = document.getElementById('live-commissions');
    const omiEl = document.getElementById('live-omissions');

    if (metrics.reaction_times.length > 0) {
      const avgRt = metrics.reaction_times.reduce((a, b) => a + b, 0) / metrics.reaction_times.length;
      const variance = metrics.reaction_times.reduce((a, b) => a + Math.pow(b - avgRt, 2), 0) / metrics.reaction_times.length;
      const sd = Math.sqrt(variance);
      const cv = avgRt > 0 ? (sd / avgRt) : 0;

      if (rtEl) rtEl.textContent = `${Math.round(avgRt)} ms`;
      if (cvEl) cvEl.textContent = cv.toFixed(3);
    }
    if (comEl) comEl.textContent = metrics.commission_errors;
    if (omiEl) omiEl.textContent = metrics.omission_errors;
  }

  function _feedback(text, color) {
    trialState = 'feedback';
    if (elements.screen) {
      elements.screen.style.background = 'var(--bg-input)';
      elements.screen.style.color = color;
      elements.screen.textContent = text;
    }
  }

  function _finish() {
    if (!isActive) return;
    isActive = false;
    clearTimeout(itiTimer);
    clearTimeout(stimulusTimer);
    window.removeEventListener('keydown', _handleKeyDown);

    if (onCompleteCallback) {
      onCompleteCallback(metrics);
    }
  }

  function destroy() {
    isActive = false;
    clearTimeout(itiTimer);
    clearTimeout(stimulusTimer);
    window.removeEventListener('keydown', _handleKeyDown);
  }

  return { init, destroy };
})();
