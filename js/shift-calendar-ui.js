/* =====================================================================
   SHIFT BOARD CALENDAR (builder.html#/shift): the screen
   The Shift board opens on a calendar (Month, Week or Day) that shows who is on each shift, where the gaps are,
   and where the floor is likely to need a steady, dementia-trained hand. Notes, tasks and the handoff sheets
   (the board this page always had) sit in a slide-out panel, opened with "Notes & tasks", so the calendar stays in front.

   Logic: CogniShiftCal (js/shift-calendar.js, pure). The board's notes, tasks and engagement records: CogniDailyOps
   (assets/services/dailyOps.js) through DailyOpsUI. This file only draws and wires them.

   Privacy: staff appear by initials only; residents by alias only (the board's rule). The calendar record
   ("cognicopia_shiftcal": initials, roles, skills, who is on which shift) holds nothing about a resident and is
   kept on this computer; the board's notes and records stay in the encrypted store as before. The staffing insight
   is read from the board's records in memory and never copied into the calendar record. Nothing is sent anywhere.
   ===================================================================== */
const ShiftCalUI = (function () {
  "use strict";
  const C = window.CogniShiftCal, D = window.CogniDailyOps;
  const S = { view: "month", day: "", shift: "all", skill: "", drawer: false, focusDay: "" };
  let root = null, cal = null, board = null, opener = null;

  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pl = (n, one, many) => n + " " + (n === 1 ? one : many);
  const q = sel => root.querySelector(sel);
  const svg = (d, n) => `<svg width="${n || 18}" height="${n || 18}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;
  const IC = {
    ok: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
    open: '<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    none: '<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>',
    prev: '<path d="M15 6l-6 6 6 6"/>', next: '<path d="M9 6l6 6-6 6"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>',
    task: '<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/>',
    pdf: '<path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6M12 12v6M9 15l3 3 3-3"/>', notes: '<path d="M4 4h16v13H8l-4 4z"/><path d="M8 9h8M8 13h5"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>', people: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>'
  };

  /* ---------- the two records ---------- */
  function readCal() {
    let raw = null;
    try { raw = CG_LS.getItem(C.STORE_KEY); } catch (e) { raw = null; }
    try { return C.normalize(raw ? JSON.parse(raw) : null); } catch (e) { return C.emptyCalendar(); }
  }
  function writeCal(next) {
    if (!next || next.error) { toast(next && next.error ? next.error : "That could not be done."); return false; }
    try { CG_LS.setItem(C.STORE_KEY, JSON.stringify(next)); cal = next; return true; }
    catch (e) { toast("The calendar could not be saved: " + (e && e.message || e)); return false; }
  }
  function readBoard() { try { return D.normalizeBoard(CG_LS.getItem(D.STORE_KEY)); } catch (e) { return D.emptyBoard(); } }
  const todayISO = () => D.slotAt().day;
  const engagements = () => (board && board.engagements) || [];
  const wing = () => (typeof settings !== "undefined" && settings.activeWing) || null;     // the wing the board is showing, as the board itself uses it
  const shiftsShown = () => (S.shift === "all" ? C.SHIFTS.map(s => s.id) : [S.shift]);
  const initialsOf = id => { const s = C.staffById(cal, id); return s ? s.initials : "?"; };
  const skillShort = id => (C.SKILLS.filter(k => k.id === id)[0] || { short: id }).short;
  const roleLabel = id => (C.ROLES.filter(r => r.id === id)[0] || { label: "Other" }).label;
  const matchesSkill = p => !S.skill || p.skills.indexOf(S.skill) >= 0;

  /* a day as the tiles show it: coverage of the shifts being shown, the memory-care flag, and what the board holds for it */
  function tileFor(day) {
    const ids = shiftsShown(), parts = ids.map(id => C.coverage(cal, day, id)), planned = parts.some(p => p.planned);
    const open = parts.filter(p => p.level !== "full" && (p.needed > 0 || p.specialistsNeeded > 0));
    const pr = C.dayPressure(engagements(), day);
    const watch = D.notesFor(board, day, S.shift, wing()).filter(n => n.kind === "watch").length;
    /* the purple badge means something for THAT day: its own weekday's records show high distress, or the general pattern is high and a note on that day says to keep an eye on someone */
    const high = ids.filter(id => pr[id].level === "high" && (pr[id].basis === "weekday" || watch > 0));
    const tasks = D.tasksFor(board, day, S.shift, todayISO(), wing()).today.filter(t => !t.done).length;
    return { day, parts, planned, level: !planned ? "none" : open.length ? "open" : "full", openShifts: open.length, memoryCare: high.length > 0, high, watch, tasks };
  }
  function badgeOf(t) {
    if (t.level === "none") return { cls: "none", icon: IC.none, text: "Not planned", short: "Not planned" };
    if (t.level === "open") return { cls: "open", icon: IC.open, text: t.openShifts === 1 ? "1 open shift" : t.openShifts + " open shifts", short: t.openShifts + " open" };
    return { cls: "full", icon: IC.ok, text: "Fully staffed", short: "Staffed" };
  }
  /* each badge has an icon and words; the words shorten, then drop away, as the tile narrows (the full words stay in the title and the spoken label) */
  const badgesHtml = (t, tile) => {
    const b = badgeOf(t);
    if (tile && t.level === "none" && !t.memoryCare) return "";
    return (tile && t.level === "none" ? "" : `<span class="shc-b shc-b-${b.cls}" title="${esc(b.text)}">${svg(b.icon, 14)}<span>${esc(tile ? b.short : b.text)}</span></span>`) +
      (t.memoryCare ? `<span class="shc-b shc-b-mem" title="High memory care need">${svg(IC.heart, 14)}<span>${tile ? "Memory" : "Memory care need"}</span></span>` : "");
  };
  const miniOf = t => t.parts.map(p => `<span class="shc-mini-i is-${p.level}" title="${esc(C.shiftLabel(p.shift))}: ${p.assigned} of ${p.needed}">${esc(C.shiftLabel(p.shift).charAt(0))} ${p.assigned}/${p.needed}</span>`).join("");
  function spokenDay(t) {
    const b = badgeOf(t), bits = [C.dayLong(t.day), b.text];
    if (t.memoryCare) bits.push("high memory care need on " + t.high.map(C.shiftLabel).join(" and ").toLowerCase());
    if (t.watch) bits.push(pl(t.watch, "note to watch", "notes to watch"));
    if (t.tasks) bits.push(pl(t.tasks, "open task", "open tasks"));
    return bits.join(". ");
  }

  /* ---------- the page ---------- */
  function render(view) {
    if (!C || !D) {
      view.innerHTML = `<p class="eyebrow">Facility</p><h1 class="view-title" tabindex="-1">Shift board</h1><p class="callout">The Shift board could not load. Check that js/shift-calendar.js and assets/services/dailyOps.js are on this site, then reload.</p>`;
      return;
    }
    cal = readCal(); board = readBoard();
    if (!S.day) S.day = todayISO();
    S.drawer = false;
    view.innerHTML = `<p class="eyebrow">Facility</p>
      <h1 class="view-title" tabindex="-1">Shift board</h1>
      <p class="lede">Who is on each shift, where the gaps are, and where the floor will want a steady, dementia-trained hand. Initials and aliases only; everything stays on this computer.</p>
      <div class="shc" id="shcRoot">
        <div class="shc-bar" role="toolbar" aria-label="Calendar tools">
         <div class="shc-row">
          <div class="shc-views seg" role="radiogroup" aria-label="Calendar view" id="shcViews"></div>
          <div class="shc-nav" role="group" aria-label="Move the calendar">
            <button class="btn shc-icon" type="button" data-act="prev" aria-label="Earlier">${svg(IC.prev, 22)}</button>
            <button class="btn" type="button" data-act="today">Today</button>
            <button class="btn shc-icon" type="button" data-act="next" aria-label="Later">${svg(IC.next, 22)}</button>
            <h2 class="shc-title" id="shcTitle" aria-live="polite"></h2>
          </div>
          <div class="shc-filters">
            <div class="field"><label for="shcShift">Shift</label><select id="shcShift"><option value="all">All shifts</option>${C.SHIFTS.map(s => `<option value="${s.id}">${esc(s.label)}</option>`).join("")}</select></div>
            <div class="field"><label for="shcSkill">Staff</label><select id="shcSkill"><option value="">Everyone</option>${C.SKILLS.map(k => `<option value="${k.id}">${esc(k.label)}</option>`).join("")}</select></div>
          </div>
         </div>
         <div class="shc-row shc-row-tools">
          <div class="shc-tools">
            <button class="btn btn-primary" type="button" id="shcPdf">${svg(IC.pdf)}<span>Weekly schedule PDF</span></button>
            <button class="btn" type="button" id="shcOpenBoard" aria-expanded="false" aria-controls="shcDrawer">${svg(IC.notes)}<span>Notes &amp; tasks</span></button>
            <button class="btn" type="button" id="shcLookup" title="Quick resident lookup (Ctrl+K)">${svg(IC.search)}<span>Find a resident</span></button>
          </div>
         </div>
        </div>
        <div class="shc-main">
          <section class="shc-cal" id="shcCal" aria-label="Shift calendar"></section>
          <aside class="shc-rail" id="shcRail" aria-label="Staffing insight and selected day"></aside>
        </div>
        <div class="shc-scrim" id="shcScrim" hidden></div>
        <aside class="shc-drawer" id="shcDrawer" role="dialog" aria-modal="false" aria-labelledby="shcDrawerH" hidden>
          <div class="shc-drawer-head"><h2 id="shcDrawerH">Notes, tasks &amp; handoff</h2><button class="btn shc-icon" type="button" id="shcCloseBoard" aria-label="Close notes and tasks">${svg(IC.x, 22)}</button></div>
          <div class="shc-drawer-body" id="shcBoard"></div>
        </aside>
      </div>`;
    root = document.getElementById("shcRoot");
    root.addEventListener("click", onClick); root.addEventListener("change", onChange); root.addEventListener("submit", onSubmit); root.addEventListener("keydown", onKey);
    document.removeEventListener("keydown", onDocKey); document.addEventListener("keydown", onDocKey);
    paint();
  }
  function paint() {
    if (!root || !root.isConnected) return;
    q("#shcViews").innerHTML = ["month", "week", "day"].map(v => `<label><input type="radio" name="shcView" value="${v}" ${S.view === v ? "checked" : ""}><span>${v.charAt(0).toUpperCase() + v.slice(1)}</span></label>`).join("");
    q("#shcShift").value = S.shift; q("#shcSkill").value = S.skill;
    q("#shcTitle").textContent = S.view === "month" ? C.monthLabel(S.day) : S.view === "week" ? C.weekLabel(S.day) : C.dayLong(S.day);
    q("#shcCal").innerHTML = S.view === "month" ? monthHtml() : S.view === "week" ? weekHtml() : dayHtml();
    q("#shcRail").innerHTML = railHtml();
    if (S.focusDay) { const b = root.querySelector(`[data-day="${S.focusDay}"]`); if (b) b.focus(); S.focusDay = ""; }
  }

  /* ---------- the three views ---------- */
  function monthHtml() {
    const grid = C.monthGrid(S.day), td = todayISO(), head = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const rows = [];
    for (let r = 0; r < 6; r++) {
      const cells = grid.slice(r * 7, r * 7 + 7).map(c => {
        const t = tileFor(c.day), cls = ["shc-day", c.inMonth ? "" : "is-out", c.day === S.day ? "is-sel" : "", c.day === td ? "is-today" : "", "is-" + t.level].join(" ").replace(/\s+/g, " ").trim();
        return `<td><button type="button" class="${cls}" data-day="${c.day}" aria-pressed="${c.day === S.day}" aria-label="${esc(spokenDay(t))}">
          <span class="shc-num">${+c.day.slice(8)}</span>
          <span class="shc-badges">${badgesHtml(t, true)}</span>
          ${t.planned ? `<span class="shc-mini">${miniOf(t)}</span>` : ""}
          ${t.watch || t.tasks ? `<span class="shc-care">${t.watch ? `<span title="Notes to keep an eye on">${svg(IC.eye, 14)}${t.watch}</span>` : ""}${t.tasks ? `<span title="Open tasks">${svg(IC.task, 14)}${t.tasks}</span>` : ""}</span>` : ""}
        </button></td>`;
      });
      if (r === 5 && !grid.slice(35).some(c => c.inMonth)) continue;      // a month that fits in five weeks shows five
      rows.push(`<tr>${cells.join("")}</tr>`);
    }
    return `<table class="shc-month"><caption class="sr-only">${esc(C.monthLabel(S.day))}: one button for each day</caption><thead><tr>${head.map(h => `<th scope="col">${h}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table>`;
  }
  function staffChips(people) {
    const shown = people.filter(matchesSkill);
    if (!people.length) return `<span class="shc-none">Not planned</span>`;
    if (!shown.length) return `<span class="shc-none">None with that skill</span>`;
    return shown.map(p => `<span class="shc-chip" title="${esc(roleLabel(p.role))}${p.skills.length ? ": " + esc(p.skills.map(skillShort).join(", ")) : ""}"><b>${esc(p.initials)}</b>${p.skills.indexOf("dementia") >= 0 ? `<i class="shc-star" aria-label="Dementia care trained" title="Dementia care trained">${svg(IC.heart, 11)}</i>` : ""}</span>`).join("");
  }
  function shiftBlock(day, id, big) {
    const c = C.coverage(cal, day, id), pr = C.dayPressure(engagements(), day)[id], notes = D.notesFor(board, day, id, wing()), watch = notes.filter(n => n.kind === "watch");
    const need = big ? (c.gap ? `${pl(c.gap, "more person", "more people")} needed` : "") : (c.gap ? `${c.gap} open` : ""), spec = big ? (c.specialistGap ? `${pl(c.specialistGap, "more dementia-trained person", "more dementia-trained people")} wanted` : "") : (c.specialistGap ? `${c.specialistGap} trained` : "");
    const mem = pr.level === "high" && (pr.basis === "weekday" || watch.length > 0);
    return `<div class="shc-shift is-${c.level}${mem ? " is-high" : ""}">
      <div class="shc-shift-h"><b>${esc(C.shiftLabel(id))}</b><span>${c.assigned}/${c.needed}</span>${mem ? `<span class="shc-b shc-b-mem" title="High memory care need">${svg(IC.heart, 12)}<span>${big ? "Memory care need" : "Memory"}</span></span>` : ""}</div>
      <div class="shc-chips">${staffChips(c.people)}</div>
      ${c.planned && (need || spec) ? `<p class="shc-gap">${svg(IC.open, 14)}<span>${esc([need, spec].filter(Boolean).join(big ? "; " : " + "))}</span></p>` : ""}
      ${big ? `<ul class="shc-notes">${watch.slice(0, 4).map(n => `<li>${svg(IC.eye, 14)}<span><b>${esc(n.about || "General")}</b> ${esc(n.text.length > 110 ? n.text.slice(0, 107) + "..." : n.text)}</span></li>`).join("") || `<li class="shc-quiet">Nothing marked to keep an eye on.</li>`}</ul>` : ""}
    </div>`;
  }
  function weekHtml() {
    const days = C.weekDays(S.day), td = todayISO();
    return `<div class="shc-week">${days.map(d => { const t = tileFor(d);
      return `<article class="shc-wday${d === S.day ? " is-sel" : ""}${d === td ? " is-today" : ""}">
        <button type="button" class="shc-wday-h" data-day="${d}" aria-pressed="${d === S.day}" aria-label="${esc(spokenDay(t))}"><span>${esc(C.dayShort(d))}</span><span class="shc-badges">${badgesHtml(t, true)}</span></button>
        ${shiftsShown().map(id => shiftBlock(d, id, false)).join("")}
      </article>`; }).join("")}</div>`;
  }
  function dayHtml() {
    const t = tileFor(S.day);
    return `<div class="shc-dayview"><div class="shc-dayview-h"><span class="shc-badges">${badgesHtml(t)}</span>${t.watch || t.tasks ? `<span class="shc-care">${t.watch ? `<span>${svg(IC.eye, 14)}${pl(t.watch, "note to watch", "notes to watch")}</span>` : ""}${t.tasks ? `<span>${svg(IC.task, 14)}${pl(t.tasks, "open task", "open tasks")}</span>` : ""}</span>` : ""}</div>
      <div class="shc-dayshifts">${shiftsShown().map(id => shiftBlock(S.day, id, true)).join("")}</div></div>`;
  }

  /* ---------- the rail: staffing insight, the chosen day, the staff list, the key ---------- */
  const LEVEL_WORDS = { high: "High", moderate: "Moderate", low: "Low", unknown: "Not enough records yet" };
  function insightHtml() {
    const all = C.insight(engagements()), rows = shiftsShown().map(id => {
      const sg = C.suggest(cal, S.day, id, engagements()), b = sg.basis;
      return `<li class="shc-ins is-${sg.level}"><div class="shc-ins-h"><b>${esc(C.shiftLabel(id))}</b><span class="shc-lvl">${esc(LEVEL_WORDS[sg.level])}</span></div>
        <p class="shc-sub">${sg.level === "unknown" ? `${pl(b.n, "record", "records")} so far; ${C.RULES.MIN_RECORDS} are needed to say anything.` : `${Math.round(b.share * 100)}% of ${pl(b.n, "record", "records")} show restlessness, upset, sadness, distraction, overstimulation or an activity put off${b.basis === "weekday" ? ` (this day of the week)` : ""}.`}</p>
        ${sg.flags.map(f => `<p class="shc-flag">${svg(IC.open, 16)}<span>${esc(f)}</span></p>`).join("")}
        ${sg.pairs.length ? `<ul class="shc-pairs">${sg.pairs.map(p => `<li><span class="ops-name">${esc(p.alias)}</span><span>${p.staff ? `suggested with <b>${esc(p.staff.initials)}</b>${p.skills.length ? ` (${esc(p.skills.join(", "))})` : ""}` : "nobody trained is on this shift"}</span><small>${esc(p.why)}</small></li>`).join("")}</ul>` : ""}
      </li>`;
    }).join("");
    return `<section class="shc-card shc-insight" aria-labelledby="shcInsH"><h3 id="shcInsH">Staffing insight</h3>
      <p class="shc-sub">Counted from the activity and mood records on this board, by shift. It shows where help was most needed so far, and it suggests pairings for you to accept or ignore. It is a count, not a forecast.${all.total ? "" : ""}</p>
      <ul class="shc-ins-list">${rows}</ul>
      ${all.enough ? `<p class="shc-sub">${pl(all.total, "record", "records")} in all${all.peakHour != null ? `; the busiest hour for distress was about ${esc(C.hourLabel(all.peakHour))}` : ""}.</p>`
        : `<p class="shc-sub">This fills in as staff record activities and moods under <b>Notes &amp; tasks</b>. Many memory care teams plan extra support in the late afternoon; the <a href="resources/research/case-late-afternoon/">Research Center</a> has a case summary.</p>`}
    </section>`;
  }
  function dayEditorHtml() {
    const d = S.day, dbl = C.doubles(cal, d);
    return `<section class="shc-card" aria-labelledby="shcDayH"><h3 id="shcDayH" tabindex="-1">${esc(C.dayLong(d))}</h3>
      ${dbl.length ? `<p class="shc-sub">${esc(dbl.map(x => x.staff.initials).join(", "))} ${dbl.length === 1 ? "is" : "are"} on more than one shift today.</p>` : ""}
      ${C.SHIFTS.map(sh => {
        const c = C.coverage(cal, d, sh.id), free = cal.staff.filter(s => !c.people.some(p => p.id === s.id)), cls = c.level;
        return `<div class="shc-slot is-${cls}" data-shift="${sh.id}"><div class="shc-slot-h"><b>${esc(sh.label)}</b><small>${esc(sh.hours)}</small></div>
          <p class="shc-cov is-${cls}">${c.assigned} of ${c.needed} on${c.specialistsNeeded || c.specialists ? `; ${c.specialists} dementia-trained of ${c.specialistsNeeded} wanted` : ""}</p>
          <ul class="shc-who">${c.people.map(p => `<li><span class="shc-chip"><b>${esc(p.initials)}</b></span><small>${esc(roleLabel(p.role))}</small>
            ${free.length ? `<select aria-label="Swap ${esc(p.initials)} on the ${esc(sh.label)} shift with" data-swap="${p.id}"><option value="">Swap with...</option>${free.map(f => `<option value="${f.id}">${esc(f.initials)}</option>`).join("")}</select>` : ""}
            <button class="btn shc-icon" type="button" data-act="unassign" data-staff="${p.id}" aria-label="Take ${esc(p.initials)} off the ${esc(sh.label)} shift">${svg(IC.x, 18)}</button></li>`).join("") || `<li class="shc-none">Nobody planned yet.</li>`}</ul>
          ${free.length ? `<div class="shc-add"><label class="sr-only" for="add-${sh.id}">Add to the ${esc(sh.label)} shift</label><select id="add-${sh.id}" data-add="${sh.id}"><option value="">Add someone...</option>${free.map(f => `<option value="${f.id}">${esc(f.initials)} (${esc(roleLabel(f.role))}${f.skills.length ? ", " + esc(f.skills.map(skillShort).join(", ")) : ""})</option>`).join("")}</select></div>` : ""}
          <div class="shc-need" role="group" aria-label="People wanted on the ${esc(sh.label)} shift">
            <span>Wanted</span><button class="btn shc-icon" type="button" data-act="need" data-shift="${sh.id}" data-key="staff" data-by="-1" aria-label="One fewer person wanted on the ${esc(sh.label)} shift">&minus;</button><output>${c.needed}</output><button class="btn shc-icon" type="button" data-act="need" data-shift="${sh.id}" data-key="staff" data-by="1" aria-label="One more person wanted on the ${esc(sh.label)} shift">+</button>
            <span>trained</span><button class="btn shc-icon" type="button" data-act="need" data-shift="${sh.id}" data-key="specialists" data-by="-1" aria-label="One fewer dementia-trained person wanted on the ${esc(sh.label)} shift">&minus;</button><output>${c.specialistsNeeded}</output><button class="btn shc-icon" type="button" data-act="need" data-shift="${sh.id}" data-key="specialists" data-by="1" aria-label="One more dementia-trained person wanted on the ${esc(sh.label)} shift">+</button>
          </div></div>`;
      }).join("")}
      <div class="shc-copy"><button class="btn" type="button" data-act="copyweek">Copy this week to next week</button></div>
    </section>`;
  }
  function staffHtml() {
    return `<section class="shc-card" aria-labelledby="shcStaffH"><h3 id="shcStaffH">People on your floor</h3>
      <p class="shc-sub">Initials only, with a role and the skills that matter on a memory care shift. Nothing else is kept.</p>
      <form id="shcStaffForm" class="shc-staff-form" novalidate>
        <div class="field"><label for="shcIni">Initials</label><input id="shcIni" maxlength="4" autocomplete="off" autocapitalize="characters" placeholder="MR"></div>
        <div class="field"><label for="shcRole">Role</label><select id="shcRole">${C.ROLES.map(r => `<option value="${r.id}">${esc(r.label)}</option>`).join("")}</select></div>
        <fieldset class="field shc-skills"><legend>Skills</legend>${C.SKILLS.map(k => `<label class="shc-check"><input type="checkbox" name="shcSkillNew" value="${k.id}"><span>${esc(k.label)}</span></label>`).join("")}</fieldset>
        <button class="btn btn-primary" type="submit">Add person</button>
      </form>
      <p class="shc-msg" id="shcMsg" role="status"></p>
      ${cal.staff.length ? `<ul class="shc-staff">${cal.staff.slice().sort((a, b) => a.initials.localeCompare(b.initials)).map(s => `<li><span class="shc-chip"><b>${esc(s.initials)}</b></span><span>${esc(roleLabel(s.role))}${s.skills.length ? `<small>${esc(s.skills.map(skillShort).join(", "))}</small>` : ""}</span><button class="btn" type="button" data-act="rmstaff" data-staff="${s.id}" aria-label="Remove ${esc(s.initials)} from the list">Remove</button></li>`).join("")}</ul>`
        : `<p class="shc-empty">Nobody is on the list yet. Add the people on your floor, or <button class="shc-link" type="button" data-act="sample">try it with fictional sample staff</button>.</p>`}
    </section>`;
  }
  const legendHtml = () => `<section class="shc-card shc-legend" aria-labelledby="shcLegH"><h3 id="shcLegH">What the badges mean</h3><ul>
    <li><span class="shc-b shc-b-full">${svg(IC.ok, 14)}<span>Fully staffed</span></span> every shown shift has the people and the dementia-trained staff you asked for</li>
    <li><span class="shc-b shc-b-open">${svg(IC.open, 14)}<span>Open shifts</span></span> a shown shift is short of people or of dementia-trained staff</li>
    <li><span class="shc-b shc-b-mem">${svg(IC.heart, 14)}<span>Memory care need</span></span> the records on that shift show a lot of distress</li>
    <li><span class="shc-b shc-b-none">${svg(IC.none, 14)}<span>Not planned</span></span> nobody is on the calendar for that day yet</li></ul></section>`;
  const railHtml = () => insightHtml() + dayEditorHtml() + staffHtml() + legendHtml();

  /* ---------- changes ---------- */
  function change(next, message) {
    if (!writeCal(next)) return false;
    paint(); if (message) toast(message); return true;
  }
  function setMsg(text, bad) { const m = q("#shcMsg"); if (m) { m.textContent = text; m.className = "shc-msg" + (bad ? " is-bad" : ""); } }
  function goTo(day, focus) { S.day = day; S.focusDay = focus ? day : ""; paint(); }
  function shift(dir) {
    if (S.view === "month") { const m = C.addMonths(S.day, dir); S.day = m.slice(0, 7) === todayISO().slice(0, 7) ? todayISO() : m; }
    else S.day = C.addDays(S.day, (S.view === "week" ? 7 : 1) * dir);
    paint();
  }
  function onClick(e) {
    const dayBtn = e.target.closest("[data-day]");
    if (dayBtn) { goTo(dayBtn.getAttribute("data-day"), true); const h = q("#shcDayH"); if (h && window.matchMedia && !window.matchMedia("(min-width:1500px)").matches) h.scrollIntoView({ block: "start", behavior: "smooth" }); return; }
    const b = e.target.closest("button"); if (!b) return;
    const act = b.getAttribute("data-act");
    if (b.id === "shcPdf") return exportPdf();
    if (b.id === "shcOpenBoard") return openBoard(b);
    if (b.id === "shcCloseBoard") return closeBoard();
    if (b.id === "shcLookup") { if (window.QuickLookup) window.QuickLookup.open(b); return; }
    if (act === "prev") return shift(-1);
    if (act === "next") return shift(1);
    if (act === "today") { S.day = todayISO(); paint(); return; }
    if (act === "unassign") return change(C.unassign(cal, S.day, b.closest(".shc-slot").getAttribute("data-shift"), b.getAttribute("data-staff")));
    if (act === "need") {
      const sh = b.getAttribute("data-shift"), key = b.getAttribute("data-key"), cur = C.needOf(cal, S.day, sh), n = { staff: cur.staff, specialists: cur.specialists };
      n[key] = Math.max(0, Math.min(40, n[key] + Number(b.getAttribute("data-by"))));
      return change(C.setSlotNeed(cal, S.day, sh, n));
    }
    if (act === "copyweek") { const next = C.addDays(S.day, 7); if (change(C.copyWeek(cal, S.day, next))) { toast("This week's people are on next week too. Check the days that differ."); } return; }
    if (act === "rmstaff") { if (!confirm("Remove " + initialsOf(b.getAttribute("data-staff")) + " from the list and from every shift?")) return; return change(C.removeStaff(cal, b.getAttribute("data-staff"))); }
    if (act === "sample") { let next = cal; C.sampleStaff().forEach(s => { const r = C.addStaff(next, { initials: s[0], role: s[1], skills: s[2] }); if (!r.error) next = r; }); return change(next, "Fictional sample staff added. Remove them any time."); }
  }
  function onChange(e) {
    const t = e.target;
    if (t.name === "shcView") { S.view = t.value; paint(); return; }
    if (t.id === "shcShift") { S.shift = t.value; paint(); return; }
    if (t.id === "shcSkill") { S.skill = t.value; paint(); return; }
    if (t.hasAttribute && t.hasAttribute("data-add") && t.value) return change(C.assign(cal, S.day, t.getAttribute("data-add"), t.value));
    if (t.hasAttribute && t.hasAttribute("data-swap") && t.value) return change(C.swap(cal, S.day, t.closest(".shc-slot").getAttribute("data-shift"), t.getAttribute("data-swap"), t.value), "Swapped.");
  }
  function onSubmit(e) {
    if (e.target.id !== "shcStaffForm") return;
    e.preventDefault();
    const skills = [...e.target.querySelectorAll('input[name="shcSkillNew"]:checked')].map(i => i.value);
    const r = C.addStaff(cal, { initials: q("#shcIni").value, role: q("#shcRole").value, skills });
    if (r.error) { setMsg(r.error, true); q("#shcIni").focus(); return; }
    if (!writeCal(r)) return;
    paint(); setMsg(""); toast("Added."); const i = q("#shcIni"); if (i) i.focus();
  }
  /* arrow keys move through the days of the month grid */
  function onKey(e) {
    const b = e.target.closest && e.target.closest(".shc-day"); if (!b || e.ctrlKey || e.metaKey || e.altKey) return;
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (step) { e.preventDefault(); goTo(C.addDays(b.getAttribute("data-day"), step), true); return; }
    if (e.key === "PageDown" || e.key === "PageUp") { e.preventDefault(); const m = C.addMonths(b.getAttribute("data-day"), e.key === "PageDown" ? 1 : -1); goTo(m, true); }
  }

  /* ---------- the slide-out: the board this page always had ---------- */
  function openBoard(from) {
    opener = from || q("#shcOpenBoard");
    const dr = q("#shcDrawer"), host = q("#shcBoard");
    DailyOpsUI.render(host);                                       // drawn fresh each time it opens, so it is never out of date
    dr.hidden = false; q("#shcScrim").hidden = false; requestAnimationFrame(() => dr.classList.add("is-open"));
    S.drawer = true; q("#shcOpenBoard").setAttribute("aria-expanded", "true"); document.body.classList.add("shc-lock");
    const first = q("#shcCloseBoard"); if (first) first.focus();
  }
  function closeBoard() {
    const dr = q("#shcDrawer"); if (!dr) return;
    dr.classList.remove("is-open"); S.drawer = false; q("#shcOpenBoard").setAttribute("aria-expanded", "false"); document.body.classList.remove("shc-lock");
    setTimeout(() => { if (!S.drawer && dr) { dr.hidden = true; const sc = q("#shcScrim"); if (sc) sc.hidden = true; } }, 220);
    board = readBoard(); paint();                                  // notes and records may have changed: the tiles follow
    if (opener && opener.isConnected) opener.focus();
  }
  function onDocKey(e) {
    if (!root || !root.isConnected) { document.removeEventListener("keydown", onDocKey); return; }
    if (e.key === "Escape" && S.drawer && !e.defaultPrevented) { e.preventDefault(); closeBoard(); }
  }
  /* a change made on another tab (or in the slide-out) */
  function refresh() { if (!root || !root.isConnected) return; board = readBoard(); cal = readCal(); if (!S.drawer) paint(); }

  /* ---------- the weekly schedule as a PDF (jsPDF from this site, Atkinson, pure black on white) ---------- */
  let pdfKit = null;
  function loadPdfKit() {
    if (window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.__atkinson) return Promise.resolve(window.jspdf.jsPDF);
    if (pdfKit) return pdfKit;
    const add = src => new Promise((ok, fail) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => fail(new Error("Could not load " + src)); document.head.appendChild(s); });
    pdfKit = add("assets/vendor/jspdf.umd.min.js").then(() => add("assets/vendor/jspdf-atkinson.js")).then(() => window.jspdf.jsPDF, e => { pdfKit = null; throw e; });
    return pdfKit;
  }
  async function exportPdf() {
    const btn = q("#shcPdf"); btn.disabled = true;
    try {
      const JsPDF = await loadPdfKit(), rows = C.weekTable(cal, S.day), start = C.weekStart(S.day), facility = (typeof settings !== "undefined" && settings.facility) || "";
      const doc = new JsPDF({ unit: "pt", format: "letter", orientation: "portrait", compress: true });
      const L = 90, R = 36, W = 612 - L - R, F = "AtkinsonHyperlegible";           // 0.5 in margins and a 0.75 in binding gutter on the left
      doc.setTextColor(0, 0, 0); doc.setDrawColor(0, 0, 0);
      doc.setFont(F, "bold"); doc.setFontSize(20); doc.text("Weekly shift schedule", L, 70);
      doc.setFont(F, "normal"); doc.setFontSize(12); doc.text(C.weekLabel(start) + (facility ? "  |  " + facility : ""), L, 88);
      doc.setFontSize(11); doc.text("Confidential: staff only. Staff appear by initials.", L, 104);
      const top = 122, dayW = 84, colW = (W - dayW) / 3, rowH = 76;
      doc.setLineWidth(1.5); doc.rect(L, top, W, 28 + rowH * 7);
      doc.setFont(F, "bold"); doc.setFontSize(12);
      doc.text("Day", L + 8, top + 18);
      C.SHIFTS.forEach((s, i) => { doc.text(s.label, L + dayW + colW * i + 8, top + 18); doc.setFont(F, "normal"); doc.setFontSize(9); doc.text(s.hours, L + dayW + colW * i + 8, top + 26); doc.setFont(F, "bold"); doc.setFontSize(12); });
      doc.line(L, top + 28, L + W, top + 28); doc.line(L + dayW, top, L + dayW, top + 28 + rowH * 7);
      for (let c = 1; c < 3; c++) doc.line(L + dayW + colW * c, top, L + dayW + colW * c, top + 28 + rowH * 7);
      rows.forEach((r, i) => {
        const y = top + 28 + rowH * i; if (i) doc.line(L, y, L + W, y);
        doc.setFont(F, "bold"); doc.setFontSize(13); doc.text(r.label, L + 8, y + 20);
        doc.setFont(F, "normal"); doc.setFontSize(10); doc.text(r.dow, L + 8, y + 34);
        r.cells.forEach((cell, c) => {
          const x = L + dayW + colW * c + 8; doc.setFont(F, "bold"); doc.setFontSize(13);
          const lines = doc.splitTextToSize(cell.initials.join("  ") || "-", colW - 16); doc.text(lines.slice(0, 2), x, y + 20);
          doc.setFont(F, "normal"); doc.setFontSize(10);
          doc.text(cell.initials.length + " of " + cell.needed + " on", x, y + 50);
          if (cell.gap || cell.specialistGap) { doc.setFont(F, "bold"); doc.text("OPEN: " + [cell.gap ? cell.gap + " more" : "", cell.specialistGap ? cell.specialistGap + " dementia-trained" : ""].filter(Boolean).join(", "), x, y + 63); }
        });
      });
      doc.setFont(F, "normal"); doc.setFontSize(10); const fy = top + 28 + rowH * 7 + 22;
      doc.text("OPEN marks a shift short of the people, or the dementia-trained staff, asked for. Printed " + new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) + ".", L, fy, { maxWidth: W });
      doc.save("cognicopia-weekly-shift-schedule-" + start + ".pdf");
      toast("The weekly schedule was saved as a PDF.");
    } catch (err) { toast("The PDF could not be made: " + (err && err.message || err)); }
    finally { btn.disabled = false; }
  }

  return { render, refresh, openBoard: () => { if (root && root.isConnected) openBoard(); } };
})();
