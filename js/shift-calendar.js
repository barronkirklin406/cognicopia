/* =====================================================================
   COGNICOPIA SHIFT CALENDAR (the staffing logic behind the Shift board's calendar)

   Who is on which shift, how many are needed, where the gaps are, and which
   shifts most need someone trained in dementia care. Pure logic: no screen, no
   storage and no network. The screen is in builder.html (ShiftCalUI); it keeps
   the one record this module describes sealed in the encrypted store.

     - Staff are known by initials only (up to 4 letters), with a role and the
       skills that matter to a memory care shift. No name, no contact, no pay.
     - A shift slot is a day and one of Day, Evening or Night. It holds the
       initials of whoever is on it, and the number needed (a default per shift,
       which a slot may override).
     - Coverage: assigned against needed, and assigned dementia-trained staff
       against the number of them wanted. A day is "full" when every shift meets
       both, "open" when any shift does not, and "none" when nothing is planned.
     - The staffing insight reads the engagement records the Shift board already
       keeps (activity, how a resident took part, mood: by alias, with the shift)
       and counts, per shift, how many records show a restless, anxious, sad,
       distracted or overstimulated mood or a declined activity. It is a count of
       what staff recorded on this computer, shown with how many records it rests
       on. It is NOT a forecast from outside data, not a clinical tool and not
       artificial intelligence: simple arithmetic on the board's own records, and
       it says "not enough records yet" until there are enough to mean anything.
     - Pairing suggestions put the dementia-trained staff on a shift with the
       residents (aliases) whose recent records on that shift most often show
       distress. They are suggestions for a charge nurse or Activity Director to
       accept or ignore; nothing is assigned by them.

   Days are "YYYY-MM-DD" read from the computer's own clock, weeks start on
   Sunday. Nothing here stores or sends anything.
   @global CogniShiftCal
   ===================================================================== */
(function (root) {
  "use strict";

  var SCHEMA = "cognicopia.shiftCalendar", VERSION = 1, STORE_KEY = "cognicopia_shiftcal";
  var SHIFTS = [
    { id: "day", label: "Day", hours: "about 7 am to 3 pm" },
    { id: "evening", label: "Evening", hours: "about 3 pm to 11 pm" },
    { id: "night", label: "Night", hours: "about 11 pm to 7 am" }
  ];
  var ROLES = [
    { id: "nurse", label: "Nurse" },
    { id: "aide", label: "Care aide" },
    { id: "activity", label: "Activity staff" },
    { id: "other", label: "Other" }
  ];
  var SKILLS = [
    { id: "dementia", label: "Dementia care trained", short: "Dementia" },
    { id: "validation", label: "Validation approach", short: "Validation" },
    { id: "montessori", label: "Montessori-based activities", short: "Montessori" },
    { id: "music", label: "Music and reminiscence", short: "Music" },
    { id: "deescalation", label: "De-escalation", short: "De-escalation" }
  ];
  var LIMITS = { INITIALS: 4, STAFF_MAX: 80, SLOT_STAFF_MAX: 30, DAYS_MAX: 800 };
  var DEFAULT_NEEDS = { day: { staff: 4, specialists: 1 }, evening: { staff: 3, specialists: 1 }, night: { staff: 2, specialists: 0 } };
  var DISTRESS = { restless: 1, anxious: 1, sad: 1, distracted: 1, overstimulated: 1 };   // the Shift board's flagged moods (dailyOps.js MOODS)
  /* what counts as "enough records to say anything": a few per shift, and the share that must be flagged to call it high */
  var RULES = { MIN_RECORDS: 6, HIGH_SHARE: 0.35, MODERATE_SHARE: 0.18, TOP_RESIDENTS: 3 };

  var DAY_RE = /^\d{4}-\d{2}-\d{2}$/, ID_RE = /^[a-z0-9]{6,24}$/;
  function isShift(id) { return SHIFTS.some(function (s) { return s.id === id; }); }
  function shiftLabel(id) { var s = SHIFTS.filter(function (x) { return x.id === id; })[0]; return s ? s.label : ""; }
  function isDay(d) {
    if (typeof d !== "string" || !DAY_RE.test(d)) return false;
    var p = d.split("-"), t = new Date(+p[0], +p[1] - 1, +p[2]);
    return t.getFullYear() === +p[0] && t.getMonth() === +p[1] - 1 && t.getDate() === +p[2];
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function isoOf(dt) { return dt.getFullYear() + "-" + pad(dt.getMonth() + 1) + "-" + pad(dt.getDate()); }
  function dateOf(d) { var p = d.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(d, n) { var t = dateOf(d); t.setDate(t.getDate() + n); return isoOf(t); }
  function weekStart(d) { var t = dateOf(d); return addDays(d, -t.getDay()); }
  function weekDays(d) { var s = weekStart(d), out = [], i; for (i = 0; i < 7; i++) out.push(addDays(s, i)); return out; }
  function monthStart(d) { return d.slice(0, 8) + "01"; }
  function addMonths(d, n) { var t = dateOf(monthStart(d)); t.setMonth(t.getMonth() + n); return isoOf(t); }
  /* six weeks of seven days that hold the month of `d`: each { day, inMonth } */
  function monthGrid(d) {
    var first = monthStart(d), month = first.slice(0, 7), start = weekStart(first), out = [], i;
    for (i = 0; i < 42; i++) { var x = addDays(start, i); out.push({ day: x, inMonth: x.slice(0, 7) === month }); }
    return out;
  }
  var DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], DOW_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var MON = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  function dowOf(d) { return dateOf(d).getDay(); }
  function dayShort(d) { return DOW[dowOf(d)] + " " + (+d.slice(8)); }
  function dayLong(d) { var t = dateOf(d); return DOW_LONG[t.getDay()] + ", " + MON[t.getMonth()] + " " + t.getDate() + ", " + t.getFullYear(); }
  function monthLabel(d) { var t = dateOf(d); return MON[t.getMonth()] + " " + t.getFullYear(); }
  function weekLabel(d) {
    var a = dateOf(weekStart(d)), b = dateOf(addDays(weekStart(d), 6));
    return MON[a.getMonth()].slice(0, 3) + " " + a.getDate() + (a.getFullYear() !== b.getFullYear() ? ", " + a.getFullYear() : "") + " to " + (a.getMonth() !== b.getMonth() ? MON[b.getMonth()].slice(0, 3) + " " : "") + b.getDate() + ", " + b.getFullYear();
  }

  /* ---------- the record ---------- */
  function newId() {
    var c = "abcdefghijklmnopqrstuvwxyz0123456789", s = "", i, r;
    var g = root.crypto && root.crypto.getRandomValues ? root.crypto.getRandomValues(new Uint8Array(10)) : null;
    for (i = 0; i < 10; i++) { r = g ? g[i] : Math.floor(Math.random() * 256); s += c.charAt(r % c.length); }
    return s;
  }
  function cleanInitials(v) { return String(v == null ? "" : v).replace(/[^A-Za-z]/g, "").slice(0, LIMITS.INITIALS).toUpperCase(); }
  function roleOf(id) { return ROLES.some(function (r) { return r.id === id; }) ? id : "other"; }
  function skillsOf(list) {
    var out = [];
    (Array.isArray(list) ? list : []).forEach(function (s) { if (SKILLS.some(function (k) { return k.id === s; }) && out.indexOf(s) < 0) out.push(s); });
    return out;
  }
  function normNeed(n, fallback) {
    var o = n && typeof n === "object" ? n : {}, st = Math.round(Number(o.staff)), sp = Math.round(Number(o.specialists));
    return { staff: isFinite(st) && st >= 0 && st <= 40 ? st : fallback.staff, specialists: isFinite(sp) && sp >= 0 && sp <= 40 ? sp : fallback.specialists };
  }
  function emptyCalendar() { return { schema: SCHEMA, version: VERSION, staff: [], slots: {}, needs: JSON.parse(JSON.stringify(DEFAULT_NEEDS)) }; }
  function normalize(raw) {
    var o = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}, cal = emptyCalendar(), seenId = {}, seenIn = {};
    (Array.isArray(o.staff) ? o.staff : []).forEach(function (s) {
      if (!s || typeof s !== "object" || cal.staff.length >= LIMITS.STAFF_MAX) return;
      var ini = cleanInitials(s.initials), id = typeof s.id === "string" && ID_RE.test(s.id) ? s.id : "";
      if (!ini || !id || seenId[id] || seenIn[ini]) return;
      seenId[id] = seenIn[ini] = true;
      cal.staff.push({ id: id, initials: ini, role: roleOf(s.role), skills: skillsOf(s.skills) });
    });
    SHIFTS.forEach(function (sh) { cal.needs[sh.id] = normNeed(o.needs && o.needs[sh.id], DEFAULT_NEEDS[sh.id]); });
    var slots = o.slots && typeof o.slots === "object" && !Array.isArray(o.slots) ? o.slots : {}, keys = Object.keys(slots), i, count = 0;
    for (i = 0; i < keys.length && count < LIMITS.DAYS_MAX * 3; i++) {
      var k = keys[i], p = k.split("|"), v = slots[k];
      if (p.length !== 2 || !isDay(p[0]) || !isShift(p[1]) || !v || typeof v !== "object") continue;
      var ids = [];
      (Array.isArray(v.staff) ? v.staff : []).forEach(function (id) { if (seenId[id] && ids.indexOf(id) < 0 && ids.length < LIMITS.SLOT_STAFF_MAX) ids.push(id); });
      var slot = { staff: ids };
      if (v.need && typeof v.need === "object") slot.need = normNeed(v.need, cal.needs[p[1]]);
      if (ids.length || slot.need) { cal.slots[k] = slot; count++; }
    }
    return cal;
  }
  var slotKey = function (day, shift) { return day + "|" + shift; };
  function clone(cal) { return normalize(JSON.parse(JSON.stringify(cal))); }
  function staffById(cal, id) { return cal.staff.filter(function (s) { return s.id === id; })[0] || null; }
  function hasSkill(s, skill) { return !!s && s.skills.indexOf(skill) >= 0; }

  /* ---------- changes (each returns a new calendar, or { error } with words for the person) ---------- */
  function addStaff(cal, f) {
    var ini = cleanInitials(f && f.initials);
    if (!ini) return { error: "Type the initials (letters only, up to four)." };
    if (cal.staff.some(function (s) { return s.initials === ini; })) return { error: ini + " is already on the list." };
    if (cal.staff.length >= LIMITS.STAFF_MAX) return { error: "The list is full (" + LIMITS.STAFF_MAX + " people)." };
    var next = clone(cal); next.staff.push({ id: newId(), initials: ini, role: roleOf(f.role), skills: skillsOf(f.skills) });
    return next;
  }
  function updateStaff(cal, id, f) {
    var next = clone(cal), s = staffById(next, id); if (!s) return { error: "That person is not on the list." };
    if (f.initials != null) {
      var ini = cleanInitials(f.initials);
      if (!ini) return { error: "Type the initials (letters only, up to four)." };
      if (next.staff.some(function (x) { return x.id !== id && x.initials === ini; })) return { error: ini + " is already on the list." };
      s.initials = ini;
    }
    if (f.role != null) s.role = roleOf(f.role);
    if (f.skills != null) s.skills = skillsOf(f.skills);
    return next;
  }
  function removeStaff(cal, id) {
    var next = clone(cal); next.staff = next.staff.filter(function (s) { return s.id !== id; });
    Object.keys(next.slots).forEach(function (k) { next.slots[k].staff = next.slots[k].staff.filter(function (x) { return x !== id; }); if (!next.slots[k].staff.length && !next.slots[k].need) delete next.slots[k]; });
    return next;
  }
  function assign(cal, day, shift, id) {
    if (!isDay(day) || !isShift(shift)) return { error: "Choose a day and a shift." };
    if (!staffById(cal, id)) return { error: "That person is not on the list." };
    var next = clone(cal), k = slotKey(day, shift), sl = next.slots[k] || (next.slots[k] = { staff: [] });
    if (sl.staff.indexOf(id) >= 0) return { error: staffById(cal, id).initials + " is already on this shift." };
    if (sl.staff.length >= LIMITS.SLOT_STAFF_MAX) return { error: "This shift is full." };
    /* the same person on two shifts of the same day is allowed (a double) but said aloud by the screen: see doubles() */
    sl.staff.push(id); return next;
  }
  function unassign(cal, day, shift, id) {
    var next = clone(cal), k = slotKey(day, shift), sl = next.slots[k]; if (!sl) return next;
    sl.staff = sl.staff.filter(function (x) { return x !== id; });
    if (!sl.staff.length && !sl.need) delete next.slots[k];
    return next;
  }
  function swap(cal, day, shift, outId, inId) {
    if (outId === inId) return { error: "Choose someone else to swap in." };
    var a = unassign(cal, day, shift, outId); if (a.error) return a;
    return assign(a, day, shift, inId);
  }
  function setNeeds(cal, shift, need) {
    if (!isShift(shift)) return { error: "Choose a shift." };
    var next = clone(cal); next.needs[shift] = normNeed(need, cal.needs[shift]); return next;
  }
  function setSlotNeed(cal, day, shift, need) {
    var next = clone(cal), k = slotKey(day, shift), sl = next.slots[k] || (next.slots[k] = { staff: [] });
    if (need == null) { delete sl.need; if (!sl.staff.length) delete next.slots[k]; } else sl.need = normNeed(need, next.needs[shift]);
    return next;
  }
  /* copy one week's people onto another week (the needs overrides are not copied) */
  function copyWeek(cal, fromDay, toDay) {
    var next = clone(cal), a = weekDays(fromDay), b = weekDays(toDay), i;
    SHIFTS.forEach(function (sh) { for (i = 0; i < 7; i++) {
      var src = cal.slots[slotKey(a[i], sh.id)], k = slotKey(b[i], sh.id);
      if (src && src.staff.length) next.slots[k] = { staff: src.staff.slice(), need: next.slots[k] && next.slots[k].need ? next.slots[k].need : undefined };
      if (next.slots[k] && next.slots[k].need === undefined) delete next.slots[k].need;
    } });
    return next;
  }

  /* ---------- coverage ---------- */
  function needOf(cal, day, shift) { var sl = cal.slots[slotKey(day, shift)]; return sl && sl.need ? sl.need : cal.needs[shift]; }
  function coverage(cal, day, shift) {
    var sl = cal.slots[slotKey(day, shift)], ids = sl ? sl.staff : [], need = needOf(cal, day, shift), people = ids.map(function (id) { return staffById(cal, id); }).filter(Boolean);
    var spec = people.filter(function (p) { return hasSkill(p, "dementia"); }).length;
    var gap = Math.max(0, need.staff - people.length), specGap = Math.max(0, need.specialists - spec);
    return { day: day, shift: shift, people: people, assigned: people.length, needed: need.staff, gap: gap, specialists: spec, specialistsNeeded: need.specialists, specialistGap: specGap,
      level: !people.length && need.staff > 0 ? "empty" : (gap || specGap) ? "open" : "full", planned: people.length > 0 };
  }
  function dayCoverage(cal, day) {
    var parts = SHIFTS.map(function (sh) { return coverage(cal, day, sh.id); }), planned = parts.some(function (p) { return p.planned; });
    var open = parts.filter(function (p) { return p.level !== "full" && (p.needed > 0 || p.specialistsNeeded > 0); });
    return { day: day, shifts: parts, planned: planned, level: !planned ? "none" : open.length ? "open" : "full", openShifts: open.length, gaps: parts.reduce(function (n, p) { return n + p.gap; }, 0), specialistGaps: parts.reduce(function (n, p) { return n + p.specialistGap; }, 0) };
  }
  /* the same person on more than one shift of one day (the screen says "double", never blocks) */
  function doubles(cal, day) {
    var seen = {}, out = [];
    SHIFTS.forEach(function (sh) { (cal.slots[slotKey(day, sh.id)] || { staff: [] }).staff.forEach(function (id) { (seen[id] = seen[id] || []).push(sh.id); }); });
    Object.keys(seen).forEach(function (id) { if (seen[id].length > 1) out.push({ staff: staffById(cal, id), shifts: seen[id] }); });
    return out.filter(function (d) { return d.staff; });
  }

  /* ---------- the staffing insight: counts of what staff recorded ---------- */
  function isDistress(e) { return !!DISTRESS[e.mood] || e.participation === "declined"; }
  function pressureLevel(n, share) { return n < RULES.MIN_RECORDS ? "unknown" : share >= RULES.HIGH_SHARE ? "high" : share >= RULES.MODERATE_SHARE ? "moderate" : "low"; }
  /* engagements: the board's records ({ day, shift, time, resident (an alias), participation, mood }). `weekday` (0 to 6) limits the count to that day of the week. */
  function insight(engagements, opts) {
    opts = opts || {};
    var list = (Array.isArray(engagements) ? engagements : []).filter(function (e) { return e && isShift(e.shift) && (opts.weekday == null || (isDay(e.day) && dowOf(e.day) === opts.weekday)); });
    var by = {}, hours = [], h;
    for (h = 0; h < 24; h++) hours.push({ hour: h, n: 0, flagged: 0 });
    SHIFTS.forEach(function (sh) { by[sh.id] = { shift: sh.id, n: 0, flagged: 0, declined: 0 }; });
    list.forEach(function (e) {
      var b = by[e.shift], d = isDistress(e); b.n++; if (d) b.flagged++; if (e.participation === "declined") b.declined++;
      var m = /^(\d{2}):(\d{2})$/.exec(e.time || ""); if (m && +m[1] < 24) { hours[+m[1]].n++; if (d) hours[+m[1]].flagged++; }
    });
    SHIFTS.forEach(function (sh) { var b = by[sh.id]; b.share = b.n ? b.flagged / b.n : 0; b.level = pressureLevel(b.n, b.share); });
    var peak = null; hours.forEach(function (x) { if (x.n >= 3 && x.flagged / x.n >= RULES.MODERATE_SHARE && (!peak || x.flagged / x.n > peak.flagged / peak.n)) peak = x; });
    return { total: list.length, byShift: by, byHour: hours, peakHour: peak ? peak.hour : null, enough: SHIFTS.some(function (sh) { return by[sh.id].n >= RULES.MIN_RECORDS; }) };
  }
  function hourLabel(h) { return (h % 12 === 0 ? 12 : h % 12) + (h < 12 ? " am" : " pm"); }
  /* a day's pressure for each shift: the same weekday's records if there are enough, else all days */
  function dayPressure(engagements, day) {
    var same = insight(engagements, { weekday: dowOf(day) }), all = insight(engagements), out = {};
    SHIFTS.forEach(function (sh) {
      var a = same.byShift[sh.id], b = all.byShift[sh.id], use = a.n >= RULES.MIN_RECORDS ? a : b;
      out[sh.id] = { level: use.level, n: use.n, share: use.share, basis: a.n >= RULES.MIN_RECORDS ? "weekday" : "all" };
    });
    return out;
  }
  function topResidents(engagements, shift) {
    var by = {};
    (Array.isArray(engagements) ? engagements : []).forEach(function (e) {
      if (!e || e.shift !== shift || !e.resident) return;
      var r = by[e.resident] || (by[e.resident] = { alias: e.resident, n: 0, flagged: 0, moods: {} });
      r.n++; if (isDistress(e)) { r.flagged++; var k = e.participation === "declined" && !DISTRESS[e.mood] ? "declined" : e.mood; r.moods[k] = (r.moods[k] || 0) + 1; }
    });
    return Object.keys(by).map(function (k) { return by[k]; }).filter(function (r) { return r.flagged >= 2 && r.n >= 3; })
      .sort(function (a, b) { return b.flagged / b.n - a.flagged / a.n || b.flagged - a.flagged || (a.alias < b.alias ? -1 : 1); }).slice(0, RULES.TOP_RESIDENTS);
  }
  function skillScore(s) { return (hasSkill(s, "dementia") ? 4 : 0) + (hasSkill(s, "validation") ? 2 : 0) + (hasSkill(s, "deescalation") ? 2 : 0) + (hasSkill(s, "montessori") ? 1 : 0) + (hasSkill(s, "music") ? 1 : 0); }
  function moodWords(moods) {
    var names = { restless: "restlessness", anxious: "anxiety or upset", sad: "sadness or tears", distracted: "distraction", overstimulated: "overstimulation", declined: "an activity put off" };
    return Object.keys(moods).sort(function (a, b) { return moods[b] - moods[a]; }).slice(0, 2).map(function (k) { return names[k] || k; }).join(" and ");
  }
  /* suggestions for one shift: which assigned staff, trained for it, to sit with which residents; and a flag when no trained person is on */
  function suggest(cal, day, shift, engagements) {
    var cov = coverage(cal, day, shift), pressure = dayPressure(engagements, day)[shift], residents = topResidents(engagements, shift), out = { level: pressure.level, basis: pressure, pairs: [], flags: [] };
    var ranked = cov.people.filter(function (p) { return skillScore(p) > 0; }).sort(function (a, b) { return skillScore(b) - skillScore(a) || (a.initials < b.initials ? -1 : 1); });
    if (pressure.level === "high" || pressure.level === "moderate") {
      if (!cov.specialists) out.flags.push(cov.planned ? "No dementia-trained staff are on this shift, and its records show more distress than most." : "Nobody is planned for this shift, and its records show more distress than most.");
      else if (pressure.level === "high" && cov.specialists < 2 && cov.assigned >= 3) out.flags.push("Only one dementia-trained person is on this shift; its records show a lot of distress.");
    }
    residents.forEach(function (r, i) {
      var who = ranked.length ? ranked[i % ranked.length] : null;
      out.pairs.push({ alias: r.alias, staff: who, why: r.flagged + " of " + r.n + " records on this shift show " + moodWords(r.moods), skills: who ? who.skills.map(function (k) { return SKILLS.filter(function (s) { return s.id === k; })[0].short; }) : [] });
    });
    return out;
  }
  /* what the calendar day tile shows: coverage and the memory-care flag */
  function dayTile(cal, day, engagements) {
    var cov = dayCoverage(cal, day), pr = dayPressure(engagements, day), high = SHIFTS.filter(function (sh) { return pr[sh.id].level === "high"; });
    return { day: day, level: cov.level, coverage: cov, memoryCare: high.length > 0, highShifts: high.map(function (s) { return s.id; }), pressure: pr };
  }

  /* ---------- the printed week ---------- */
  function weekTable(cal, day) {
    return weekDays(day).map(function (d) {
      return { day: d, label: dayShort(d), dow: DOW_LONG[dowOf(d)], cells: SHIFTS.map(function (sh) { var c = coverage(cal, d, sh.id); return { shift: sh.id, initials: c.people.map(function (p) { return p.initials; }), needed: c.needed, gap: c.gap, specialistGap: c.specialistGap, specialists: c.specialists }; }) };
    });
  }

  /* fictional staff for trying the screen (initials only, no one real) */
  function sampleStaff() {
    return [["AB", "nurse", ["dementia", "deescalation"]], ["CD", "aide", ["dementia", "validation"]], ["EF", "aide", ["montessori"]], ["GH", "activity", ["music", "montessori", "validation"]],
      ["JK", "nurse", ["dementia"]], ["LM", "aide", []], ["NP", "aide", ["dementia", "music"]], ["QR", "other", []]];
  }

  /* ---------- the sealed record and its locked file ---------- */
  function backupFile(cal) { return { format: "cognicopia.shiftCalendarBackup", version: 1, app: "Cognicopia", exportedAt: new Date().toISOString(), calendar: normalize(cal) }; }
  function readBackup(o) {
    if (!o || o.format !== "cognicopia.shiftCalendarBackup" || !o.calendar) return { error: "That is not a Cognicopia shift calendar file." };
    return { calendar: normalize(o.calendar) };
  }

  root.CogniShiftCal = Object.freeze({ VERSION: VERSION, SCHEMA: SCHEMA, STORE_KEY: STORE_KEY, SHIFTS: SHIFTS, ROLES: ROLES, SKILLS: SKILLS, LIMITS: LIMITS, RULES: RULES, DEFAULT_NEEDS: DEFAULT_NEEDS,
    isDay: isDay, isShift: isShift, shiftLabel: shiftLabel, addDays: addDays, weekStart: weekStart, weekDays: weekDays, monthStart: monthStart, addMonths: addMonths, monthGrid: monthGrid, dowOf: dowOf,
    dayShort: dayShort, dayLong: dayLong, monthLabel: monthLabel, weekLabel: weekLabel, hourLabel: hourLabel, cleanInitials: cleanInitials,
    emptyCalendar: emptyCalendar, normalize: normalize, staffById: staffById, addStaff: addStaff, updateStaff: updateStaff, removeStaff: removeStaff,
    assign: assign, unassign: unassign, swap: swap, setNeeds: setNeeds, setSlotNeed: setSlotNeed, copyWeek: copyWeek,
    needOf: needOf, coverage: coverage, dayCoverage: dayCoverage, doubles: doubles, insight: insight, dayPressure: dayPressure, topResidents: topResidents, suggest: suggest, dayTile: dayTile,
    weekTable: weekTable, sampleStaff: sampleStaff, backupFile: backupFile, readBackup: readBackup });
})(typeof window !== "undefined" ? window : globalThis);
