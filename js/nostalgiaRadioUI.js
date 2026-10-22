/* =====================================================================
   COGNICOPIA NOSTALGIA RADIO UI
   Vintage radio interface for audio-driven reminiscence therapy.
   
   Features:
   - Warm, tactile vintage radio design
   - Large, low-vision accessible buttons
   - Web Audio API integration
   - Conversational facilitator prompts
   - 15-minute sleep timer
   - Touch-friendly for tablets
   ===================================================================== */

(function() {
  "use strict";

  // CSS for the Nostalgia Radio UI
  const STYLES = `
    /* ---------- Radio Container ---------- */
    .nr-container {
      max-width: 800px;
      margin: 0 auto;
      padding: 24px;
    }
    
    .nr-header {
      text-align: center;
      margin-bottom: 32px;
    }
    
    .nr-header h1 {
      margin: 0 0 8px;
      font-size: 28px;
      color: var(--cg-green-950, #0e3c43);
      font-family: "Fraunces", serif;
    }
    
    .nr-header p {
      margin: 0;
      color: var(--cg-charcoal, #1a202c);
      font-size: 16px;
      line-height: 1.5;
    }
    
    /* ---------- Vintage Radio Body ---------- */
    .nr-radio {
      background: linear-gradient(180deg, #8B4513 0%, #654321 50%, #4a3728 100%);
      border-radius: 24px;
      padding: 32px;
      box-shadow: 
        0 8px 32px rgba(0, 0, 0, 0.4),
        inset 0 2px 4px rgba(255, 255, 255, 0.1),
        inset 0 -2px 4px rgba(0, 0, 0, 0.3);
      border: 4px solid #3d2817;
      position: relative;
    }
    
    .nr-radio::before {
      content: "";
      position: absolute;
      top: 8px;
      left: 8px;
      right: 8px;
      bottom: 8px;
      border-radius: 20px;
      border: 2px solid rgba(255, 255, 255, 0.15);
      pointer-events: none;
    }
    
    /* ---------- Speaker Grille ---------- */
    .nr-speaker {
      background: repeating-linear-gradient(
        0deg,
        #2a1a0a 0px,
        #2a1a0a 2px,
        #3d2817 2px,
        #3d2817 4px
      );
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 24px;
      border: 3px solid #1a0f08;
      box-shadow: inset 0 4px 8px rgba(0, 0, 0, 0.5);
    }
    
    .nr-speaker-label {
      text-align: center;
      color: #d4a574;
      font-size: 14px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-bottom: 16px;
      font-family: "Atkinson Hyperlegible", sans-serif;
    }
    
    /* ---------- Control Panel ---------- */
    .nr-controls {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    
    .nr-sound-btn {
      min-height: 64px;
      padding: 12px 16px;
      border-radius: 12px;
      border: 3px solid #5c3d2e;
      background: linear-gradient(180deg, #c4a77d 0%, #a0826d 100%);
      color: #1a0f08;
      font-size: 15px;
      font-weight: 700;
      font-family: "Atkinson Hyperlegible", sans-serif;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
      text-align: center;
      line-height: 1.3;
    }
    
    .nr-sound-btn:hover:not(:disabled) {
      background: linear-gradient(180deg, #d4b893 0%, #b0937e 100%);
      transform: translateY(-2px);
      box-shadow: 0 6px 12px rgba(0, 0, 0, 0.4);
    }
    
    .nr-sound-btn:active:not(:disabled) {
      transform: translateY(0);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    }
    
    .nr-sound-btn:focus-visible {
      outline: 3px solid #c5a059;
      outline-offset: 3px;
    }
    
    .nr-sound-btn.active {
      background: linear-gradient(180deg, #90eeee 0%, #32cdcd 100%);
      border-color: #228b8b;
      color: #1a0f08;
      box-shadow: 0 0 16px rgba(50, 205, 50, 0.5);
    }
    
    .nr-sound-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    
    /* ---------- Volume Control ---------- */
    .nr-volume {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 12px;
      margin-bottom: 24px;
    }
    
    .nr-volume-label {
      color: #d4a574;
      font-size: 14px;
      font-weight: 700;
      font-family: "Atkinson Hyperlegible", sans-serif;
      min-width: 60px;
    }
    
    .nr-volume-slider {
      flex: 1;
      -webkit-appearance: none;
      appearance: none;
      height: 12px;
      border-radius: 6px;
      background: #1a0f08;
      outline: none;
      cursor: pointer;
    }
    
    .nr-volume-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: linear-gradient(180deg, #c4a77d 0%, #a0826d 100%);
      border: 2px solid #5c3d2e;
      cursor: pointer;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    }
    
    .nr-volume-slider::-moz-range-thumb {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: linear-gradient(180deg, #c4a77d 0%, #a0826d 100%);
      border: 2px solid #5c3d2e;
      cursor: pointer;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    }
    
    .nr-volume-slider:focus-visible {
      outline: 3px solid #c5a059;
      outline-offset: 3px;
    }
    
    /* ---------- Timer Control ---------- */
    .nr-timer {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 12px;
    }
    
    .nr-timer-select {
      min-height: 52px;
      padding: 12px 16px;
      border-radius: 10px;
      border: 2px solid #5c3d2e;
      background: #1a0f08;
      color: #d4a574;
      font-size: 16px;
      font-family: "Atkinson Hyperlegible", sans-serif;
      cursor: pointer;
    }
    
    .nr-timer-select:focus-visible {
      outline: 3px solid #c5a059;
      outline-offset: 3px;
    }
    
    .nr-timer-display {
      color: #d4a574;
      font-size: 18px;
      font-weight: 700;
      font-family: "Atkinson Hyperlegible", sans-serif;
      min-width: 80px;
      text-align: center;
    }
    
    /* ---------- Play/Stop Button ---------- */
    .nr-play-btn {
      width: 100%;
      min-height: 72px;
      padding: 16px 24px;
      border-radius: 16px;
      border: 4px solid #5c3d2e;
      background: linear-gradient(180deg, #c4a77d 0%, #a0826d 100%);
      color: #1a0f08;
      font-size: 20px;
      font-weight: 900;
      font-family: "Atkinson Hyperlegible", sans-serif;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    
    .nr-play-btn:hover:not(:disabled) {
      background: linear-gradient(180deg, #d4b893 0%, #b0937e 100%);
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.5);
    }
    
    .nr-play-btn:active:not(:disabled) {
      transform: translateY(0);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
    }
    
    .nr-play-btn:focus-visible {
      outline: 3px solid #c5a059;
      outline-offset: 3px;
    }
    
    .nr-play-btn.playing {
      background: linear-gradient(180deg, #f5a3a3 0%, #e86868 100%);
      border-color: #8b0000;
    }
    
    .nr-play-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    
    /* ---------- Conversational Prompts ---------- */
    .nr-prompts {
      margin-top: 32px;
      padding: 24px;
      background: var(--cg-parchment, #f5f1e6);
      border-radius: 16px;
      border: 2px solid var(--cg-tan-200, #ddd1ba);
    }
    
    .nr-prompts h2 {
      margin: 0 0 20px;
      font-size: 20px;
      color: var(--cg-green-950, #0e3c43);
      font-family: "Fraunces", serif;
    }
    
    .nr-prompt-card {
      padding: 20px;
      margin-bottom: 16px;
      background: #ffffff;
      border-radius: 12px;
      border-left: 4px solid var(--cg-gold-500, #c5a059);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    }
    
    .nr-prompt-card:last-child {
      margin-bottom: 0;
    }
    
    .nr-prompt-text {
      font-size: 22px;
      font-weight: 700;
      color: var(--cg-charcoal, #1a202c);
      font-family: "Atkinson Hyperlegible", sans-serif;
      line-height: 1.4;
      margin: 0;
    }
    
    .nr-prompt-hint {
      margin-top: 8px;
      font-size: 14px;
      color: var(--cg-ink-soft, #666666);
      font-style: italic;
    }
    
    /* ---------- Status Indicator ---------- */
    .nr-status {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px;
      margin-top: 16px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 700;
      font-family: "Atkinson Hyperlegible", sans-serif;
    }
    
    .nr-status.playing {
      background: rgba(50, 205, 50, 0.2);
      color: #228b8b;
    }
    
    .nr-status.stopped {
      background: rgba(0, 0, 0, 0.2);
      color: #d4a574;
    }
    
    .nr-status-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: currentColor;
      animation: nr-pulse 2s ease-in-out infinite;
    }
    
    @keyframes nr-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    
    /* ---------- Empty State ---------- */
    .nr-empty {
      text-align: center;
      padding: 48px 24px;
      color: var(--cg-ink-soft, #666666);
    }
    
    .nr-empty h3 {
      margin: 0 0 8px;
      font-size: 18px;
      color: var(--cg-charcoal, #1a202c);
    }
    
    /* ---------- Responsive Design ---------- */
    @media (max-width: 640px) {
      .nr-radio {
        padding: 20px;
      }
      
      .nr-controls {
        grid-template-columns: 1fr 1fr;
      }
      
      .nr-sound-btn {
        min-height: 72px;
        font-size: 14px;
      }
      
      .nr-volume,
      .nr-timer {
        flex-direction: column;
        align-items: stretch;
      }
      
      .nr-volume-label {
        text-align: center;
      }
      
      .nr-prompt-text {
        font-size: 18px;
      }
    }
    
    @media (min-width: 768px) {
      .nr-controls {
        grid-template-columns: repeat(4, 1fr);
      }
    }
    
    /* ---------- Print Styles ---------- */
    @media print {
      .nr-radio,
      .nr-controls,
      .nr-volume,
      .nr-timer,
      .nr-play-btn {
        display: none;
      }
      
      .nr-prompts {
        border: 1px solid #000;
        background: #fff;
      }
      
      .nr-prompt-card {
        border: 1px solid #000;
        border-left: 4px solid #000;
        box-shadow: none;
      }
    }
  `;

  // Inject styles
  const styleEl = document.createElement("style");
  styleEl.textContent = STYLES;
  document.head.appendChild(styleEl);

  // State
  let currentSoundscape = null;
  let timerMinutes = 15;
  let timerInterval = null;
  let remainingSeconds = 0;

  // Render the Nostalgia Radio UI
  function render(container) {
    container.innerHTML = `
      <div class="nr-container">
        <div class="nr-header">
          <h1>Nostalgia Radio</h1>
          <p>Vintage soundscapes for reminiscence therapy. All sounds are generated locally - no internet connection needed.</p>
        </div>
        
        <div class="nr-radio">
          <div class="nr-speaker">
            <div class="nr-speaker-label">SOUNDSCAPE</div>
            <div class="nr-controls" id="nrControls">
              <!-- Sound buttons rendered here -->
            </div>
          </div>
          
          <div class="nr-volume">
            <label class="nr-volume-label" for="nrVolume">Volume</label>
            <input type="range" id="nrVolume" class="nr-volume-slider" min="0" max="100" value="50" aria-label="Volume">
          </div>
          
          <div class="nr-timer">
            <label for="nrTimer" class="sr-only">Session timer</label>
            <select id="nrTimer" class="nr-timer-select">
              <option value="0">No timer</option>
              <option value="5">5 minutes</option>
              <option value="10">10 minutes</option>
              <option value="15" selected>15 minutes</option>
              <option value="20">20 minutes</option>
              <option value="30">30 minutes</option>
            </select>
            <div class="nr-timer-display" id="nrTimerDisplay" aria-live="polite">15:00</div>
          </div>
          
          <button type="button" class="nr-play-btn" id="nrPlayBtn" disabled>Play Soundscape</button>
          
          <div class="nr-status stopped" id="nrStatus">
            <span class="nr-status-dot"></span>
            <span id="nrStatusText">Stopped</span>
          </div>
        </div>
        
        <div class="nr-prompts" id="nrPrompts">
          <h2>Conversational Prompts</h2>
          <p style="margin-bottom: 20px; color: var(--cg-ink-soft, #666666);">Select a soundscape above to see conversation starters for residents.</p>
          <div id="nrPromptCards">
            <!-- Prompt cards rendered here -->
          </div>
        </div>
      </div>
    `;
    
    initEventListeners();
    renderSoundButtons();
  }

  // Render sound buttons
  function renderSoundButtons() {
    const container = document.getElementById("nrControls");
    if (!container || !window.CogniNostalgiaRadio) return;
    
    const soundscapes = window.CogniNostalgiaRadio.SOUNDSCAPES;
    
    container.innerHTML = soundscapes.map(s => `
      <button type="button" class="nr-sound-btn" data-sound="${s.id}" aria-label="Play ${s.name}">
        <div style="font-size: 24px; margin-bottom: 4px;">${getSoundIcon(s.id)}</div>
        <div>${s.name}</div>
      </button>
    `).join("");
  }

  // Get sound icon
  function getSoundIcon(id) {
    const icons = {
      train: "🚂",
      rain: "🌧️",
      barn: "🏡",
      radio: "📻"
    };
    return icons[id] || "🎵";
  }

  // Render prompt cards
  function renderPrompts(soundscapeId) {
    const container = document.getElementById("nrPromptCards");
    if (!container || !window.CogniNostalgiaRadio) return;
    
    const soundscape = window.CogniNostalgiaRadio.getScapeDef(soundscapeId);
    if (!soundscape) {
      container.innerHTML = `<p style="color: var(--cg-ink-soft, #666666);">Select a soundscape to see conversation prompts.</p>`;
      return;
    }
    
    container.innerHTML = soundscape.prompts.map((prompt, i) => `
      <div class="nr-prompt-card">
        <p class="nr-prompt-text">${escapeHtml(prompt)}</p>
        <p class="nr-prompt-hint">Prompt ${i + 1} of ${soundscape.prompts.length}</p>
      </div>
    `).join("");
  }

  // Initialize event listeners
  function initEventListeners() {
    // Sound buttons
    document.getElementById("nrControls").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-sound]");
      if (!btn) return;
      
      const soundId = btn.dataset.sound;
      selectSoundscape(soundId);
    });
    
    // Volume slider
    document.getElementById("nrVolume").addEventListener("input", (e) => {
      const volume = parseInt(e.target.value) / 100;
      if (window.CogniNostalgiaRadio) {
        window.CogniNostalgiaRadio.get().setVolume(volume);
      }
    });
    
    // Timer select
    document.getElementById("nrTimer").addEventListener("change", (e) => {
      timerMinutes = parseInt(e.target.value);
      updateTimerDisplay();
    });
    
    // Play/Stop button
    document.getElementById("nrPlayBtn").addEventListener("click", togglePlayback);
  }

  // Select soundscape
  function selectSoundscape(id) {
    currentSoundscape = id;
    
    // Update button states
    document.querySelectorAll(".nr-sound-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.sound === id);
    });
    
    // Enable play button
    const playBtn = document.getElementById("nrPlayBtn");
    playBtn.disabled = false;
    
    // Render prompts
    renderPrompts(id);
    
    // If currently playing, switch to new soundscape
    if (window.CogniNostalgiaRadio && window.CogniNostalgiaRadio.get().isCurrentlyPlaying()) {
      window.CogniNostalgiaRadio.get().play(id);
    }
  }

  // Toggle playback
  function togglePlayback() {
    if (!window.CogniNostalgiaRadio || !currentSoundscape) return;
    
    const radio = window.CogniNostalgiaRadio.get();
    const playBtn = document.getElementById("nrPlayBtn");
    const status = document.getElementById("nrStatus");
    const statusText = document.getElementById("nrStatusText");
    
    if (radio.isCurrentlyPlaying()) {
      // Stop
      radio.stop();
      playBtn.textContent = "Play Soundscape";
      playBtn.classList.remove("playing");
      status.className = "nr-status stopped";
      statusText.textContent = "Stopped";
      clearTimer();
    } else {
      // Play
      radio.play(currentSoundscape);
      playBtn.textContent = "Stop Soundscape";
      playBtn.classList.add("playing");
      status.className = "nr-status playing";
      statusText.textContent = "Playing";
      
      // Start timer if set
      if (timerMinutes > 0) {
        startTimer();
      }
    }
  }

  // Timer functions
  function startTimer() {
    clearTimer();
    remainingSeconds = timerMinutes * 60;
    updateTimerDisplay();
    
    timerInterval = setInterval(() => {
      remainingSeconds--;
      updateTimerDisplay();
      
      if (remainingSeconds <= 0) {
        clearTimer();
        if (window.CogniNostalgiaRadio) {
          window.CogniNostalgiaRadio.get().stop();
        }
      }
    }, 1000);
  }

  function clearTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    remainingSeconds = timerMinutes * 60;
    updateTimerDisplay();
  }

  function updateTimerDisplay() {
    const display = document.getElementById("nrTimerDisplay");
    if (!display) return;
    
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    display.textContent = `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  // Helper functions
  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // Public API
  window.CogniNostalgiaRadioUI = {
    render
  };
})();
