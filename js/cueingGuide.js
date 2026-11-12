/* =====================================================================
   Therapy goals to a cueing guide: for the person beside a resident, one short line for each goal the resident's therapist set
   and has not yet marked met (Facility tools > Therapy goals, js/slp-goals.js). It appears in the staff strip of the Activity Page
   Studio and of Daily engagement, never on a page a resident reads.

   The lines are plain, adult cueing habits a clinician would recognise (a cue after a pause, one thing at a time, a choice of
   two). They are the same for every resident and give no clinical instruction of their own: they support the therapist's plan,
   they do not replace it. They invite and never test. The goals are read from the resident's sealed record on this computer;
   nothing is stored here and nothing is sent anywhere.
   Checked by scripts/check-cueing-ui.mjs.
   @global CogniCueing
   ===================================================================== */
(function (root) {
  "use strict";
  var doc = root.document; if (!doc || root.CogniCueing) return;
  var SELF = (doc.currentScript && doc.currentScript.src) || "", BASE = SELF.replace(/js\/cueingGuide\.js(\?.*)?$/, "");
  /* by the domain a goal is set in (MoCA and MMSE domains, js/slp-goals.js) */
  var CUES = {
    visuoexec:    { label: "Seeing and planning",     cue: "Show the first step and say it once, then let them lead the rest. Thick lines and plenty of contrast help." },
    naming:       { label: "Finding words",           cue: "Offer the first sound, then a describing phrase, and wait ten slow seconds before giving the word." },
    attention:    { label: "Attention",               cue: "One task on the table at a time, a quiet room, and a short rest after a few minutes." },
    language:     { label: "Language",                cue: "Short, familiar phrases and a choice of two. Give time to finish a sentence before helping." },
    abstraction:  { label: "Categories",              cue: "Start with the things that go together, then invite them to say what each one is for." },
    recall:       { label: "Recall",                  cue: "Give a cue after a pause, such as a first sound or a related detail, before supplying the answer. A story counts." },
    orientation:  { label: "Day, place and people",   cue: "Weave the day and season into the conversation rather than asking for them. Point to the calendar as you speak." },
    registration: { label: "Repeating and recalling", cue: "Say the words once, slowly, and come back to them later in the conversation." }
  };
  var imp = null;
  function goals() { if (!imp) { var url = BASE + "js/slp-goals.js"; imp = (new Function("u", "return import(u)"))(url).catch(function () { return null; }); } return imp; }
  /* -> a promise of [{ domain, label, cue }] for the goals not yet met, in the order the domains are listed, each once */
  function linesFor(residentId) {
    var S = root.CogniSecureStore && root.CogniSecureStore.storage;
    if (!residentId || !S) return Promise.resolve([]);
    return goals().then(function (G) {
      if (!G) return [];
      var log = G.readLog(S, residentId), seen = {}, out = [];
      ["moca", "mmse"].forEach(function (inst) {
        G.progress(log, inst).domains.forEach(function (d) {
          var key = d.id === "visuoexec" ? "visuoexec" : d.id === "orientation" ? "orientation" : d.id;
          if (d.target != null && d.met !== true && CUES[key] && !seen[key]) { seen[key] = 1; out.push({ domain: key, label: CUES[key].label, cue: CUES[key].cue }); }
        });
      });
      return out;
    }).catch(function () { return []; });
  }
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  /* fill an element with the guide for a resident (hidden when there is none) */
  function paint(el, residentId) {
    if (!el) return Promise.resolve([]);
    return linesFor(residentId).then(function (lines) {
      el.hidden = !lines.length;
      el.innerHTML = lines.length ? '<b>For staff · cueing for their therapy goals</b><ul>' + lines.map(function (l) { return "<li><b>" + esc(l.label) + ":</b> " + esc(l.cue) + "</li>"; }).join("") + '</ul><small>From the goals their therapist set. It supports the therapist’s plan and does not replace it.</small>' : "";
      return lines;
    });
  }
  root.CogniCueing = Object.freeze({ CUES: CUES, linesFor: linesFor, paint: paint });
})(typeof window !== "undefined" ? window : this);
