/* =====================================================================
   COGNICOPIA AUDIT LOG & COMPLIANCE SUMMARY UI
   Dashboard for state inspection audit readiness in the FACILITY section.
   
   Features:
   - Timeframe selection (7 days, 30 days, current month, custom)
   - 4 metric card widgets
   - Aggregated audit table
   - Export to PDF/CSV
   - Formal compliance disclaimer
   ===================================================================== */

(function() {
  "use strict";

  // CSS for the Audit Log UI
  const STYLES = `
    /* ---------- Audit Log Container ---------- */
    .alc-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 24px;
    }
    
    .alc-header {
      margin-bottom: 32px;
    }
    
    .alc-header h1 {
      margin: 0 0 8px;
      font-size: 28px;
      color: var(--cg-green-950, #0e3c43);
      font-family: "Fraunces", serif;
    }
    
    .alc-header p {
      margin: 0;
      color: var(--cg-charcoal, #1a202c);
      font-size: 16px;
      line-height: 1.5;
    }
    
    /* ---------- Timeframe Selector ---------- */
    .alc-timeframe {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 24px;
      align-items: center;
    }
    
    .alc-timeframe label {
      font-weight: 700;
      font-size: 15px;
      color: var(--cg-charcoal, #1a202c);
    }
    
    .alc-timeframe select,
    .alc-timeframe input {
      min-height: 52px;
      padding: 12px 16px;
      border: 2px solid var(--cg-tan-200, #ddd1ba);
      border-radius: 10px;
      background: #ffffff;
      color: var(--cg-charcoal, #1a202c);
      font-size: 15px;
      font-family: "Atkinson Hyperlegible", "Trebuchet MS", sans-serif;
      cursor: pointer;
    }
    
    .alc-timeframe select:hover,
    .alc-timeframe input:hover {
      border-color: var(--cg-gold-500, #c5a059);
    }
    
    .alc-timeframe select:focus,
    .alc-timeframe input:focus {
      border-color: var(--cg-green-700, #0e3c43);
      outline: none;
      box-shadow: 0 0 0 3px rgba(14,60,67, 0.2);
    }
    
    .alc-date-range {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    
    .alc-date-range input {
      width: 140px;
    }
    
    /* ---------- Metric Cards ---------- */
    .alc-metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 32px;
    }
    
    .alc-metric-card {
      padding: 24px;
      border-radius: 16px;
      border: 2px solid var(--cg-tan-200, #ddd1ba);
      background: #ffffff;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    }
    
    .alc-metric-card h3 {
      margin: 0 0 8px;
      font-size: 14px;
      font-weight: 700;
      color: var(--cg-green-700, #0e3c43);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    
    .alc-metric-value {
      font-size: 36px;
      font-weight: 900;
      color: var(--cg-charcoal, #1a202c);
      font-family: "Atkinson Hyperlegible", "Arial Black", sans-serif;
      line-height: 1;
      margin-bottom: 4px;
    }
    
    .alc-metric-label {
      font-size: 14px;
      color: var(--cg-ink-soft, #666666);
    }
    
    .alc-metric-card.highlight {
      border-color: var(--cg-gold-500, #c5a059);
      background: linear-gradient(135deg, #fffaf0, #ffffff);
    }
    
    /* ---------- Audit Table ---------- */
    .alc-table-section {
      margin-bottom: 32px;
    }
    
    .alc-table-section h2 {
      margin: 0 0 16px;
      font-size: 20px;
      color: var(--cg-green-950, #0e3c43);
      font-family: "Fraunces", serif;
    }
    
    .alc-table-wrapper {
      border: 2px solid var(--cg-tan-200, #ddd1ba);
      border-radius: 12px;
      overflow: hidden;
      background: #ffffff;
    }
    
    .alc-table {
      width: 100%;
      border-collapse: collapse;
    }
    
    .alc-table th,
    .alc-table td {
      padding: 16px;
      text-align: left;
      border-bottom: 1px solid var(--cg-tan-200, #ddd1ba);
    }
    
    .alc-table th {
      background: var(--cg-parchment, #f5f1e6);
      font-weight: 700;
      font-size: 14px;
      color: var(--cg-green-950, #0e3c43);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    
    .alc-table td {
      font-size: 15px;
      color: var(--cg-charcoal, #1a202c);
    }
    
    .alc-table tr:last-child td {
      border-bottom: none;
    }
    
    .alc-status-badge {
      display: inline-block;
      padding: 6px 12px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    
    .alc-status-compliant {
      background: #d5eef0;
      color: #05222a;
    }
    
    .alc-status-review {
      background: #fff3cd;
      color: #5a4a00;
    }
    
    .alc-status-incomplete {
      background: #ffe3db;
      color: #5a1a0c;
    }
    
    /* ---------- Export Section ---------- */
    .alc-export {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 32px;
    }
    
    .alc-btn {
      min-height: 52px;
      padding: 12px 24px;
      border-radius: 10px;
      border: 2px solid transparent;
      font-size: 16px;
      font-weight: 700;
      font-family: "Atkinson Hyperlegible", "Trebuchet MS", sans-serif;
      cursor: pointer;
      transition: background 0.16s ease, border-color 0.16s ease;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    
    .alc-btn-primary {
      background: var(--cg-green-700, #0e3c43);
      color: #ffffff;
    }
    
    .alc-btn-primary:hover:not(:disabled) {
      background: var(--cg-green-600, #1c5963);
    }
    
    .alc-btn-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .alc-btn-ghost {
      background: transparent;
      color: var(--cg-charcoal, #1a202c);
      border-color: var(--cg-tan-200, #ddd1ba);
    }
    
    .alc-btn-ghost:hover:not(:disabled) {
      border-color: var(--cg-green-700, #0e3c43);
    }
    
    /* ---------- Compliance Disclaimer ---------- */
    .alc-disclaimer {
      padding: 20px 24px;
      border-radius: 12px;
      border: 2px solid var(--cg-gold-500, #c5a059);
      background: linear-gradient(135deg, #fffaf0, #ffffff);
      margin-bottom: 32px;
    }
    
    .alc-disclaimer h3 {
      margin: 0 0 12px;
      font-size: 16px;
      color: var(--cg-green-950, #0e3c43);
      font-weight: 700;
    }
    
    .alc-disclaimer p {
      margin: 0;
      font-size: 14px;
      color: var(--cg-charcoal, #1a202c);
      line-height: 1.6;
    }
    
    /* ---------- Empty State ---------- */
    .alc-empty {
      text-align: center;
      padding: 48px 24px;
      color: var(--cg-ink-soft, #666666);
    }
    
    .alc-empty h3 {
      margin: 0 0 8px;
      font-size: 18px;
      color: var(--cg-charcoal, #1a202c);
    }
    
    .alc-empty p {
      margin: 0;
      font-size: 15px;
    }
    
    /* ---------- Print Styles ---------- */
    @media print {
      .alc-container {
        max-width: none;
        padding: 0;
      }
      
      .alc-timeframe,
      .alc-export {
        display: none;
      }
      
      .alc-metric-card {
        break-inside: avoid;
        border: 1px solid #000;
      }
      
      .alc-table-wrapper {
        border: 1px solid #000;
      }
      
      .alc-table th,
      .alc-table td {
        border-color: #000;
      }
      
      .alc-disclaimer {
        border: 1px solid #000;
        background: #ffffff;
      }
    }
    
    @media (max-width: 640px) {
      .alc-metrics {
        grid-template-columns: 1fr;
      }
      
      .alc-timeframe {
        flex-direction: column;
        align-items: stretch;
      }
      
      .alc-date-range {
        flex-direction: column;
      }
      
      .alc-date-range input {
        width: 100%;
      }
      
      .alc-export {
        flex-direction: column;
      }
      
      .alc-btn {
        width: 100%;
        justify-content: center;
      }
    }
  `;

  // Inject styles
  const styleEl = document.createElement("style");
  styleEl.textContent = STYLES;
  document.head.appendChild(styleEl);

  // State
  let currentTimeframe = "30days";
  let customStart = "";
  let customEnd = "";
  let currentMetrics = null;

  // Render the audit log dashboard
  function render(container, facilityName) {
    container.innerHTML = `
      <div class="alc-container">
        <div class="alc-header">
          <h1>State Audit Readiness & Compliance Log</h1>
          <p>Aggregated non-PHI metrics for state inspection preparation. All data remains on this device.</p>
        </div>
        
        <div class="alc-timeframe">
          <label for="alcTimeframe">Timeframe:</label>
          <select id="alcTimeframe">
            <option value="7days">Last 7 days</option>
            <option value="30days" selected>Last 30 days</option>
            <option value="month">Current month</option>
            <option value="custom">Custom range</option>
          </select>
          
          <div class="alc-date-range" id="alcDateRange" hidden>
            <input type="date" id="alcStart" aria-label="Start date">
            <span>to</span>
            <input type="date" id="alcEnd" aria-label="End date">
          </div>
        </div>
        
        <div class="alc-metrics" id="alcMetrics">
          <!-- Metric cards rendered here -->
        </div>
        
        <div class="alc-table-section">
          <h2>Audit Summary</h2>
          <div class="alc-table-wrapper">
            <table class="alc-table">
              <thead>
                <tr>
                  <th>Date Range</th>
                  <th>Total Activity Sessions</th>
                  <th>Primary Pathways Employed</th>
                  <th>De-escalation Sheets Used</th>
                  <th>Audit Status</th>
                </tr>
              </thead>
              <tbody id="alcTableBody">
                <!-- Table rows rendered here -->
              </tbody>
            </table>
          </div>
        </div>
        
        <div class="alc-export">
          <button type="button" class="alc-btn alc-btn-primary" id="alcExportPdf">
            <span>📄</span> Export Audit PDF Report
          </button>
          <button type="button" class="alc-btn alc-btn-ghost" id="alcExportCsv">
            <span>📊</span> Export CSV
          </button>
          <button type="button" class="alc-btn alc-btn-ghost" id="alcPrint">
            <span>🖨️</span> Print
          </button>
        </div>
        
        <div class="alc-disclaimer">
          <h3>Compliance Disclaimer</h3>
          <p>This log supports a facility's HIPAA privacy practices and CMS compliance. All resident data remains encrypted on this device; no personal health information (PHI) is exposed in aggregated reports. This tool documents adherence to individualized care planning and non-pharmacological behavioral interventions as outlined in F-Tag 742 (Behavioral Health) and F-Tag 679 (Activities). Facility leadership should maintain clinical documentation alongside this activity log.</p>
        </div>
      </div>
    `;
    
    initEventListeners();
    loadMetrics(facilityName);
  }

  // Initialize event listeners
  function initEventListeners() {
    const timeframeSelect = document.getElementById("alcTimeframe");
    const dateRange = document.getElementById("alcDateRange");
    const startDate = document.getElementById("alcStart");
    const endDate = document.getElementById("alcEnd");
    
    timeframeSelect.addEventListener("change", () => {
      currentTimeframe = timeframeSelect.value;
      dateRange.hidden = currentTimeframe !== "custom";
      
      if (currentTimeframe === "custom") {
        const now = new Date();
        const thirtyDays = new Date(now);
        thirtyDays.setDate(thirtyDays.getDate() - 30);
        startDate.value = thirtyDays.toISOString().split("T")[0];
        endDate.value = now.toISOString().split("T")[0];
      }
      
      loadMetrics();
    });
    
    startDate.addEventListener("change", () => {
      customStart = startDate.value;
      if (currentTimeframe === "custom") loadMetrics();
    });
    
    endDate.addEventListener("change", () => {
      customEnd = endDate.value;
      if (currentTimeframe === "custom") loadMetrics();
    });
    
    document.getElementById("alcExportPdf").addEventListener("click", exportPdf);
    document.getElementById("alcExportCsv").addEventListener("click", exportCsv);
    document.getElementById("alcPrint").addEventListener("click", () => window.print());
  }

  // Load and display metrics
  function loadMetrics(facilityName) {
    if (!window.CogniAuditLog) {
      renderEmpty("Audit log service not available. Please refresh the page.");
      return;
    }
    
    const sessionLog = window.CogniAuditLog.readSessionLog();
    const sessions = sessionLog.sessions || [];
    const packetEvents = sessionLog.packetEvents || [];
    
    // For now, generate sample data from packet events
    // In production, this would pull from facility scheduling data
    const augmentedSessions = augmentSessionsFromPackets(packetEvents);
    
    const dateRange = currentTimeframe === "custom" && customStart && customEnd
      ? { start: customStart, end: customEnd }
      : undefined;
    
    currentMetrics = window.CogniAuditLog.aggregateMetrics(
      augmentedSessions,
      packetEvents,
      currentTimeframe,
      dateRange
    );
    
    renderMetrics(currentMetrics);
    renderTable(currentMetrics, facilityName || "Your Facility");
  }

  // Augment session data from packet events (placeholder for when scheduling data is available)
  function augmentSessionsFromPackets(packetEvents) {
    return packetEvents.map(pkt => ({
      id: pkt.id,
      date: pkt.timestamp.split("T")[0],
      time: pkt.timestamp.split("T")[1].slice(0, 5),
      groupId: pkt.groupId || "unknown",
      groupName: pkt.groupName || "Unknown Group",
      wingId: "unknown",
      wingName: "Unknown Wing",
      acuityTier: pkt.acuityTier || 2,
      activityId: pkt.activityId,
      activityName: pkt.activityId,
      pillar: inferPillar(pkt.activityId),
      minutes: inferMinutes(pkt.activityId),
      isCalming: window.CogniAuditLog.isCalming(pkt.activityId),
      packetGenerated: true,
      packetPages: pkt.pages
    }));
  }

  // Infer pillar from activity ID
  function inferPillar(activityId) {
    if (["cognicopia-coloring", "silhouette-match"].includes(activityId)) return "coloring";
    if (["number-ladder", "money-count", "mini-sudoku", "number-tracing"].includes(activityId)) return "numbers";
    if (["word-search", "finish-saying", "scramble", "name-three", "goes-together", "memory-lane", "orientation-board"].includes(activityId)) return "words";
    if (["letter-scramble", "missing-letters", "alphabet-sweep", "letter-tracing"].includes(activityId)) return "letters";
    if (["chair-yoga", "line-tracing", "beanbag-target", "seated-rhythm"].includes(activityId)) return "movement";
    if (["lyric-sheet", "finish-song", "singer-match"].includes(activityId)) return "music";
    return "unknown";
  }

  // Infer minutes from activity ID
  function inferMinutes(activityId) {
    const minutesMap = {
      "cognicopia-coloring": 30,
      "silhouette-match": 15,
      "line-tracing": 15,
      "letter-tracing": 15,
      "number-tracing": 15,
      "chair-yoga": 20,
      "lyric-sheet": 20,
      "orientation-board": 10
    };
    return minutesMap[activityId] || 20;
  }

  // Render metric cards
  function renderMetrics(metrics) {
    const container = document.getElementById("alcMetrics");
    container.innerHTML = `
      <div class="alc-metric-card">
        <h3>Total Sessions</h3>
        <div class="alc-metric-value">${metrics.totalSessions}</div>
        <div class="alc-metric-label">Activity sessions</div>
      </div>
      <div class="alc-metric-card highlight">
        <h3>Packets Generated</h3>
        <div class="alc-metric-value">${metrics.totalPackets}</div>
        <div class="alc-metric-label">Printed materials</div>
      </div>
      <div class="alc-metric-card">
        <h3>Engagement Minutes</h3>
        <div class="alc-metric-value">${formatNumber(metrics.totalEngagementMinutes)}</div>
        <div class="alc-metric-label">Total engagement time</div>
      </div>
      <div class="alc-metric-card">
        <h3>Calming Interventions</h3>
        <div class="alc-metric-value">${metrics.totalCalmingInterventions}</div>
        <div class="alc-metric-label">De-escalation activities</div>
      </div>
    `;
  }

  // Render audit table
  function renderTable(metrics, facilityName) {
    const tbody = document.getElementById("alcTableBody");
    const auditTable = window.CogniAuditLog.buildAuditTable(metrics, facilityName);
    
    if (auditTable.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="alc-empty">No data available for selected timeframe</td></tr>`;
      return;
    }
    
    tbody.innerHTML = auditTable.map(row => `
      <tr>
        <td>${escapeHtml(row.dateRange)}</td>
        <td>${row.totalSessions}</td>
        <td>${escapeHtml(row.primaryPathways)}</td>
        <td>${row.deescalationSheets}</td>
        <td><span class="alc-status-badge alc-status-${row.auditStatus}">${row.auditStatus}</span></td>
      </tr>
    `).join("");
  }

  // Render empty state
  function renderEmpty(message) {
    const container = document.getElementById("alcMetrics");
    if (container) {
      container.innerHTML = `
        <div class="alc-empty" style="grid-column: 1 / -1;">
          <h3>No Data Available</h3>
          <p>${escapeHtml(message)}</p>
        </div>
      `;
    }
  }

  // Export to PDF (using browser print)
  function exportPdf() {
    window.print();
  }

  // Export to CSV
  function exportCsv() {
    if (!currentMetrics) return;
    
    const rows = [
      ["Date Range", "Total Sessions", "Total Packets", "Engagement Minutes", "Calming Interventions", "De-escalation Sheets"],
      [
        currentMetrics.dateRange.start + " to " + currentMetrics.dateRange.end,
        currentMetrics.totalSessions,
        currentMetrics.totalPackets,
        currentMetrics.totalEngagementMinutes,
        currentMetrics.totalCalmingInterventions,
        currentMetrics.deescalationSheets
      ]
    ];
    
    // Add pathway breakdown
    rows.push([]);
    rows.push(["Pathway Breakdown"]);
    Object.entries(currentMetrics.pathwayBreakdown).forEach(([pathway, count]) => {
      rows.push([pathway, count]);
    });
    
    const csv = rows.map(row => row.map(cell => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `cognicopia-audit-log-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Helper functions
  function formatNumber(num) {
    if (num >= 1000) return (num / 1000).toFixed(1) + "k";
    return num.toLocaleString();
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // Public API
  window.CogniAuditLogUI = {
    render
  };
})();
