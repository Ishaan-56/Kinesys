/* =============================================================
   games/wordspark.js – Verbal Fluency & Word Retrieval Test
   Alzheimer's semantic memory & Parkinson's subcortical latency marker
   ============================================================= */

const WordSparkGame = (() => {
  const WORD_BANK = [
    'Ocean', 'Mountain', 'Doctor', 'Freedom', 'Kitchen', 'Thunder', 'Garden', 'Journey',
    'Silence', 'Bridge', 'Planet', 'Mirror', 'Forest', 'Shadow', 'Feather', 'Silver',
    'Velocity', 'Pattern', 'Echo', 'Compass', 'Whisk', 'Lantern', 'Ribbon', 'Harbor',
    'Pebble', 'Breeze', 'Anchor', 'Orbit', 'Canvas', 'Falcon', 'Meadow', 'Horizon',
    'Crystal', 'Glacier', 'Velvet', 'Tunnel', 'Summit', 'Rhythm', 'Beacon', 'Puzzle',
    'Fossil', 'Canyon', 'Mosaic', 'Origami', 'Starlight', 'Volcano', 'Pyramid', 'Cascade'
  ];

  let activePrompts = [];
  let onCompleteCallback = null;
  let isActive = false;
  let currentPromptIndex = 0;
  let promptDisplayTime = 0;
  let firstKeyDownTime = 0;
  let hasTypedFirstKey = false;

  let metrics = {
    response_latencies: [],
    production_times: [],
    trials: []
  };

  let elements = {};

  function init(opts) {
    onCompleteCallback = opts.onComplete;
    const containerEl = document.getElementById('game-container');
    if (!containerEl) return;

    _resetState();
    _selectRandomPrompts();
    _renderUI(containerEl);
    _bindEvents();
    _showPrompt(0);
  }

  function _resetState() {
    isActive = true;
    currentPromptIndex = 0;
    metrics = { response_latencies: [], production_times: [], trials: [] };
  }

  function _selectRandomPrompts() {
    // Shuffle WORD_BANK and pick 10 words so no two sessions are identical
    const shuffled = [...WORD_BANK].sort(() => 0.5 - Math.random());
    activePrompts = shuffled.slice(0, 10);
  }

  function _renderUI(containerEl) {
    containerEl.innerHTML = `
      <div style="max-width: 850px; margin: 0 auto;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
          <div>
            <h2 style="font-size: 1.6rem; font-weight: 700; color: #fff; margin: 0 0 0.25rem 0;">Word Spark</h2>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0;">Verbal fluency test for word retrieval latency & processing speed</p>
          </div>
          <button id="wordspark-cancel-btn" class="btn btn-outline" style="font-size: 0.82rem; padding: 0.4rem 0.9rem;">Cancel Test</button>
        </div>

        <!-- Status Strip -->
        <div class="status-strip">
          <span style="color: var(--text-primary);">Type the FIRST related word that comes to mind and press Enter.</span>
          <span class="mono-label" id="wordspark-counter" style="color: var(--mint-primary);">Word 1 of 10</span>
        </div>

        <!-- Word Prompt Card -->
        <div class="panel text-center" style="padding: 2.5rem 1.5rem; margin-bottom: 1.5rem; text-align: center;">
          <div class="mono-label" style="margin-bottom: 0.5rem;">PROMPT WORD</div>
          <div id="wordspark-prompt" style="font-size: 3.5rem; font-weight: 700; color: var(--mint-primary); font-family: var(--font-mono); margin-bottom: 2rem;">Ready...</div>

          <div style="max-width: 420px; margin: 0 auto; position: relative;">
            <input id="wordspark-input" type="text" class="typing-textarea" style="height: 54px; font-size: 1.25rem; text-align: center; padding: 10px 14px;" placeholder="Type related word & hit Enter..." autofocus spellcheck="false" autocomplete="off">
          </div>
        </div>

        <!-- Live Technical Telemetry Panel -->
        <div class="panel" style="background: var(--bg-surface); padding: 1.25rem;">
          <div class="mono-label" style="margin-bottom: 0.75rem; color: var(--mint-primary);">LIVE CLINICAL TELEMETRY</div>
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; font-family: var(--font-mono); text-align: center;">
            <div style="background: var(--bg-input); padding: 10px; border-radius: 6px; border: 1px solid var(--border-light);">
              <div style="font-size: 0.7rem; color: var(--text-muted);">PROMPT LATENCY</div>
              <div id="live-prompt-lat" style="font-size: 1.1rem; color: var(--mint-primary); font-weight: 600; margin-top: 2px;">-- ms</div>
            </div>
            <div style="background: var(--bg-input); padding: 10px; border-radius: 6px; border: 1px solid var(--border-light);">
              <div style="font-size: 0.7rem; color: var(--text-muted);">LATENCY CV</div>
              <div id="live-lat-cv" style="font-size: 1.1rem; color: var(--mint-primary); font-weight: 600; margin-top: 2px;">--</div>
            </div>
            <div style="background: var(--bg-input); padding: 10px; border-radius: 6px; border: 1px solid var(--border-light);">
              <div style="font-size: 0.7rem; color: var(--text-muted);">TYPING TIME</div>
              <div id="live-typ-time" style="font-size: 1.1rem; color: var(--mint-primary); font-weight: 600; margin-top: 2px;">-- ms</div>
            </div>
            <div style="background: var(--bg-input); padding: 10px; border-radius: 6px; border: 1px solid var(--border-light);">
              <div style="font-size: 0.7rem; color: var(--text-muted);">COMPLETED</div>
              <div id="live-completed" style="font-size: 1.1rem; color: var(--mint-primary); font-weight: 600; margin-top: 2px;">0 / 10</div>
            </div>
          </div>
        </div>
      </div>
    `;

    elements.prompt = document.getElementById('wordspark-prompt');
    elements.input = document.getElementById('wordspark-input');
    elements.counter = document.getElementById('wordspark-counter');
  }

  function _bindEvents() {
    if (!elements.input) return;

    elements.input.addEventListener('keydown', (e) => {
      if (!isActive) return;
      const now = performance.now();

      if (!hasTypedFirstKey && e.key.length === 1) {
        hasTypedFirstKey = true;
        firstKeyDownTime = now;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        const val = elements.input.value.trim();
        if (!val) return;

        const responseLatency = (hasTypedFirstKey ? firstKeyDownTime : now) - promptDisplayTime;
        const productionTime = now - (hasTypedFirstKey ? firstKeyDownTime : promptDisplayTime);

        metrics.response_latencies.push(responseLatency);
        metrics.production_times.push(productionTime);

        metrics.trials.push({
          type: 'word',
          prompt_index: currentPromptIndex,
          response_latency: Math.round(responseLatency),
          production_time: Math.round(productionTime),
          timestamp: Math.round(now)
        });

        _updateLiveTelemetry();
        elements.input.value = '';
        currentPromptIndex++;

        if (currentPromptIndex >= activePrompts.length) {
          _finish();
        } else {
          _showPrompt(currentPromptIndex);
        }
      }
    });

    const cancelBtn = document.getElementById('wordspark-cancel-btn');
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

  function _updateLiveTelemetry() {
    const latEl = document.getElementById('live-prompt-lat');
    const cvEl  = document.getElementById('live-lat-cv');
    const typEl = document.getElementById('live-typ-time');
    const compEl = document.getElementById('live-completed');

    if (metrics.response_latencies.length > 0) {
      const avgLat = metrics.response_latencies.reduce((a, b) => a + b, 0) / metrics.response_latencies.length;
      const variance = metrics.response_latencies.reduce((a, b) => a + Math.pow(b - avgLat, 2), 0) / metrics.response_latencies.length;
      const sd = Math.sqrt(variance);
      const cv = avgLat > 0 ? (sd / avgLat) : 0;

      const avgTyp = metrics.production_times.reduce((a, b) => a + b, 0) / metrics.production_times.length;

      if (latEl) latEl.textContent = `${Math.round(avgLat)} ms`;
      if (cvEl) cvEl.textContent = cv.toFixed(3);
      if (typEl) typEl.textContent = `${Math.round(avgTyp)} ms`;
    }
    if (compEl) compEl.textContent = `${metrics.response_latencies.length} / 10`;
  }

  function _showPrompt(idx) {
    if (!isActive) return;
    hasTypedFirstKey = false;
    promptDisplayTime = performance.now();

    if (elements.counter) elements.counter.textContent = `Word ${idx + 1} of ${activePrompts.length}`;
    if (elements.prompt) elements.prompt.textContent = activePrompts[idx];
    if (elements.input) elements.input.focus();
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
  }

  return { init, destroy };
})();
