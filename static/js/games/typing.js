/* =============================================================
   games/typing.js – Keystroke Dynamics Test (V3 Prototype Replica)
   Parkinson's marker: measures hold time + flight time variability
   Research: neuroQWERTY (JMIR 2018)
   
   PRIVACY: We NEVER store what the user typed. Only timing metrics.
   ============================================================= */

const TypingGame = (() => {
  const PASSAGE_BANK = [
    "the quick brown fox jumps over the lazy dog near the river bank",
    "pack my box with five dozen liquor jugs for the winter party",
    "sphinx of black quartz judge my vow with wisdom and grace",
    "how vexingly quick daft zebras jump over the low garden fence"
  ];

  let currentPassage = "";
  let passageLength = 0;
  let containerEl;
  let active = false;
  let onCompleteCallback = null;

  // Keystroke state
  let keyStates = {};
  let lastKeyUpTime = null;
  let hold_times = [];
  let flight_times = [];
  let trials = [];

  function init(opts) {
    onCompleteCallback = opts.onComplete;
    containerEl = document.getElementById('game-container');
    if (!containerEl) return;

    _selectRandomPassage();
    _resetState();
    _renderUI();
    _bindEvents();
  }

  function _selectRandomPassage() {
    const idx = Math.floor(Math.random() * PASSAGE_BANK.length);
    currentPassage = PASSAGE_BANK[idx];
    passageLength = currentPassage.length;
  }

  function _resetState() {
    active = true;
    keyStates = {};
    lastKeyUpTime = null;
    hold_times = [];
    flight_times = [];
    trials = [];
  }

  function _renderUI() {
    containerEl.innerHTML = `
      <div style="max-width: 850px; margin: 0 auto;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
          <div>
            <h2 style="font-size: 1.6rem; font-weight: 700; color: #fff; margin: 0 0 0.25rem 0;">Typing Rhythm</h2>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0;">Keystroke dynamics for Parkinson's assessment (neuroQWERTY)</p>
          </div>
          <button id="typing-cancel-btn" class="btn btn-outline" style="font-size: 0.82rem; padding: 0.4rem 0.9rem;">Cancel Test</button>
        </div>

        <!-- 1. Live Telemetry Canvas -->
        <div class="live-rhythm-box">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span class="mono-label">LIVE RHYTHM – THIS SESSION</span>
            <span class="mono-label" id="typing-interval-counter" style="color: var(--mint-primary);">0 intervals captured</span>
          </div>
          <canvas id="live-rhythm-canvas" class="live-canvas" width="800" height="120"></canvas>
          <div class="mono-label" style="font-size: 0.7rem; color: var(--text-dim);">Each spike = flight time between consecutive keys</div>
        </div>

        <!-- 2. Target Passage Box -->
        <div class="panel" style="margin-bottom: 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <span class="mono-label">TYPE THIS PASSAGE EXACTLY</span>
            <span class="mono-label" id="typing-char-counter">0 / ${passageLength} chars</span>
          </div>

          <div id="passage-display" class="passage-box"></div>

          <div style="position: relative;">
            <span class="paste-badge">paste disabled</span>
            <textarea id="typing-input" class="typing-textarea" placeholder="Click here and start typing the passage above..." autofocus spellcheck="false" autocomplete="off"></textarea>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1.25rem;">
            <div style="display: flex; gap: 0.75rem; align-items: center;">
              <button id="typing-log-btn" class="btn btn-mint" disabled>Log this session</button>
              <button id="typing-clear-btn" class="btn btn-outline">Clear</button>
            </div>
            <span id="typing-notice" style="font-size: 0.82rem; color: var(--text-muted); font-family: var(--font-mono);">Type the full passage to enable logging.</span>
          </div>
        </div>

        <!-- 3. Live Technical Telemetry Panel -->
        <div class="panel" style="background: var(--bg-surface); padding: 1.25rem;">
          <div class="mono-label" style="margin-bottom: 0.75rem; color: var(--mint-primary);">LIVE CLINICAL TELEMETRY</div>
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; font-family: var(--font-mono); text-align: center;">
            <div style="background: var(--bg-input); padding: 10px; border-radius: 6px; border: 1px solid var(--border-light);">
              <div style="font-size: 0.7rem; color: var(--text-muted);">MEAN HOLD TIME</div>
              <div id="live-mean-hold" style="font-size: 1.1rem; color: var(--mint-primary); font-weight: 600; margin-top: 2px;">-- ms</div>
            </div>
            <div style="background: var(--bg-input); padding: 10px; border-radius: 6px; border: 1px solid var(--border-light);">
              <div style="font-size: 0.7rem; color: var(--text-muted);">HOLD TIME CV</div>
              <div id="live-hold-cv" style="font-size: 1.1rem; color: var(--mint-primary); font-weight: 600; margin-top: 2px;">--</div>
            </div>
            <div style="background: var(--bg-input); padding: 10px; border-radius: 6px; border: 1px solid var(--border-light);">
              <div style="font-size: 0.7rem; color: var(--text-muted);">MEAN FLIGHT TIME</div>
              <div id="live-mean-flight" style="font-size: 1.1rem; color: var(--mint-primary); font-weight: 600; margin-top: 2px;">-- ms</div>
            </div>
            <div style="background: var(--bg-input); padding: 10px; border-radius: 6px; border: 1px solid var(--border-light);">
              <div style="font-size: 0.7rem; color: var(--text-muted);">FLIGHT TIME CV</div>
              <div id="live-flight-cv" style="font-size: 1.1rem; color: var(--mint-primary); font-weight: 600; margin-top: 2px;">--</div>
            </div>
          </div>
        </div>
      </div>
    `;

    _updatePassageDisplay('');
    _drawLiveCanvas();
  }

  function _bindEvents() {
    const inputEl  = document.getElementById('typing-input');
    const cancelBtn = document.getElementById('typing-cancel-btn');
    const logBtn    = document.getElementById('typing-log-btn');
    const clearBtn  = document.getElementById('typing-clear-btn');

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        destroy();
        const hubPanel  = document.getElementById('hub-panel');
        const gamePanel = document.getElementById('game-panel');
        if (gamePanel) gamePanel.classList.add('hidden');
        if (hubPanel) hubPanel.classList.remove('hidden');
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (inputEl) inputEl.value = '';
        _resetState();
        _updatePassageDisplay('');
        _drawLiveCanvas();
        _updateLiveTelemetry();
        if (logBtn) logBtn.disabled = true;
      });
    }

    if (inputEl) {
      inputEl.addEventListener('paste', e => e.preventDefault());

      inputEl.addEventListener('keydown', _onKeyDown);
      inputEl.addEventListener('keyup', _onKeyUp);

      inputEl.addEventListener('input', () => {
        const val = inputEl.value;
        _updatePassageDisplay(val);

        const isExactMatch = (val === currentPassage);
        const logBtn = document.getElementById('typing-log-btn');
        const noticeEl = document.getElementById('typing-notice');

        if (logBtn) logBtn.disabled = !isExactMatch;
        if (noticeEl) {
          if (isExactMatch) {
            noticeEl.textContent = '✓ Passage matched perfectly! Ready to log session.';
            noticeEl.style.color = 'var(--mint-primary)';
          } else {
            noticeEl.textContent = 'Type the full passage to enable logging.';
            noticeEl.style.color = 'var(--text-muted)';
          }
        }
      });
    }

    if (logBtn) {
      logBtn.addEventListener('click', _finish);
    }
  }

  function _onKeyDown(e) {
    if (!active) return;
    const now = performance.now();
    const key = e.code;

    if (keyStates[key] && keyStates[key].downTime) return;

    if (lastKeyUpTime !== null) {
      const flightTime = now - lastKeyUpTime;
      flight_times.push(flightTime);
    }

    keyStates[key] = { downTime: now };
  }

  function _onKeyUp(e) {
    if (!active) return;
    const now = performance.now();
    const key = e.code;

    if (keyStates[key] && keyStates[key].downTime) {
      const holdTime = now - keyStates[key].downTime;
      hold_times.push(holdTime);
      lastKeyUpTime = now;

      trials.push({
        type: 'keystroke',
        hold: Math.round(holdTime * 10) / 10,
        flight: flight_times.length > 0 ? Math.round(flight_times[flight_times.length - 1] * 10) / 10 : null,
        timestamp: Math.round(now),
      });

      delete keyStates[key];
      _updateIntervalCounter();
      _drawLiveCanvas();
      _updateLiveTelemetry();
    }
  }

  function _updatePassageDisplay(typedText) {
    const displayEl = document.getElementById('passage-display');
    const counterEl = document.getElementById('typing-char-counter');

    if (counterEl) {
      counterEl.textContent = `${typedText.length} / ${passageLength} chars`;
    }

    if (!displayEl) return;

    let html = '';
    for (let i = 0; i < passageLength; i++) {
      const targetChar = currentPassage[i];
      if (i < typedText.length) {
        const typedChar = typedText[i];
        if (typedChar === targetChar) {
          html += `<span class="char-correct">${targetChar}</span>`;
        } else {
          html += `<span class="char-wrong">${targetChar}</span>`;
        }
      } else if (i === typedText.length) {
        html += `<span class="char-current">${targetChar}</span>`;
      } else {
        html += `<span>${targetChar}</span>`;
      }
    }
    displayEl.innerHTML = html;
  }

  function _updateIntervalCounter() {
    const counterEl = document.getElementById('typing-interval-counter');
    if (counterEl) {
      counterEl.textContent = `${flight_times.length} intervals captured`;
    }
  }

  function _updateLiveTelemetry() {
    const holdEl = document.getElementById('live-mean-hold');
    const hCvEl  = document.getElementById('live-hold-cv');
    const fltEl  = document.getElementById('live-mean-flight');
    const fCvEl  = document.getElementById('live-flight-cv');

    if (hold_times.length > 0) {
      const avgH = hold_times.reduce((a, b) => a + b, 0) / hold_times.length;
      const varH = hold_times.reduce((a, b) => a + Math.pow(b - avgH, 2), 0) / hold_times.length;
      const sdH = Math.sqrt(varH);
      const cvH = avgH > 0 ? (sdH / avgH) : 0;

      if (holdEl) holdEl.textContent = `${Math.round(avgH)} ms`;
      if (hCvEl) hCvEl.textContent = cvH.toFixed(3);
    }

    if (flight_times.length > 0) {
      const avgF = flight_times.reduce((a, b) => a + b, 0) / flight_times.length;
      const varF = flight_times.reduce((a, b) => a + Math.pow(b - avgF, 2), 0) / flight_times.length;
      const sdF = Math.sqrt(varF);
      const cvF = avgF > 0 ? (sdF / avgF) : 0;

      if (fltEl) fltEl.textContent = `${Math.round(avgF)} ms`;
      if (fCvEl) fCvEl.textContent = cvF.toFixed(3);
    }
  }

  function _drawLiveCanvas() {
    const canvas = document.getElementById('live-rhythm-canvas');
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

    if (flight_times.length === 0) return;

    const maxVal = Math.max(...flight_times, 500);
    const barWidth = Math.max(3, Math.min(12, (w - 20) / flight_times.length));
    const gap = 2;

    flight_times.forEach((ft, i) => {
      const barHeight = Math.min(h - 25, (ft / maxVal) * (h - 30));
      const x = 10 + i * (barWidth + gap);
      const y = (h - 15) - barHeight;

      ctx.fillStyle = '#38d9a9';
      ctx.fillRect(x, y, barWidth, barHeight);

      ctx.fillStyle = '#6ee7b7';
      ctx.beginPath();
      ctx.arc(x + barWidth / 2, y, barWidth / 2, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function _finish() {
    if (!active) return;
    active = false;

    const inputEl = document.getElementById('typing-input');
    if (inputEl) inputEl.value = '';

    if (onCompleteCallback) {
      onCompleteCallback({
        hold_times,
        flight_times,
        trials,
      });
    }
  }

  function destroy() {
    active = false;
    const inputEl = document.getElementById('typing-input');
    if (inputEl) {
      inputEl.removeEventListener('keydown', _onKeyDown);
      inputEl.removeEventListener('keyup', _onKeyUp);
    }
  }

  return { init, destroy };
})();
