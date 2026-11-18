/* =====================================================================
   Family intake: a short form a family member fills in about someone they love, on the profile page. Three ways to use it:
     - print a blank form to fill in by hand (pure black on white, one page);
     - fill it in on the family's own device and keep the answers as a LOCKED file (a passphrase the family chooses, the same lock the roster's
       handoff file uses), or show them as a loop of QR codes for the staff's camera, or, as a clearly labelled second choice, save a plain file
       that anyone holding it can read;
     - staff open a family file (or read the codes) and the person arrives as a new resident, marked as written by a family so it is looked over.
   Nothing is sent anywhere and nothing the family types is kept in the browser: the answers live in the open window until it is closed.
   A family cannot know a stage or print needs, so the form leaves them out; the profile's own steps fill them in.
   Checked by scripts/check-family-intake-ui.mjs.
   @global CogniFamilyIntake
   ===================================================================== */
(function (root) {
  "use strict";
  var doc = root.document; if (!doc || root.CogniFamilyIntake) return;
  var SCHEMA = "cognicopia.residentProfile", PREFIX = "cognicopia_resident_";
  var S = function () { return root.CogniSecureStore || null; };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var squash = function (s) { return String(s == null ? "" : s).replace(/\s+/g, " ").trim(); };
  var list = function (s) { return String(s || "").split(/[,;\n]+/).map(squash).filter(Boolean).slice(0, 12); };

  /* the questions, in the order they are asked (the same for the screen and the paper) */
  var QUESTIONS = [
    { id: "name",    label: "What do they like to be called?", hint: "The name they answer to" },
    { id: "born",    label: "What year were they born?", hint: "Four digits, for example 1941", type: "number" },
    { id: "town",    label: "Where did they grow up?", hint: "A town or a farm, and the state or country" },
    { id: "work",    label: "What work or role were they proud of?", hint: "A job, or being a homemaker, a farmer, a volunteer" },
    { id: "loves",   label: "What did they love to do?", hint: "Separate with commas: gardening, cards, fishing" },
    { id: "song",    label: "A favorite song or singer", hint: "" },
    { id: "dish",    label: "A favorite food or dish", hint: "" },
    { id: "comfort", label: "What comforts them when they are upset?", hint: "A blanket, a song, a hand to hold, a quiet room" },
    { id: "avoid",   label: "Anything best not brought up?", hint: "Subjects, places or names that upset them. Staff will keep these out of every page", long: true },
    { id: "people",  label: "Who matters most to them?", hint: "One per line: a name and who they are, for example Ruth, daughter", long: true },
    { id: "story",   label: "One story we should know", hint: "A few sentences in your own words", long: true }
  ];

  /* the answers (an object by question id) -> a resident profile the roster can open */
  function buildProfile(a, by) {
    a = a || {}; var name = squash(a.name); if (!name) throw new Error("Type the name they like to be called.");
    var born = parseInt(squash(a.born), 10); if (!(born >= 1880 && born <= new Date().getFullYear())) born = null;
    var now = new Date().toISOString(), id = "res-fam-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
    var people = String(a.people || "").split(/\n+/).map(squash).filter(Boolean).slice(0, 8).map(function (line) {
      var m = line.split(/[,\-–:]\s*/), who = squash(m.shift()), rel = squash(m.join(", "));
      return { name: who, relationship: rel ? { code: "other", label: rel } : null, isPet: /\b(dog|cat|pet|puppy|kitten|bird|horse)\b/i.test(rel), passedAway: /\b(passed|late|died)\b/i.test(rel) };
    }).filter(function (p) { return p.name; });
    var work = squash(a.work);
    return {
      schema: SCHEMA, version: 2, id: id, createdAt: now, updatedAt: now,
      pastVocation: work, formativeEra: born ? Math.floor((born + 18) / 10) * 10 + "s" : "", corePassions: list(a.loves),
      meta: { completedBy: { code: "family", label: "A family member" + (squash(by) ? " (" + squash(by) + ")" : "") }, source: "Family form (profile.html)", needsReview: true },
      tier1_core: {
        preferredName: name, nickname: "", cognitiveTier: null,
        occupation: work ? { code: "other", label: work } : null,
        topHobbies: list(a.loves).map(function (l) { return { code: "other", label: l }; }),
        printNeeds: {},
        topicsToAvoid: { topics: [], eras: [], people: "", places: "", other: squash(a.avoid) }
      },
      tier2_enrichment: {
        birthYear: born, hometown: { environment: null, place: squash(a.town) },
        music: { genres: [], artists: squash(a.song) ? [squash(a.song)] : [], favoriteSong: squash(a.song) },
        skills: { items: [], other: "" }, activityPreferences: []
      },
      tier3_deep: {
        notes: String(a.story || "").replace(/\r\n?/g, "\n").trim(), people: people,
        signatureDish: { name: squash(a.dish), ingredients: "", steps: [] },
        comforts: list(a.comfort).map(function (c) { return { code: "other", label: c }; }), milestones: []
      }
    };
  }

  /* a locked file: the same envelope the roster's handoff uses, so the roster can open it with the passphrase */
  function lockedFile(profile, pass) {
    var s = S(); if (!s) return Promise.reject(new Error("This browser cannot lock a file."));
    return s.exportRoster([profile], pass, "Family form", "Written by a family member").then(function (env) { return JSON.stringify(env); });
  }
  function plainFile(profile) { var s = S(); return JSON.stringify(s.rosterFile([profile], "Family form", "Written by a family member"), null, 1); }
  function save(text, name, type) {
    var blob = new root.Blob([text], { type: type || "application/json" }), url = root.URL.createObjectURL(blob), a = doc.createElement("a");
    a.href = url; a.download = name; doc.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { root.URL.revokeObjectURL(url); }, 4000);
  }

  /* open a family file (locked or plain) and add the person to this computer's residents */
  function openText(text, pass) {
    var s = S(); if (!s) return Promise.reject(new Error("format"));
    return s.readRoster(text, pass || "").then(function (got) {
      var ls = s.storage, R = root.CogniResident, have = R ? R.list(ls) : [], m = s.mergeRoster(have, got.profiles.map(function (p) { p.meta = p.meta || {}; p.meta.needsReview = true; return p; }), "newer");
      m.write.forEach(function (p) { ls.setItem(PREFIX + p.id, JSON.stringify(p)); });
      return s.flush().then(function () { doc.dispatchEvent(new root.CustomEvent("cg-residents-changed")); return { added: m.added, updated: m.updated, names: got.profiles.map(function (p) { return p.tier1_core.preferredName; }) }; });
    });
  }
  var WHY = { passphrase: "That passphrase does not open this file. Check it with the person who made it.", format: "This is not a Cognicopia family file.", kind: "This file is a different kind of Cognicopia file (not a family form)." };
  var say = function (e) { return WHY[e && e.message] || (e && e.message) || "That did not work."; };

  /* the blank form to print: one page, staff-style sheet with writing lines */
  function blankHtml() {
    var rows = QUESTIONS.map(function (q) { return '<div class="cg-fam-q"><p><b>' + esc(q.label) + '</b></p><span class="cg-fam-rule"></span>' + (q.long ? '<span class="cg-fam-rule"></span>' : "") + "</div>"; }).join("");
    return '<div class="cg-staff-sheet cg-fam-sheet"><p class="cg-calm-kick">For a family member</p><h1>Tell us about someone you love</h1>' +
      "<p>Fill in what you can and leave the rest blank. Staff use it to choose music, pictures and conversation that feel familiar.</p>" + rows +
      '<p class="cg-calm-foot">Give this page back to the activity staff. Kept only by the building, on its own computer. Cognicopia</p></div>';
  }
  function printHtml(html) {
    var pr = doc.getElementById("printRoot"), host = pr, saved = pr ? pr.innerHTML : "", cls = pr ? "cg-calm-printing" : "cg-calm-printing cg-calm-own";
    if (!host) { host = doc.getElementById("cgCalmPrint"); if (!host) { host = doc.createElement("div"); host.id = "cgCalmPrint"; host.setAttribute("aria-hidden", "true"); doc.body.appendChild(host); } }
    host.innerHTML = html; cls.split(" ").forEach(function (c) { doc.documentElement.classList.add(c); });
    var done = function () { cls.split(" ").forEach(function (c) { doc.documentElement.classList.remove(c); }); if (pr) pr.innerHTML = saved; root.removeEventListener("afterprint", done); };
    root.addEventListener("afterprint", done); root.print();
  }

  /* ---------- the screen ---------- */
  function field(q) {
    var id = "famQ_" + q.id, lab = '<label class="cg-fam-lab" for="' + id + '">' + esc(q.label) + "</label>" + (q.hint ? '<p class="cg-fam-hint" id="' + id + 'H">' + esc(q.hint) + "</p>" : "");
    var d = q.hint ? ' aria-describedby="' + id + 'H"' : "";
    return '<div class="cg-fam-row">' + lab + (q.long ? '<textarea id="' + id + '" rows="3"' + d + " maxlength=\"1500\"></textarea>" : '<input id="' + id + '" type="' + (q.type === "number" ? "text" : "text") + '"' + (q.type === "number" ? ' inputmode="numeric" maxlength="4"' : ' maxlength="120"') + d + ' autocomplete="off">') + "</div>";
  }
  function dialog() {
    var d = doc.getElementById("cgFamDlg");
    if (!d) { d = doc.createElement("dialog"); d.id = "cgFamDlg"; d.className = "wf-dlg cg-fam-dlg"; d.setAttribute("aria-labelledby", "cgFamH"); doc.body.appendChild(d); }
    return d;
  }
  function formBody() {
    return '<div class="wf-dlg-in"><div class="wf-dlg-head"><h2 id="cgFamH">Tell us about someone you love</h2><button type="button" class="wf-btn wf-alt wf-x" data-fam="close" aria-label="Close">&times;</button></div>' +
      '<p class="wf-dlg-lede">Fill in what you can. Nothing you type is kept on this computer or sent anywhere: when you are done you save it as a locked file, show it as codes, or print it, and give it to the activity staff.</p>' +
      '<div class="cg-fam-row"><label class="cg-fam-lab" for="famBy">Your name (optional)</label><input id="famBy" type="text" maxlength="80" autocomplete="off"></div>' +
      QUESTIONS.map(field).join("") +
      '<fieldset class="cg-fam-save"><legend>Keep what you wrote</legend>' +
      '<p class="cg-fam-hint">Choose a passphrase of at least 10 characters. You will tell it to the staff; the file cannot be opened without it.</p>' +
      '<div class="cg-fam-row"><label class="cg-fam-lab" for="famPass">Passphrase</label><input id="famPass" type="password" autocomplete="new-password" minlength="10"></div>' +
      '<div class="cg-fam-row"><label class="cg-fam-lab" for="famPass2">Type it again</label><input id="famPass2" type="password" autocomplete="new-password" minlength="10"></div>' +
      '<div class="wf-dlg-btns"><button type="button" class="wf-btn" data-fam="lock">Save a locked file</button><button type="button" class="wf-btn wf-alt" data-fam="codes">Show as codes for the staff camera</button></div>' +
      '<details class="cg-fam-plain"><summary>Save a plain file instead (not recommended)</summary>' +
      '<p class="cg-fam-warn">A plain file is not locked. Anyone who holds it, or finds it on a shared computer or in an email, can read everything in it.</p>' +
      '<label class="cg-fam-check"><input type="checkbox" id="famPlainOk"><span>I understand that anyone who has this file can read it.</span></label>' +
      '<div class="wf-dlg-btns"><button type="button" class="wf-btn wf-alt" data-fam="plain" disabled>Save a plain file</button></div></details>' +
      "</fieldset>" +
      '<p class="cg-fam-msg" id="famMsg" role="status" aria-live="polite"></p>' +
      '<div class="wf-dlg-btns"><button type="button" class="wf-btn wf-alt" data-fam="close">Close</button></div></div>';
  }
  function answers(d) { var a = {}; QUESTIONS.forEach(function (q) { var el = d.querySelector("#famQ_" + q.id); a[q.id] = el ? el.value : ""; }); return a; }
  function openForm(from) {
    var d = dialog(); d.innerHTML = formBody(); var msg = function (t, bad) { var m = d.querySelector("#famMsg"); m.textContent = t; m.className = "cg-fam-msg" + (bad ? " is-bad" : t ? " is-ok" : ""); };
    function profile() { return buildProfile(answers(d), d.querySelector("#famBy").value); }
    function pass() {
      var a = d.querySelector("#famPass").value, b = d.querySelector("#famPass2").value, s = S(), why = s && s.passphraseProblem ? s.passphraseProblem(a) : (a.length < 10 ? "Use at least 10 characters." : "");
      if (why) throw new Error(why); if (a !== b) throw new Error("The two passphrases are not the same."); return a;
    }
    d.querySelector("#famPlainOk").onchange = function () { d.querySelector('[data-fam="plain"]').disabled = !this.checked; };
    d.onclick = function (e) {
      var b = e.target.closest && e.target.closest("[data-fam]"); if (e.target === d) { d.close(); return; } if (!b) return; var act = b.dataset.fam;
      if (act === "close") { d.close(); return; }
      try {
        if (act === "lock") { var p = profile(), pw = pass(); lockedFile(p, pw).then(function (text) { save(text, "cognicopia-family-form.cognicopia"); msg("Saved a locked file. Give it to the activity staff and tell them the passphrase. The passphrase is not saved anywhere, so keep it safe."); }, function (er) { msg(say(er), true); }); }
        else if (act === "plain") { var p2 = profile(); save(plainFile(p2), "cognicopia-family-form-plain.json"); msg("Saved a plain file. It is not locked: keep it somewhere private and delete it when the staff have it."); }
        else if (act === "codes") {
          var p3 = profile(), pw3 = pass();
          import("./qrHandoff.js").then(function (m) { return m.showCodes({ profiles: [p3], pass: pw3, from: "Family form", who: p3.tier1_core.preferredName, opener: b }); }).then(function () { msg("The codes are showing. On the staff computer, open Saved residents below and choose Read codes with the camera."); }, function (er) { msg(say(er), true); });
        }
      } catch (er) { msg(say(er), true); }
    };
    d.onclose = function () { d.innerHTML = ""; if (from && from.isConnected) from.focus(); };
    try { d.showModal(); } catch (e) { d.setAttribute("open", ""); }
    var h = d.querySelector("#cgFamH"); if (h) { h.tabIndex = -1; h.focus(); }
  }

  /* the section on the profile page: three buttons, and a place to open what a family brings */
  function mount(host) {
    if (!host) return;
    host.innerHTML = '<h2 id="rapFamH" tabindex="-1">A family member fills this in</h2>' +
      '<p class="rap-hint">Families know things staff cannot. Give them a short form about the person: they can write on paper, or fill it in on their own device. Their answers arrive as a new resident that staff look over before using.</p>' +
      '<div class="cg-fam-btns"><button type="button" class="rap-btn rap-btn-ghost rap-btn-sm" id="famPrint">Print a blank form</button><button type="button" class="rap-btn rap-btn-primary rap-btn-sm" id="famOpenForm">Fill in the family form on this screen</button></div>' +
      '<div class="cg-fam-open"><h3>Add what a family wrote</h3>' +
      '<div class="cg-fam-row"><label class="cg-fam-lab" for="famFile">A family file</label><input id="famFile" type="file" accept=".cognicopia,.json,application/json"></div>' +
      '<div class="cg-fam-row"><label class="cg-fam-lab" for="famOpenPass">Its passphrase (a locked file needs it)</label><input id="famOpenPass" type="password" autocomplete="off"></div>' +
      '<div class="cg-fam-btns"><button type="button" class="rap-btn rap-btn-primary rap-btn-sm" id="famAdd">Open and add as a new resident</button><button type="button" class="rap-btn rap-btn-ghost rap-btn-sm" id="famRead">Read codes with the camera</button></div>' +
      '<p class="cg-fam-msg" id="famOpenMsg" role="status" aria-live="polite"></p></div>';
    var msg = function (t, bad) { var m = host.querySelector("#famOpenMsg"); m.textContent = t; m.className = "cg-fam-msg" + (bad ? " is-bad" : t ? " is-ok" : ""); };
    host.querySelector("#famPrint").onclick = function () { printHtml(blankHtml()); };
    host.querySelector("#famOpenForm").onclick = function () { openForm(this); };
    host.querySelector("#famAdd").onclick = function () {
      var f = host.querySelector("#famFile").files[0]; if (!f) { msg("Choose a family file first.", true); return; }
      var btn = this; btn.disabled = true; msg("Opening…");
      f.text().then(function (text) { return openText(text, host.querySelector("#famOpenPass").value); }).then(function (r) {
        host.querySelector("#famOpenPass").value = ""; host.querySelector("#famFile").value = "";
        msg("Added " + r.names.join(", ") + " as a new resident. A family wrote it, so look it over and set their stage and print needs in the steps above.");
      }).catch(function (e) { msg(say(e), true); }).then(function () { btn.disabled = false; });
    };
    host.querySelector("#famRead").onclick = function () {
      var btn = this; import("./qrHandoff.js").then(function (m) { m.readCodes({ opener: btn }); }, function () { msg("The camera reader could not load.", true); });
    };
  }
  root.CogniFamilyIntake = Object.freeze({ QUESTIONS: QUESTIONS, buildProfile: buildProfile, lockedFile: lockedFile, plainFile: plainFile, openText: openText, blankHtml: blankHtml, mount: mount, openForm: openForm });
})(typeof window !== "undefined" ? window : this);
