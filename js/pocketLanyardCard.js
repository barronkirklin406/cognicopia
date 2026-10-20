/* =====================================================================
   COGNICOPIA POCKET LANYARD CARD PRINT MODULE
   Generates a 3" x 5" laminated pocket/lanyard card for shift staff
   and agency nurses with resident triggers and soothing strategies.
   
   Features:
   - Pulls data from resident profile
   - Inline quick-edit form for card-specific fields
   - Print-optimized 6" x 5" layout with fold guide
   - High-contrast, extra-bold fonts for low-light readability
   - Visual icons for quick reference
   - Live print preview
   ===================================================================== */

(function() {
  "use strict";

  // CSS for the Pocket Lanyard Card module
  const STYLES = `
    /* ---------- Modal Container ---------- */
    .plc-modal {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 2000;
      display: none;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
    }
    .plc-modal.is-open {
      display: flex;
    }
    .plc-card {
      width: min(800px, calc(100vw - 32px));
      max-height: calc(100vh - 32px);
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 24px 70px rgba(0, 0, 0, 0.4);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .plc-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 20px 24px;
      border-bottom: 2px solid #e8e8e8;
      background: #f4efe6;
    }
    .plc-header h2 {
      margin: 0;
      font-size: 20px;
      color: #1b382b;
      font-family: "Atkinson Hyperlegible", "Trebuchet MS", sans-serif;
      font-weight: 700;
    }
    .plc-close {
      width: 44px;
      height: 44px;
      min-width: 44px;
      min-height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid #c5a059;
      border-radius: 8px;
      background: transparent;
      color: #1b382b;
      font-size: 24px;
      cursor: pointer;
      transition: background 0.16s ease, border-color 0.16s ease;
    }
    .plc-close:hover {
      background: #c5a059;
      color: #ffffff;
    }
    .plc-close:focus-visible {
      outline: 3px solid #c5a059;
      outline-offset: 2px;
    }

    /* ---------- Two-column layout: Form + Preview ---------- */
    .plc-body {
      flex: 1;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0;
      overflow: hidden;
    }
    @media (max-width: 900px) {
      .plc-body {
        grid-template-columns: 1fr;
        overflow-y: auto;
      }
    }

    /* ---------- Form Column ---------- */
    .plc-form-col {
      padding: 24px;
      overflow-y: auto;
      border-right: 1px solid #e8e8e8;
    }
    @media (max-width: 900px) {
      .plc-form-col {
        border-right: none;
        border-bottom: 1px solid #e8e8e8;
      }
    }
    .plc-field {
      margin-bottom: 20px;
    }
    .plc-field > label {
      display: block;
      margin-bottom: 8px;
      font-weight: 700;
      font-size: 15px;
      color: #1a202c;
      font-family: "Atkinson Hyperlegible", "Trebuchet MS", sans-serif;
    }
    .plc-field .hint {
      margin-top: 4px;
      font-size: 13px;
      color: #666666;
    }
    .plc-input,
    .plc-textarea {
      width: 100%;
      min-height: 52px;
      padding: 12px 16px;
      border: 2px solid #ddd1ba;
      border-radius: 10px;
      background: #ffffff;
      color: #1a202c;
      font-size: 15px;
      font-family: "Atkinson Hyperlegible", "Trebuchet MS", sans-serif;
      box-sizing: border-box;
    }
    .plc-input:hover,
    .plc-textarea:hover {
      border-color: #c5a059;
    }
    .plc-input:focus,
    .plc-textarea:focus {
      border-color: #1b382b;
      outline: none;
      box-shadow: 0 0 0 3px rgba(27, 56, 43, 0.2);
    }
    .plc-textarea {
      min-height: 80px;
      resize: vertical;
    }
    .plc-input-group {
      display: grid;
      gap: 10px;
    }
    .plc-input-group .plc-field {
      margin-bottom: 0;
    }
    .plc-label-inline {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 18px;
      margin-bottom: 8px;
      font-weight: 700;
      color: #1b382b;
    }
    .plc-icon-trigger {
      color: #8a3a20;
      font-size: 20px;
    }
    .plc-icon-soothe {
      color: #1b382b;
      font-size: 20px;
    }

    /* ---------- Preview Column ---------- */
    .plc-preview-col {
      padding: 24px;
      background: #f8f8f8;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .plc-preview-label {
      margin-bottom: 16px;
      font-size: 14px;
      font-weight: 700;
      color: #666666;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .plc-card-preview {
      width: 6in;
      height: 5in;
      background: #ffffff;
      border: 1px solid #cccccc;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      transform-origin: top center;
      position: relative;
    }
    .plc-preview-scale {
      transform: scale(0.8);
    }
    @media (max-width: 900px) {
      .plc-card-preview {
        transform: scale(0.6);
      }
    }

    /* ---------- Footer ---------- */
    .plc-footer {
      padding: 16px 24px;
      border-top: 2px solid #e8e8e8;
      background: #f4efe6;
      display: flex;
      gap: 12px;
      justify-content: flex-end;
    }
    .plc-btn {
      min-height: 52px;
      padding: 12px 24px;
      border-radius: 10px;
      border: 2px solid transparent;
      font-size: 16px;
      font-weight: 700;
      font-family: "Atkinson Hyperlegible", "Trebuchet MS", sans-serif;
      cursor: pointer;
      transition: background 0.16s ease, border-color 0.16s ease;
    }
    .plc-btn-primary {
      background: #1b382b;
      color: #ffffff;
    }
    .plc-btn-primary:hover:not(:disabled) {
      background: #2d5a44;
    }
    .plc-btn-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .plc-btn-ghost {
      background: transparent;
      color: #1a202c;
      border-color: #ddd1ba;
    }
    .plc-btn-ghost:hover:not(:disabled) {
      border-color: #1b382b;
    }

    /* ---------- PRINT CSS: 6" x 5" card with fold line ---------- */
    @media print {
      html.plc-printing body * {
        visibility: hidden;
      }
      html.plc-printing .plc-print-area,
      html.plc-printing .plc-print-area * {
        visibility: visible;
      }
      .plc-print-area {
        position: absolute;
        left: 0;
        top: 0;
        width: 6in;
        height: 5in;
        margin: 0;
        padding: 0;
        background: #ffffff;
        color: #000000;
      }
      
      /* Card layout */
      .plc-print-card {
        width: 100%;
        height: 100%;
        display: grid;
        grid-template-columns: 1fr 1fr;
        padding: 0.25in;
        box-sizing: border-box;
        border: 2px solid #000000;
      }
      
      /* Fold line (vertical, down the middle) */
      .plc-print-card::after {
        content: "";
        position: absolute;
        left: 50%;
        top: 0;
        bottom: 0;
        width: 1px;
        background: #cccccc;
        border-left: 1px dashed #999999;
      }
      
      /* Left panel (Front) */
      .plc-print-front {
        padding-right: 0.15in;
        border-right: 1px solid #000000;
      }
      
      /* Right panel (Back) */
      .plc-print-back {
        padding-left: 0.15in;
      }
      
      /* Typography - extra-bold, high contrast */
      .plc-print-title {
        font-family: "Atkinson Hyperlegible", "Arial Black", sans-serif;
        font-size: 14pt;
        font-weight: 900;
        color: #000000;
        margin: 0 0 0.15in;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        border-bottom: 2px solid #000000;
        padding-bottom: 0.1in;
      }
      
      .plc-print-resident-name {
        font-family: "Atkinson Hyperlegible", "Arial Black", sans-serif;
        font-size: 18pt;
        font-weight: 900;
        color: #000000;
        margin: 0.15in 0 0.1in;
        line-height: 1.1;
      }
      
      .plc-print-nickname {
        font-family: "Atkinson Hyperlegible", Arial, sans-serif;
        font-size: 14pt;
        font-weight: 700;
        color: #444444;
        margin: 0 0 0.2in;
        font-style: italic;
      }
      
      .plc-print-section-title {
        font-family: "Atkinson Hyperlegible", "Arial Black", sans-serif;
        font-size: 11pt;
        font-weight: 900;
        color: #000000;
        margin: 0.2in 0 0.1in;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        display: flex;
        align-items: center;
        gap: 0.1in;
      }
      
      .plc-print-list {
        margin: 0;
        padding: 0;
        list-style: none;
      }
      
      .plc-print-item {
        font-family: "Atkinson Hyperlegible", Arial, sans-serif;
        font-size: 10pt;
        font-weight: 700;
        color: #000000;
        line-height: 1.3;
        margin-bottom: 0.08in;
        padding-left: 0.25in;
        position: relative;
      }
      
      .plc-print-item::before {
        content: "•";
        position: absolute;
        left: 0;
        font-weight: 900;
      }
      
      .plc-print-decades {
        font-family: "Atkinson Hyperlegible", Arial, sans-serif;
        font-size: 11pt;
        font-weight: 700;
        color: #000000;
        margin: 0.2in 0 0;
        letter-spacing: 0.05em;
      }
      
      .plc-print-footer {
        position: absolute;
        bottom: 0.1in;
        left: 0;
        right: 0;
        text-align: center;
        font-family: "Atkinson Hyperlegible", Arial, sans-serif;
        font-size: 8pt;
        font-weight: 700;
        color: #666666;
      }
      
      /* Print icons (using text characters for reliability) */
      .plc-print-icon {
        font-size: 14pt;
        line-height: 1;
      }
    }

    /* ---------- Screen preview styles (mimic print) ---------- */
    .plc-screen-card {
      width: 100%;
      height: 100%;
      display: grid;
      grid-template-columns: 1fr 1fr;
      padding: 16px;
      box-sizing: border-box;
      border: 2px solid #000000;
      position: relative;
      background: #ffffff;
    }
    .plc-screen-card::after {
      content: "";
      position: absolute;
      left: 50%;
      top: 0;
      bottom: 0;
      width: 1px;
      background: #cccccc;
      border-left: 1px dashed #999999;
    }
    .plc-screen-front {
      padding-right: 10px;
      border-right: 1px solid #000000;
    }
    .plc-screen-back {
      padding-left: 10px;
    }
    .plc-screen-title {
      font-family: "Atkinson Hyperlegible", "Arial Black", sans-serif;
      font-size: 14px;
      font-weight: 900;
      color: #000000;
      margin: 0 0 8px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 2px solid #000000;
      padding-bottom: 6px;
    }
    .plc-screen-resident-name {
      font-family: "Atkinson Hyperlegible", "Arial Black", sans-serif;
      font-size: 18px;
      font-weight: 900;
      color: #000000;
      margin: 12px 0 8px;
      line-height: 1.1;
    }
    .plc-screen-nickname {
      font-family: "Atkinson Hyperlegible", Arial, sans-serif;
      font-size: 14px;
      font-weight: 700;
      color: #444444;
      margin: 0 0 16px;
      font-style: italic;
    }
    .plc-screen-section-title {
      font-family: "Atkinson Hyperlegible", "Arial Black", sans-serif;
      font-size: 11px;
      font-weight: 900;
      color: #000000;
      margin: 16px 0 8px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .plc-screen-list {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .plc-screen-item {
      font-family: "Atkinson Hyperlegible", Arial, sans-serif;
      font-size: 10px;
      font-weight: 700;
      color: #000000;
      line-height: 1.3;
      margin-bottom: 6px;
      padding-left: 12px;
      position: relative;
    }
    .plc-screen-item::before {
      content: "•";
      position: absolute;
      left: 0;
      font-weight: 900;
    }
    .plc-screen-decades {
      font-family: "Atkinson Hyperlegible", Arial, sans-serif;
      font-size: 11px;
      font-weight: 700;
      color: #000000;
      margin: 16px 0 0;
      letter-spacing: 0.05em;
    }
    .plc-screen-footer {
      position: absolute;
      bottom: 8px;
      left: 0;
      right: 0;
      text-align: center;
      font-family: "Atkinson Hyperlegible", Arial, sans-serif;
      font-size: 8px;
      font-weight: 700;
      color: #666666;
    }
    .plc-screen-icon {
      font-size: 14px;
      line-height: 1;
    }
  `;

  // Inject styles
  const styleEl = document.createElement("style");
  styleEl.textContent = STYLES;
  document.head.appendChild(styleEl);

  // Create modal HTML
  function createModal() {
    const modal = document.createElement("div");
    modal.className = "plc-modal";
    modal.id = "pocketLanyardModal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "plcTitle");
    
    modal.innerHTML = `
      <div class="plc-card">
        <div class="plc-header">
          <h2 id="plcTitle">Print Pocket Lanyard Card</h2>
          <button type="button" class="plc-close" id="plcClose" aria-label="Close">&times;</button>
        </div>
        <div class="plc-body">
          <div class="plc-form-col">
            <form id="plcForm" onsubmit="return false">
              <div class="plc-field">
                <label for="plcResidentName">Resident Name</label>
                <input type="text" id="plcResidentName" class="plc-input" maxlength="40" placeholder="e.g., Margaret Johnson">
              </div>
              
              <div class="plc-field">
                <label for="plcNickname">Preferred Name / Nickname</label>
                <input type="text" id="plcNickname" class="plc-input" maxlength="30" placeholder="e.g., Peggy">
                <p class="hint">What they answer to and like to hear.</p>
              </div>
              
              <div class="plc-field">
                <div class="plc-label-inline">
                  <span class="plc-icon-trigger">⚠️</span>
                  <span>Known Agitation Triggers</span>
                </div>
                <p class="hint">3 situations that cause distress. Be specific.</p>
                <div class="plc-input-group">
                  <div class="plc-field">
                    <input type="text" id="plcTrigger1" class="plc-input" maxlength="60" placeholder="e.g., Loud shadows at 5 PM">
                  </div>
                  <div class="plc-field">
                    <input type="text" id="plcTrigger2" class="plc-input" maxlength="60" placeholder="e.g., Mentions of hospitals">
                  </div>
                  <div class="plc-field">
                    <input type="text" id="plcTrigger3" class="plc-input" maxlength="60" placeholder="e.g., Overcrowded dining halls">
                  </div>
                </div>
              </div>
              
              <div class="plc-field">
                <div class="plc-label-inline">
                  <span class="plc-icon-soothe">💡</span>
                  <span>Fast Soothing Topics</span>
                </div>
                <p class="hint">3 topics that quickly calm and engage them.</p>
                <div class="plc-input-group">
                  <div class="plc-field">
                    <input type="text" id="plcSoothe1" class="plc-input" maxlength="60" placeholder="e.g., Ask about her dog Barney">
                  </div>
                  <div class="plc-field">
                    <input type="text" id="plcSoothe2" class="plc-input" maxlength="60" placeholder="e.g., Talk about baking apple pies">
                  </div>
                  <div class="plc-field">
                    <input type="text" id="plcSoothe3" class="plc-input" maxlength="60" placeholder="e.g., Hand her the vintage flower coloring page">
                  </div>
                </div>
              </div>
              
              <div class="plc-field">
                <label for="plcDecades">Preferred Reminiscence Decades</label>
                <input type="text" id="plcDecades" class="plc-input" maxlength="50" placeholder="e.g., 1950s–1960s">
                <p class="hint">The years they talk about most.</p>
              </div>
            </form>
          </div>
          
          <div class="plc-preview-col">
            <p class="plc-preview-label">Live Preview (6" × 5", fold down center)</p>
            <div class="plc-card-preview plc-preview-scale" id="plcPreview">
              <!-- Preview rendered by updatePreview() -->
            </div>
          </div>
        </div>
        
        <div class="plc-footer">
          <button type="button" class="plc-btn plc-btn-ghost" id="plcCancel">Cancel</button>
          <button type="button" class="plc-btn plc-btn-primary" id="plcPrint">Print Card</button>
        </div>
      </div>
      
      <!-- Hidden print area -->
      <div class="plc-print-area" id="plcPrintArea" style="display: none;">
        <div class="plc-print-card" id="plcPrintCard">
          <!-- Print card rendered by renderPrintCard() -->
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    return modal;
  }

  // Render screen preview
  function updatePreview() {
    const preview = document.getElementById("plcPreview");
    if (!preview) return;
    
    const data = getFormData();
    preview.innerHTML = renderCardHTML(data, false);
  }

  // Render print card
  function renderPrintCard() {
    const printCard = document.getElementById("plcPrintCard");
    if (!printCard) return;
    
    const data = getFormData();
    printCard.innerHTML = renderCardHTML(data, true);
  }

  // Generate card HTML (screen or print)
  function renderCardHTML(data, isPrint) {
    const prefix = isPrint ? "plc-print" : "plc-screen";
    const iconClass = isPrint ? "plc-print-icon" : "plc-screen-icon";
    
    const triggers = [data.trigger1, data.trigger2, data.trigger3].filter(Boolean);
    const soothes = [data.soothe1, data.soothe2, data.soothe3].filter(Boolean);
    
    return `
      <div class="${prefix}-card">
        <div class="${prefix}-front">
          <h3 class="${prefix}-title">Instant Care & Calm</h3>
          <div class="${prefix}-resident-name">${escapeHtml(data.residentName || "Resident")}</div>
          ${data.nickname ? `<div class="${prefix}-nickname">"${escapeHtml(data.nickname)}"</div>` : ""}
          
          <div class="${prefix}-section-title">
            <span class="${iconClass}">⚠️</span>
            <span>Avoid</span>
          </div>
          <ul class="${prefix}-list">
            ${triggers.length ? triggers.map(t => `<li class="${prefix}-item">${escapeHtml(t)}</li>`).join("") : '<li class="${prefix}-item">None specified</li>'}
          </ul>
          
          <div class="${prefix}-section-title">
            <span class="${iconClass}">💡</span>
            <span>Try These</span>
          </div>
          <ul class="${prefix}-list">
            ${soothes.length ? soothes.map(s => `<li class="${prefix}-item">${escapeHtml(s)}</li>`).join("") : '<li class="${prefix}-item">None specified</li>'}
          </ul>
        </div>
        
        <div class="${prefix}-back">
          <h3 class="${prefix}-title">Reminiscence</h3>
          <div class="${prefix}-section-title">
            <span class="${iconClass}">📅</span>
            <span>Best Years</span>
          </div>
          <div class="${prefix}-decades">${escapeHtml(data.decades || "Not specified")}</div>
          
          <div class="${prefix}-section-title">
            <span class="${iconClass}">💬</span>
            <span>Conversation Starters</span>
          </div>
          <ul class="${prefix}-list">
            ${soothes.slice(0, 2).map(s => `<li class="${prefix}-item">${escapeHtml(s)}</li>`).join("")}
          </ul>
          
          <div class="${prefix}-footer">
            Generated by Cognicopia.org • ${new Date().toLocaleDateString()}
          </div>
        </div>
      </div>
    `;
  }

  // Escape HTML
  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // Get form data
  function getFormData() {
    return {
      residentName: document.getElementById("plcResidentName").value,
      nickname: document.getElementById("plcNickname").value,
      trigger1: document.getElementById("plcTrigger1").value,
      trigger2: document.getElementById("plcTrigger2").value,
      trigger3: document.getElementById("plcTrigger3").value,
      soothe1: document.getElementById("plcSoothe1").value,
      soothe2: document.getElementById("plcSoothe2").value,
      soothe3: document.getElementById("plcSoothe3").value,
      decades: document.getElementById("plcDecades").value
    };
  }

  // Set form data from resident profile
  function setFormData(residentData) {
    document.getElementById("plcResidentName").value = residentData.firstName || "";
    document.getElementById("plcNickname").value = residentData.nickname || "";
    
    // Try to extract triggers and soothers from notes
    const notes = residentData.notes || "";
    const triggerMatch = notes.match(/triggers?\s*[:=]\s*(.+)/i);
    const sootheMatch = notes.match(/sooth(?:ing|ers?)\s*[:=]\s*(.+)/i);
    
    if (triggerMatch) {
      const triggers = triggerMatch[1].split(/[,;]/).map(t => t.trim()).filter(Boolean);
      document.getElementById("plcTrigger1").value = triggers[0] || "";
      document.getElementById("plcTrigger2").value = triggers[1] || "";
      document.getElementById("plcTrigger3").value = triggers[2] || "";
    }
    
    if (sootheMatch) {
      const soothes = sootheMatch[1].split(/[,;]/).map(s => s.trim()).filter(Boolean);
      document.getElementById("plcSoothe1").value = soothes[0] || "";
      document.getElementById("plcSoothe2").value = soothes[1] || "";
      document.getElementById("plcSoothe3").value = soothes[2] || "";
    }
    
    // Set decades from profile data
    if (residentData.decades && Array.isArray(residentData.decades)) {
      document.getElementById("plcDecades").value = residentData.decades.join(", ");
    } else if (residentData.interests && Array.isArray(residentData.interests)) {
      // Try to extract decades from interests
      const decadeKeywords = residentData.interests.filter(i => /19[3-9][0-9]s|19[3-9][0-9]s/i.test(i));
      if (decadeKeywords.length) {
        document.getElementById("plcDecades").value = decadeKeywords.join(", ");
      }
    } else {
      // Default to common decades if none found
      document.getElementById("plcDecades").value = "1950s–1960s";
    }
    
    updatePreview();
  }

  // Open modal
  function openModal(residentData) {
    let modal = document.getElementById("pocketLanyardModal");
    if (!modal) {
      createModal();
      initEventListeners();
      modal = document.getElementById("pocketLanyardModal");
    }
    
    // Set data from resident profile
    setFormData(residentData || {});
    
    // Show modal
    modal.classList.add("is-open");
    document.getElementById("plcClose").focus();
    
    // Prevent body scroll
    document.body.style.overflow = "hidden";
  }

  // Close modal
  function closeModal() {
    const modal = document.getElementById("pocketLanyardModal");
    if (!modal) return;
    
    modal.classList.remove("is-open");
    document.body.style.overflow = "";
  }

  // Print card
  function printCard() {
    renderPrintCard();
    
    const printArea = document.getElementById("plcPrintArea");
    printArea.style.display = "block";
    document.documentElement.classList.add("plc-printing");
    
    window.print();
    
    setTimeout(() => {
      printArea.style.display = "none";
      document.documentElement.classList.remove("plc-printing");
    }, 100);
  }

  // Initialize event listeners
  function initEventListeners() {
    const modal = document.getElementById("pocketLanyardModal");
    if (!modal) return;
    
    // Close button
    document.getElementById("plcClose").addEventListener("click", closeModal);
    document.getElementById("plcCancel").addEventListener("click", closeModal);
    
    // Close on backdrop click
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });
    
    // Close on Escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.classList.contains("is-open")) {
        closeModal();
      }
    });
    
    // Update preview on form change
    const formInputs = modal.querySelectorAll("#plcForm input");
    formInputs.forEach(input => {
      input.addEventListener("input", updatePreview);
    });
    
    // Print button
    document.getElementById("plcPrint").addEventListener("click", printCard);
  }

  // Public API
  window.CogniPocketLanyard = {
    open: openModal,
    close: closeModal,
    init: function() {
      if (!document.getElementById("pocketLanyardModal")) {
        createModal();
        initEventListeners();
      }
    }
  };
})();
