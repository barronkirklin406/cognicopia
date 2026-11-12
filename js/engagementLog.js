/* =====================================================================
   One-tap engagement log: three buttons and an optional line, for the person who has just sat with a resident.

     Fully engaged      the resident took part with their whole attention
     Joined in          they took part
     Chose another time they chose not to, which is a fine answer

   A tap writes one entry into the resident's tracking record (assets/services/residentTracker.js: the same record the Roster, the
   Shift board and the staff pages already read), in the same words as the Shift board. It is written once, in the sealed store on
   this computer, under the resident's own key; nothing is sent anywhere. The optional line may not name anyone (the record
   already belongs to one resident): a line that does is refused, and nothing is saved until it is changed.

   It is a staff control: on Daily engagement, in the Tablet Activities staff panel (hidden in Resident Mode), and in the Roster.
   Checked by scripts/check-engagement-ui.mjs.
   @global CogniEngage
   ===================================================================== */
(function (root) {
  "use strict";
  var doc = root.document; if (!doc || root.CogniEngage) return;
  var SELF = (doc.currentScript && doc.currentScript.src) || "", BASE = SELF.replace(/js\/engagementLog\.js(\?.*)?$/, "");
  var OUTCOMES = [["engaged", "Fully engaged"], ["joined", "Joined in"], ["declined", "Chose another time"]];
  var loading = {};
  function script(src) {
    if (loading[src]) return loading[src];
    return (loading[src] = new Promise(function (res) { var s = doc.createElement("script"); s.src = BASE + src; s.onload = function () { res(true); }; s.onerror = function () { res(false); }; doc.head.appendChild(s); }));
  }
  function ready() {
    var p = Promise.resolve(true);
    if (!root.CogniSecureStore) p = p.then(function () { return script("assets/services/secureStore.js"); });
    if (!root.CogniTracker) p = p.then(function () { return script("assets/services/residentTracker.js"); });
    return p.then(function () { return !!(root.CogniSecureStore && root.CogniSecureStore.storage && root.CogniTracker); });
  }
  var today = function () { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  /* write one entry: -> Promise of { ok, message } */
  function record(residentId, input, names) {
    return ready().then(function (ok) {
      if (!ok) return { ok: false, message: "The record could not be opened on this computer." };
      if (!residentId) return { ok: false, message: "Choose a resident first." };
      var T = root.CogniTracker, S = root.CogniSecureStore.storage, key = T.STORE_PREFIX + residentId, raw = null;
      try { raw = JSON.parse(S.getItem(key) || "null"); } catch (e) { raw = null; }
      var res = T.addEntry(T.normalize(raw, residentId, today()), input, new Date(), names || []);
      if (!res.entry) return { ok: false, message: res.problems[0] || "That could not be saved." };
      try { S.setItem(key, JSON.stringify(res.track)); if (root.CogniSecureStore.flush) root.CogniSecureStore.flush(); } catch (e) { return { ok: false, message: "The record could not be saved: " + e.message }; }
      return { ok: true, entry: res.entry, message: "Saved: " + T.participationLabel(res.entry.participation) + "." };
    });
  }
  /* the entries a visit sheet can draw on: what went well lately, newest first, as short lines (the note when there is one, else the activity) */
  function wentWell(residentId, days, max) {
    return ready().then(function (ok) {
      if (!ok || !residentId) return [];
      var T = root.CogniTracker, S = root.CogniSecureStore.storage, raw = null;
      try { raw = JSON.parse(S.getItem(T.STORE_PREFIX + residentId) || "null"); } catch (e) { raw = null; }
      var t = T.normalize(raw, residentId, today()), cut = new Date(); cut.setDate(cut.getDate() - (days || 21));
      var from = cut.toISOString().slice(0, 10), seen = {}, out = [];
      t.log.slice().reverse().forEach(function (e) {
        if ((e.participation !== "engaged" && e.participation !== "joined") || e.day < from) return;
        var line = (e.note || e.activity || "").trim(); if (!line || seen[line.toLowerCase()] || out.length >= (max || 3)) return;
        seen[line.toLowerCase()] = 1; out.push(line);
      });
      return out;
    }).catch(function () { return []; });
  }
  var n = 0;
  /* put the strip into host. opts: { residentId: fn -> id, names: fn -> [names to refuse], activity: fn -> a few words, onSaved } */
  function mount(host, opts) {
    if (!host) return null;
    opts = opts || {};
    var id = "cgEng" + (++n);
    host.classList.add("cg-eng"); host.setAttribute("role", "group"); host.setAttribute("aria-labelledby", id + "H");
    host.innerHTML = '<b class="cg-eng-h" id="' + id + 'H">How did it go?</b><div class="cg-eng-btns">' + OUTCOMES.map(function (o) { return '<button type="button" data-p="' + o[0] + '">' + o[1] + "</button>"; }).join("") +
      '</div><label class="cg-eng-lab" for="' + id + 'N">One line, if you like <small>(no names)</small></label><input class="cg-eng-note" id="' + id + 'N" type="text" maxlength="160" autocomplete="off">' +
      '<p class="cg-eng-msg" role="status" aria-live="polite"></p>';
    var note = host.querySelector("input"), msg = host.querySelector(".cg-eng-msg");
    host.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("button[data-p]"); if (!b) return;
      var rid = opts.residentId ? opts.residentId() : "";
      msg.textContent = "Saving…";
      record(rid, { participation: b.getAttribute("data-p"), note: note.value, activity: (opts.activity && opts.activity()) || "Activity with staff", source: "record" }, opts.names ? opts.names() : []).then(function (r) {
        msg.textContent = r.message;
        if (r.ok) { note.value = ""; if (opts.onSaved) opts.onSaved(r.entry); }
      });
    });
    return { el: host };
  }
  root.CogniEngage = Object.freeze({ OUTCOMES: OUTCOMES, mount: mount, record: record, wentWell: wentWell, ready: ready });
})(typeof window !== "undefined" ? window : this);
