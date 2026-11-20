/* =====================================================================
   Activity documentation summary: one US Letter page for each resident, for a director to print from the Facility Portal's
   Audit readiness tab. It lists, from what is recorded on this computer:

     what is known       how many of eight things about them are on their profile (by name only, never the answers), and the next
                         best thing to ask the family; with fewer than three it says to ask about work, hometown and one joy
     what was done       the packets made for them and how they took part over the last 30 days (the one-tap log and the Shift board)
     how pages are made  the support level their care team set, the type and line weight it brings, and their profile's print needs
     what is kept off    their topics to avoid, written out

   It SUPPORTS a facility's own records. It is not an assessment, a finding or proof of anything: a surveyor looks at assessments, care
   plans, observation and interviews, nursing homes answer to the federal activities rule and assisted living to each state's. Staff
   text, so every line is 16 pt or larger, pure black on white. Nothing is stored and nothing is sent anywhere; the name on the page
   is the facility's own choice (the name, or an alias).
   Checked by scripts/check-activity-docs-ui.mjs.
   @global CogniActivityDocs
   ===================================================================== */
(function (root) {
  "use strict";
  if (root.CogniActivityDocs) return;
  /* the eight things a profile can hold about a life, in the order the next question is asked */
  var FACTS = [
    { id: "born",     label: "Birth year",         ask: "Ask the family for their birth year.",                  has: function (w) { return !!w.born; } },
    { id: "hometown", label: "Hometown",           ask: "Ask the family where they grew up.",                    has: function (w) { return !!(w.hometown && (w.hometown.town || w.hometown.place)); } },
    { id: "work",     label: "Work",               ask: "Ask the family about the work they did.",               has: function (w) { return !!(w.work && (w.work.label || w.work.text || w.work.vocation)); } },
    { id: "family",   label: "Family and friends", ask: "Ask the family about the people closest to them.",      has: function (w) { return !!(w.family && w.family.all && w.family.all.length); } },
    { id: "music",    label: "Music",              ask: "Ask the family about music they love.",                 has: function (w) { var m = w.music || {}; return !!(m.favoriteSong || (m.artists && m.artists.length) || (m.genres && m.genres.length)); } },
    { id: "hobbies",  label: "Things they enjoy",  ask: "Ask the family what they enjoy doing.",                 has: function (w) { return !!((w.hobbies && w.hobbies.length) || (w.interests && w.interests.length)); } },
    { id: "comforts", label: "Comforts",           ask: "Ask the family what comforts them.",                    has: function (w) { return !!(w.comforts && w.comforts.length); } },
    { id: "story",    label: "A dish or a milestone", ask: "Ask the family about a favorite dish or a milestone.", has: function (w) { return !!((w.dish && w.dish.name) || (w.milestones && w.milestones.length)); } }
  ];
  var THIN = "Ask the family about work, hometown, and one joy to personalize future packets.";
  var HOW = { engaged: "Fully engaged", joined: "Joined in", declined: "Chose another time", watched: "Watched or listened" };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function shortDay(d) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d || "")); return m ? MON[Number(m[2]) - 1] + " " + Number(m[3]) : ""; }
  function daysBack(today, n) { var d = new Date(today + "T12:00:00"); d.setDate(d.getDate() - n); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }

  /* input: { who, person (a resident read by CogniResident.person, or null), track (the tracking record, or null), today (YYYY-MM-DD), days,
              tier (1-3), tierText, floorPt, lineMinPt, needs: { fontScale, contrast, linePt }, avoid: [words] } -> a plain model */
  function model(i) {
    var w = i.person || {}, days = i.days || 30, from = daysBack(i.today, days - 1), t = i.track || { log: [], packets: [] };
    var have = FACTS.filter(function (f) { return f.has(w); }), missing = FACTS.filter(function (f) { return !f.has(w); });
    var log = (t.log || []).filter(function (e) { return e.day >= from && e.day <= i.today; }).sort(function (a, b) { return a.day === b.day ? String(a.at).localeCompare(String(b.at)) : a.day.localeCompare(b.day); });
    var packets = (t.packets || []).filter(function (p) { return p.day >= from && p.day <= i.today; });
    var how = {}; log.forEach(function (e) { how[e.participation] = (how[e.participation] || 0) + 1; });
    return { who: i.who || "Resident", facility: i.facility || "", today: i.today, days: days, from: from, known: have.length, total: FACTS.length, have: have.map(function (f) { return f.label; }),
      next: have.length < 3 ? THIN : (missing[0] ? missing[0].ask : ""), packets: packets.length, packetNames: Array.from(new Set(packets.flatMap(function (p) { return p.names || []; }))).slice(0, 4),
      sessions: log.length, how: how, recent: log.slice(-4).reverse().map(function (e) { return shortDay(e.day) + " · " + e.activity + " · " + (HOW[e.participation] || "Took part"); }),
      tierText: i.tierText || "", floorPt: i.floorPt || 0, lineMinPt: i.lineMinPt || 0, needs: i.needs || {}, avoid: (i.avoid || []).slice(0, 14) };
  }
  function pageHtml(m) {
    var how = ["engaged", "joined", "declined"].map(function (k) { return (HOW[k]) + " " + (m.how[k] || 0); }).join(", ");
    var need = [];
    if (m.needs.fontScale && m.needs.fontScale > 1) need.push("larger print (" + m.needs.fontScale + " times)");
    if (m.needs.contrast === "high_contrast") need.push("high contrast");
    if (m.needs.linePt) need.push("lines " + m.needs.linePt + " pt or heavier");
    var li = function (a) { return a.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join(""); };
    return '<div class="sheet ads-sheet"><header class="ads-head"><div><p class="ads-kick">Activity documentation summary</p><h1 class="ads-who">' + esc(m.who) + '</h1></div>' +
      '<div class="ads-when">' + esc(m.facility) + (m.facility ? "<br>" : "") + "Last " + m.days + " days, to " + esc(shortDay(m.today)) + "</div></header>" +
      '<div class="ads-body">' +
      '<section><h2>What is known about them</h2><p>' + m.known + " of " + m.total + " things are on their profile" + (m.have.length ? ": " + esc(m.have.join(", ")) + "." : ".") + "</p>" + (m.next ? "<p><b>Next:</b> " + esc(m.next) + "</p>" : "") + "</section>" +
      "<section><h2>What was made and done</h2><p>" + m.packets + (m.packets === 1 ? " packet" : " packets") + " made for them" + (m.packetNames.length ? " (" + esc(m.packetNames.join(", ")) + ")" : "") + ". " +
        (m.sessions ? m.sessions + (m.sessions === 1 ? " session" : " sessions") + " recorded: " + how + "." : "No sessions are recorded for these days.") + "</p>" + (m.recent.length ? "<ul>" + li(m.recent) + "</ul>" : "") + "</section>" +
      "<section><h2>How pages are made for them</h2><p>" + esc(m.tierText) + ", set by their care team." + (m.floorPt ? " Their pages use type of at least " + m.floorPt + " pt and lines of at least " + m.lineMinPt + " pt." : "") +
        (need.length ? " Their profile asks for " + esc(need.join(", ")) + "." : "") + "</p></section>" +
      "<section><h2>Kept off their pages</h2><p>" + (m.avoid.length ? esc(m.avoid.join(", ")) + "." : "Nothing is listed. Ask the family whether there is anything to leave out.") + "</p></section>" +
      '<p class="ads-note">This summary lists what is recorded on this computer. It supports a facility’s own records; it is not an assessment or a finding. A surveyor looks at assessments, care plans, observation and interviews. Nursing homes follow the federal activities rule; assisted living follows each state’s rules.</p></div>' +
      '<footer class="ads-foot"><span>' + esc(m.facility || "Cognicopia") + " · Activity documentation summary</span><b>Page 1 of 1</b></footer></div>";
  }
  /* ---------- the monthly participation summary: one US Letter page for a resident and a calendar month, from the one-tap log ----------
     input: { who, person, track, month (YYYY-MM), facility, care (the care-plan wording, if the staff changed it) }.
     "Offered" is not recorded anywhere (the log holds what happened, not what was offered), so the page says "logged" and never claims a rate. */
  var MOOD_FLAG = { restless: 1, anxious: 1, sad: 1, distracted: 1, overstimulated: 1 };
  var MOOD_WORD = { happy: "Happy", content: "Content", calm: "Calm", tired: "Tired", restless: "Restless", anxious: "Anxious or upset", sad: "Sad or tearful", distracted: "Distracted", overstimulated: "Overstimulated" };
  var MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  function monthLabel(m) { var x = /^(\d{4})-(\d{2})$/.exec(String(m || "")); return x ? MONTH_NAMES[Number(x[2]) - 1] + " " + x[1] : String(m || ""); }
  function monthModel(i) {
    var w = i.person || {}, m = String(i.month || ""), t = i.track || { log: [] };
    var have = FACTS.filter(function (f) { return f.has(w); }), log = (t.log || []).filter(function (e) { return String(e.day || "").slice(0, 7) === m; }).sort(function (a, b) { return a.day === b.day ? String(a.at).localeCompare(String(b.at)) : a.day.localeCompare(b.day); });
    var how = { engaged: 0, joined: 0, watched: 0, declined: 0 }; log.forEach(function (e) { if (how[e.participation] != null) how[e.participation]++; });
    var took = how.engaged + how.joined, moods = {}, flagged = 0, withMood = 0, half = { a: [0, 0], b: [0, 0] };
    log.forEach(function (e) {
      if (!e.mood) return;
      withMood++; moods[e.mood] = (moods[e.mood] || 0) + 1; if (MOOD_FLAG[e.mood]) flagged++;
      var late = Number(String(e.day).slice(8)) > 15, h = late ? half.b : half.a; h[0]++; if (MOOD_FLAG[e.mood]) h[1]++;
    });
    var trend = "Not enough moods were recorded this month to describe a trend.";
    if (half.a[0] >= 3 && half.b[0] >= 3) {
      var a = half.a[1] / half.a[0], b = half.b[1] / half.b[0];
      trend = b + 0.2 <= a ? "Moods recorded in the second half of the month were more settled than in the first." : b >= a + 0.2 ? "Moods recorded in the second half of the month were less settled than in the first; the care team may want to look at what changed." : "Moods recorded were about the same in both halves of the month.";
    }
    var who = i.who || "Resident", label = monthLabel(m);
    var care = i.care != null && String(i.care).trim() ? String(i.care) : (log.length
      ? who + " took part (joined in or fully engaged) in " + took + " of " + log.length + " logged activities in " + label + ", watched or listened in " + how.watched + ", and chose another time for " + how.declined + ". Continue to offer activities matched to their level and interests."
      : "No activities are logged for " + who + " in " + label + ". Record how they take part on the Daily engagement screen or the Shift board so this page has something to show.");
    return { who: who, facility: i.facility || "", month: m, label: label, known: have.length, total: FACTS.length, next: have.length < 3 ? THIN : "", logged: log.length, how: how, took: took,
      moods: Object.keys(moods).sort(function (x, y) { return moods[y] - moods[x]; }).map(function (k) { return { id: k, label: MOOD_WORD[k] || k, n: moods[k] }; }), withMood: withMood, flagged: flagged, trend: trend, care: care };
  }
  function monthHtml(m) {
    var bar = function (n, total) { return '<span class="ads-bar" aria-hidden="true"><i style="width:' + (total ? Math.round(100 * n / total) : 0) + '%"></i></span>'; };
    var row = function (label, n) { return "<tr><th scope=\"row\">" + esc(label) + "</th><td>" + n + "</td><td>" + bar(n, m.logged) + "</td></tr>"; };
    return '<div class="sheet ads-sheet"><header class="ads-head"><div><p class="ads-kick">Monthly participation summary</p><h1 class="ads-who">' + esc(m.who) + '</h1></div>' +
      '<div class="ads-when">' + esc(m.facility) + (m.facility ? "<br>" : "") + esc(m.label) + "</div></header>" +
      '<div class="ads-body">' +
      "<section><h2>What was logged</h2><p>" + (m.logged ? m.logged + (m.logged === 1 ? " outcome was" : " outcomes were") + " logged for " + esc(m.label) + ". “Offered” is not recorded, so these are the outcomes that were logged, not a rate." : "Nothing was logged for " + esc(m.label) + ".") + "</p>" +
        (m.logged ? '<table class="ads-tab"><tbody>' + row("Took part (joined in or fully engaged)", m.took) + row("Watched or listened", m.how.watched) + row("Chose another time", m.how.declined) + "</tbody></table>" : "") + "</section>" +
      "<section><h2>How they felt</h2><p>" + (m.withMood ? m.withMood + " of the logged outcomes carry a mood" + (m.moods.length ? ": " + esc(m.moods.map(function (x) { return x.label + " " + x.n; }).join(", ")) + "." : ".") + " " : "") + esc(m.trend) + "</p></section>" +
      "<section><h2>What is known about them</h2><p>" + m.known + " of " + m.total + " things are on their profile." + (m.next ? " " + esc(m.next) : "") + "</p></section>" +
      '<section><h2>Care-plan wording</h2><p class="ads-care">' + esc(m.care).replace(/\n/g, "<br>") + "</p></section>" +
      '<p class="ads-note">This summary supports documentation: it lists what was recorded on this computer and the wording above is the staff’s to edit. It is not an assessment or a finding. Nursing homes follow the federal activities rule; assisted living follows each state’s rules.</p></div>' +
      '<footer class="ads-foot"><span>' + esc(m.facility || "Cognicopia") + " · Monthly participation summary</span><b>Page 1 of 1</b></footer></div>";
  }
  /* up to n residents spread evenly through the list, the same ones each time */
  function sample(list, n) { if (list.length <= n) return list.slice(); var out = []; for (var k = 0; k < n; k++) out.push(list[Math.round(k * (list.length - 1) / (n - 1))]); return out; }
  root.CogniActivityDocs = Object.freeze({ FACTS: FACTS, THIN: THIN, model: model, pageHtml: pageHtml, sample: sample, monthModel: monthModel, monthHtml: monthHtml, monthLabel: monthLabel });
})(typeof window !== "undefined" ? window : this);
