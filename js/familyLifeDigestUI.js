/* =====================================================================
   Family Life Digest drawer. Host pages call CogniFamilyDigestUI.open().
   Notes live only in this session unless the host saves them to the
   resident's local encrypted profile. PDFs are drawn in the browser with
   the site's own jsPDF copy. No network of its own.
   ===================================================================== */
(function(){
  "use strict";

  const STYLES = `
    .fld-root{position:fixed;inset:0;z-index:2400;display:none}
    .fld-root.is-open{display:block}
    .fld-scrim{position:absolute;inset:0;background:rgba(11,26,19,.55)}
    .fld-panel{
      position:absolute;top:0;right:0;bottom:0;
      width:min(32rem,100vw);background:var(--cg-cream,#fbf7f1);color:var(--cg-charcoal,#1a202c);
      display:flex;flex-direction:column;box-shadow:-16px 0 48px rgba(11,26,19,.28);
      font-family:"Cognicopia UI","Atkinson Hyperlegible","Trebuchet MS",sans-serif;
    }
    .fld-head,.fld-foot{flex:none;display:flex;align-items:center;gap:12px;padding:16px 20px;
      background:var(--cg-parchment,#f4efe6);border-color:var(--cg-tan-200,#ddd1ba)}
    .fld-head{justify-content:space-between;border-bottom:2px solid var(--cg-tan-200,#ddd1ba)}
    .fld-foot{justify-content:flex-end;flex-wrap:wrap;border-top:2px solid var(--cg-tan-200,#ddd1ba)}
    .fld-head h2{margin:0;font-size:1.25rem;line-height:1.25;color:var(--cg-green-700,#1b382b);
      font-family:Fraunces,Georgia,serif;font-weight:700}
    .fld-body{flex:1;overflow:auto;padding:20px;display:flex;flex-direction:column;gap:18px}
    .fld-field label.fld-lab,.fld-field > .fld-lab{display:block;font-weight:700;margin-bottom:8px;font-size:1rem}
    .fld-hint{margin:.35rem 0 0;font-size:.9rem;color:var(--cg-ink-soft,#3d4a5c)}
    .fld-input,.fld-textarea{
      width:100%;min-height:var(--tap,52px);padding:12px 14px;box-sizing:border-box;
      border:2px solid var(--cg-tan-200,#ddd1ba);border-radius:10px;background:#fff;
      color:var(--cg-charcoal,#1a202c);font:inherit;font-size:1rem}
    .fld-textarea{min-height:7.5rem;resize:vertical}
    .fld-input:focus,.fld-textarea:focus,.fld-close:focus-visible,.fld-btn:focus-visible,.fld-tag:has(input:focus-visible),.fld-toggle:has(input:focus-visible){
      outline:3px solid var(--cg-gold-500,#c5a059);outline-offset:2px;
      box-shadow:0 0 0 5px var(--cg-green-700,#1b382b)}
    .fld-tags{display:grid;gap:8px;grid-template-columns:1fr}
    .fld-tag,.fld-toggle{
      display:flex;align-items:flex-start;gap:10px;min-height:var(--tap,52px);padding:10px 12px;
      border:2px solid var(--cg-tan-200,#ddd1ba);border-radius:10px;background:#fff;cursor:pointer}
    .fld-tag:has(input:checked),.fld-toggle:has(input:checked){border-color:var(--cg-green-700,#1b382b);background:var(--cg-sage-100,#e3f1e8)}
    .fld-tag input,.fld-toggle input{width:24px;height:24px;flex:none;accent-color:var(--cg-green-700,#1b382b);margin-top:2px}
    .fld-count{text-align:right;font-size:.85rem;margin-top:4px;color:var(--cg-ink-soft,#3d4a5c)}
    .fld-count.is-warn{color:var(--cg-clay-700,#8a3a20);font-weight:700}
    .fld-close,.fld-btn{min-width:var(--tap,52px);min-height:var(--tap,52px);padding:0 18px;border-radius:10px;
      font:inherit;font-weight:700;cursor:pointer}
    .fld-close{display:inline-flex;align-items:center;justify-content:center;border:2px solid var(--cg-gold-500,#c5a059);
      background:transparent;color:var(--cg-green-700,#1b382b);font-size:1.5rem;line-height:1}
    .fld-btn-primary{border:2px solid var(--cg-green-700,#1b382b);background:var(--cg-green-700,#1b382b);color:#fff}
    .fld-btn-ghost{border:2px solid var(--cg-tan-400,#b5a48b);background:transparent;color:var(--cg-charcoal,#1a202c)}
    .fld-btn:disabled{opacity:.5;cursor:not-allowed}
    .fld-error{display:none;padding:10px 12px;border-radius:8px;background:#ffe3db;color:#5a1a0c}
    .fld-error.is-on{display:block}
    .fld-privacy{margin:0;font-size:.9rem}
    @media (prefers-reduced-motion:reduce){.fld-panel{box-shadow:none}}
  `;

  let root = null, session = null, lastFocus = null, pdfKit = null;

  function esc(s){
    return String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }
  function $(id){ return root ? root.querySelector("#" + id) : null; }
  function D(){ return window.CogniFamilyDigest; }

  function loadPdfKit(){
    if (window.CogniLibrary && typeof window.CogniLibrary.loadPdfKit === "function") return window.CogniLibrary.loadPdfKit();
    if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
    if (pdfKit) return pdfKit;
    const add = src => new Promise((ok, fail) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = ok;
      s.onerror = () => fail(new Error("Could not load the print library."));
      document.head.appendChild(s);
    });
    pdfKit = add("assets/vendor/jspdf.umd.min.js").then(() => add("assets/vendor/jspdf-atkinson.js")).then(() => window.jspdf.jsPDF, e => { pdfKit = null; throw e; });
    return pdfKit;
  }

  function inject(){
    if (root) return;
    if (!document.getElementById("fld-css")){
      const st = document.createElement("style");
      st.id = "fld-css";
      st.textContent = STYLES;
      document.head.appendChild(st);
    }
    root = document.createElement("div");
    root.className = "fld-root";
    root.id = "familyLifeDigestModal";
    root.setAttribute("hidden", "");
    root.innerHTML = [
      '<div class="fld-scrim" data-fld-close="1"></div>',
      '<div class="fld-panel" role="dialog" aria-modal="true" aria-labelledby="fldTitle" tabindex="-1">',
      '  <div class="fld-head"><h2 id="fldTitle">Generate Family Life Digest</h2>',
      '    <button type="button" class="fld-close" id="fldClose" aria-label="Close">×</button></div>',
      '  <div class="fld-body">',
      '    <p class="fld-privacy">This one-page note is made on this computer. It is for family or a care-plan meeting. No resident data leaves the device.</p>',
      '    <div class="fld-field"><label class="fld-lab" for="fldActivityType">Activity</label>',
      '      <input class="fld-input" id="fldActivityType" maxlength="100"></div>',
      '    <div class="fld-field"><label class="fld-lab" for="fldSessionDate">Session date</label>',
      '      <input class="fld-input" id="fldSessionDate" type="date" required></div>',
      '    <div class="fld-field"><span class="fld-lab" id="fldTagsLab">Observations</span>',
      '      <div class="fld-tags" id="fldTags" role="group" aria-labelledby="fldTagsLab"></div></div>',
      '    <div class="fld-field"><label class="fld-lab" for="fldCustomNotes">Custom care notes <span style="font-weight:400">(optional, 280 characters)</span></label>',
      '      <textarea class="fld-textarea" id="fldCustomNotes" maxlength="280" placeholder="A short, dignified note about how the session went."></textarea>',
      '      <div class="fld-count" id="fldCharCount">0 / 280</div></div>',
      '    <label class="fld-toggle"><input type="checkbox" id="fldIncludeBio" checked>',
      '      <span>Include biographical focus points from the local profile</span></label>',
      '    <p class="fld-hint">Hometown, work, hobbies and interests already saved on this computer. Clinical details stay off the page.</p>',
      '    <div class="fld-field"><label class="fld-lab" for="fldStaffInitials">Staff initials <span style="font-weight:400">(optional)</span></label>',
      '      <input class="fld-input" id="fldStaffInitials" maxlength="8" autocomplete="off"></div>',
      '    <label class="fld-toggle" id="fldSaveWrap" hidden><input type="checkbox" id="fldSaveNotes">',
      '      <span>Save these notes on this computer with the resident’s profile</span></label>',
      '    <div class="fld-error" id="fldError" role="alert"></div>',
      '  </div>',
      '  <div class="fld-foot">',
      '    <button type="button" class="fld-btn fld-btn-ghost" id="fldCancel">Cancel</button>',
      '    <button type="button" class="fld-btn fld-btn-primary" id="fldGenerate">Generate PDF</button>',
      '  </div></div>'
    ].join("");
    document.body.appendChild(root);
    bind();
  }

  function fillTags(){
    const box = $("fldTags");
    const tags = D() && D().OBSERVATION_TAGS ? D().OBSERVATION_TAGS : [];
    box.innerHTML = tags.map(t => '<label class="fld-tag"><input type="checkbox" name="fldTag" value="' + esc(t.id) + '"><span>' + esc(t.label) + "</span></label>").join("");
  }

  function showError(msg){
    const el = $("fldError");
    el.textContent = msg || "";
    el.classList.toggle("is-on", !!msg);
  }

  function countNotes(){
    const n = ($("fldCustomNotes").value || "").length;
    const el = $("fldCharCount");
    el.textContent = n + " / 280";
    el.classList.toggle("is-warn", n > 250);
  }

  function collectInput(){
    const tags = Array.prototype.map.call(root.querySelectorAll('input[name="fldTag"]:checked'), el => el.value);
    return {
      residentId: session.residentId,
      sessionDate: $("fldSessionDate").value,
      activityType: $("fldActivityType").value.trim(),
      observationTags: tags,
      customNotes: $("fldCustomNotes").value.trim() || undefined,
      includeBioFocus: $("fldIncludeBio").checked,
      staffInitials: $("fldStaffInitials").value.trim() || undefined
    };
  }

  function focusables(){
    return Array.prototype.filter.call(root.querySelectorAll("a,button,input,textarea,select,[tabindex]:not([tabindex='-1'])"), el => !el.disabled && el.offsetParent !== null);
  }

  function onKey(e){
    if (!root.classList.contains("is-open")) return;
    if (e.key === "Escape"){ e.preventDefault(); close(); return; }
    if (e.key !== "Tab") return;
    const list = focusables();
    if (!list.length) return;
    const first = list[0], last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
  }

  async function generate(){
    showError("");
    if (!D()){ showError("The Family Life Digest tool is not available. Refresh the page."); return; }
    const input = collectInput();
    const bad = D().validateDigestInput(input);
    if (bad){ showError(bad); return; }
    const btn = $("fldGenerate");
    btn.disabled = true;
    btn.textContent = "Generating…";
    try {
      const JsPDF = await loadPdfKit();
      const doc = new JsPDF({ unit: "pt", format: "letter", orientation: "portrait" });
      const split = function(text, width, size, bold){
        doc.setFont("helvetica", bold ? "bold" : "normal");
        doc.setFontSize(size);
        const lines = doc.splitTextToSize(text, width);
        return Array.isArray(lines) ? lines : [String(lines)];
      };
      const page = D().planDigest(input, session.residentData, split);
      D().draw(doc, page);
      const filename = D().digestFilename(session.residentData.firstName, D().formatDate(input.sessionDate));
      if (typeof doc.save === "function") doc.save(filename);
      else {
        const a = document.createElement("a");
        a.href = doc.output("dataurlstring");
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      if ($("fldSaveNotes").checked && typeof session.onSaveNotes === "function" && input.customNotes){
        try { session.onSaveNotes(input.customNotes, input); } catch (err){ /* host save is optional */ }
      }
      close();
    } catch (err){
      showError(err && err.message ? err.message : "The PDF could not be made on this computer.");
    } finally {
      btn.disabled = false;
      btn.textContent = "Generate PDF";
    }
  }

  function bind(){
    $("fldClose").addEventListener("click", close);
    $("fldCancel").addEventListener("click", close);
    $("fldGenerate").addEventListener("click", generate);
    $("fldCustomNotes").addEventListener("input", countNotes);
    root.addEventListener("click", e => { if (e.target && e.target.getAttribute("data-fld-close")) close(); });
    document.addEventListener("keydown", onKey);
  }

  function todayISO(){
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + day;
  }

  function open(residentId, activityType, residentData, sessionDate, onSaveNotes){
    inject();
    fillTags();
    session = {
      residentId: String(residentId || ""),
      residentData: residentData && typeof residentData === "object" ? residentData : { firstName: "Resident" },
      onSaveNotes: typeof onSaveNotes === "function" ? onSaveNotes : null
    };
    lastFocus = document.activeElement;
    $("fldActivityType").value = activityType || "";
    $("fldSessionDate").value = sessionDate || todayISO();
    $("fldCustomNotes").value = "";
    $("fldStaffInitials").value = "";
    $("fldIncludeBio").checked = true;
    $("fldSaveNotes").checked = false;
    $("fldSaveWrap").hidden = !session.onSaveNotes;
    Array.prototype.forEach.call(root.querySelectorAll('input[name="fldTag"]'), el => { el.checked = false; });
    countNotes();
    showError("");
    root.classList.add("is-open");
    root.removeAttribute("hidden");
    document.body.style.overflow = "hidden";
    $("fldClose").focus();
  }

  function close(){
    if (!root) return;
    root.classList.remove("is-open");
    root.setAttribute("hidden", "");
    document.body.style.overflow = "";
    session = null;
    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
  }

  function ready(fn){
    if (document.body) fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  window.CogniFamilyDigestUI = {
    open: function(residentId, activityType, residentData, sessionDate, onSaveNotes){
      ready(function(){ open(residentId, activityType, residentData, sessionDate, onSaveNotes); });
    },
    close: close,
    init: function(){ ready(inject); }
  };
  ready(inject);
})();
