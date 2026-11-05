/* =====================================================================
   QUICK RESIDENT LOOKUP (builder.html, every screen)
   Ctrl+K (or Cmd+K), or "/" when no field has the keyboard, or the "Find a resident" button, opens a small search
   over the residents saved on this computer: by name, alias or unit number. Choosing one makes them the active
   resident, the one every tool opens filled in for, and says so. On the Shift board, which keeps residents by alias
   only, the lookup shows aliases and never names, and the alias is copied so it can be pasted into a note.

   It reads the same saved profiles the roster reads (BookUI.savedProfiles) and stores nothing. Nothing is sent anywhere.
   @global QuickLookup
   ===================================================================== */
const QuickLookup = (function () {
  "use strict";
  let dlg = null, input = null, list = null, note = null, opener = null, shown = [];
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const MAX = 10;
  const aliasOnly = () => /^#\/shift(\b|\/|\?|$)/.test(location.hash);
  const norm = s => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
  const TIER = { 1: "Early stage", 2: "Middle stage", 3: "Late stage" };

  function all() {
    let list = [];
    try { list = BookUI.savedProfiles(); } catch (e) { list = []; }
    return list.map(p => {
      const t1 = p.tier1_core || {}, name = String(t1.preferredName || "").trim(), alias = typeof cgAlias === "function" ? cgAlias(p) : "Resident", unit = String(t1.unitNumber || "").trim();
      return { id: p.id, name, alias, unit, tier: Number(t1.cognitiveTier) || 0 };
    });
  }
  const initialsOf = r => {
    const src = aliasOnly() || !r.name ? r.alias.replace(/^Resident\s+/i, "") : r.name;
    const parts = src.split(/[\s-]+/).filter(Boolean);
    return (parts.length > 1 ? parts[0].charAt(0) + parts[parts.length - 1].charAt(0) : src.slice(0, 2)).toUpperCase();
  };
  function match(r, text) {
    if (!text) return true;
    const hay = [r.alias, r.unit].concat(aliasOnly() ? [] : [r.name]).map(norm).join(" ");
    return norm(text).split(" ").every(w => hay.indexOf(w) >= 0);
  }

  function build() {
    if (dlg) return;
    dlg = document.createElement("dialog");
    dlg.className = "ql"; dlg.setAttribute("aria-labelledby", "qlH");
    dlg.innerHTML = `<form method="dialog" class="ql-card" id="qlForm">
      <div class="ql-head"><h2 id="qlH">Find a resident</h2><button class="btn ql-x" type="button" id="qlClose" aria-label="Close">&times;</button></div>
      <label class="sr-only" for="qlInput">Search by name, alias or unit number</label>
      <input id="qlInput" type="search" autocomplete="off" autocapitalize="off" spellcheck="false" aria-controls="qlList" placeholder="Start typing a name, alias or room">
      <p class="ql-note" id="qlNote" role="status"></p>
      <ul class="ql-list" id="qlList" aria-label="Matching residents"></ul>
      <p class="ql-hint"><kbd>Up</kbd> <kbd>Down</kbd> to move, <kbd>Enter</kbd> to choose, <kbd>Esc</kbd> to close.</p>
    </form>`;
    document.body.appendChild(dlg);
    input = dlg.querySelector("#qlInput"); list = dlg.querySelector("#qlList"); note = dlg.querySelector("#qlNote");
    dlg.querySelector("#qlForm").addEventListener("submit", e => e.preventDefault());
    dlg.querySelector("#qlClose").addEventListener("click", close);
    dlg.addEventListener("click", e => { if (e.target === dlg) close(); });
    dlg.addEventListener("close", () => { if (opener && opener.isConnected) opener.focus(); });
    input.addEventListener("input", paint);
    input.addEventListener("keydown", e => { if (e.key === "ArrowDown") { e.preventDefault(); const f = list.querySelector("button"); if (f) f.focus(); } else if (e.key === "Enter") { e.preventDefault(); const f = list.querySelector("button"); if (f) f.click(); } });
    list.addEventListener("keydown", e => {
      const b = e.target.closest("button"); if (!b) return;
      if (e.key === "ArrowDown") { e.preventDefault(); const n = b.closest("li").nextElementSibling; if (n) n.querySelector("button").focus(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); const p = b.closest("li").previousElementSibling; if (p) p.querySelector("button").focus(); else input.focus(); }
    });
    list.addEventListener("click", e => { const b = e.target.closest("button[data-id]"); if (b) choose(b.getAttribute("data-id")); });
  }
  function paint() {
    const only = aliasOnly(), text = input.value, found = all().filter(r => match(r, text));
    shown = found.slice(0, MAX);
    list.innerHTML = shown.map(r => `<li><button type="button" class="ql-row" data-id="${esc(r.id)}"><span class="ql-av" aria-hidden="true">${esc(initialsOf(r))}</span>
      <span class="ql-who"><b class="${only || !r.name ? "" : "ops-name"}">${esc(only || !r.name ? r.alias : r.name)}</b><small>${esc([only || !r.name ? "" : r.alias, TIER[r.tier] || ""].filter(Boolean).join(" · "))}</small></span></button></li>`).join("");
    note.textContent = !found.length ? (all().length ? "Nobody matches that. Try fewer letters." : "No residents are saved on this computer yet. Add them in the roster or the profile.")
      : found.length > MAX ? `Showing ${MAX} of ${found.length}. Type more to narrow it.` : `${found.length} ${found.length === 1 ? "resident" : "residents"}.`;
    if (only) note.textContent += " The Shift board shows aliases only.";
  }
  function choose(id) {
    const r = all().filter(x => x.id === id)[0]; if (!r) return;
    const only = aliasOnly(), label = only || !r.name ? r.alias : r.name;
    try { ActiveResident.set(id); } catch (e) { /* the chosen resident simply is not remembered */ }
    if (only && navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(r.alias).catch(() => {});
    close();
    toast(label + " is now the active resident." + (only ? " Their alias is copied, ready to paste into a note." : ""));
  }
  function open(from) {
    build(); opener = from || document.activeElement;
    input.value = ""; paint();
    if (!dlg.open) dlg.showModal();
    input.focus();
  }
  function close() { if (dlg && dlg.open) dlg.close(); }
  function typing(el) { return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)); }

  document.addEventListener("keydown", e => {
    if (!document.getElementById("view")) return;                       // only inside the Packet Builder
    if ((e.ctrlKey || e.metaKey) && !e.altKey && String(e.key).toLowerCase() === "k") { e.preventDefault(); if (dlg && dlg.open) close(); else open(); return; }
    if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey && !typing(document.activeElement) && !(dlg && dlg.open)) { e.preventDefault(); open(); }
  });
  return { open, close };
})();
