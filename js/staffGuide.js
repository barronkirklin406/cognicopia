/* =====================================================================
   The Staff Guide and Feature Tour (resources/staff-guide/).

   Four practice screens, one for each thing staff do most: choose a level, make a month, use the tablet, ask for an
   invoice. Each is a small stand-in for the real screen, with the same words on the same buttons. They make nothing and
   send nothing: nothing typed here is saved, and the page makes no request. The one thing this script makes is the
   one-page Quick-Start sheet, a PDF made on this computer with the PDF library the site already carries.

   The pure parts (eras, file names, the sheet's text) are exported as CognicopiaStaffGuide so scripts/check-staff-guide.mjs
   can read them with no browser.
   ===================================================================== */
(function (root) {
  "use strict";

  /* ---------- plain helpers ---------- */
  /* The decades a person was 15 to 25 in: the memories page draws on those years. A resident born in 1938 was 15 to 25 in
     1953 to 1963, so the 1950s and the 1960s. */
  function eraDecades(born) {
    var y = Math.floor(Number(born));
    if (!(y >= 1900 && y <= 1990)) return [];
    var a = Math.floor((y + 15) / 10) * 10, b = Math.floor((y + 25) / 10) * 10, out = [];
    for (var d = a; d <= b; d += 10) out.push(d + "s");
    return out;
  }
  function eraSentence(born) {
    var d = eraDecades(born);
    if (!d.length) return "Type a year between 1900 and 1990 to see the years the memories page will draw on.";
    return "Born in " + Math.floor(Number(born)) + ": the memories page draws on the " + (d.length === 1 ? d[0] : d.slice(0, -1).join(", ") + " and " + d[d.length - 1]) + ", when they were 15 to 25.";
  }
  /* The same rule the real invoice maker uses for its file name. */
  function invoiceFileName(facility, now) {
    var name = String(facility == null ? "" : facility).replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "Facility";
    var d = now || new Date(), p = function (n) { return (n < 10 ? "0" : "") + n; };
    return "Cognicopia_Invoice_" + name + "_" + d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + ".pdf";
  }

  /* The Quick-Start sheet: one page, in the words staff will see on the buttons. */
  var SHEET = Object.freeze({
    title: "Cognicopia Quick-Start for Activity Staff",
    lead: "Keep this page in your orientation binder or on the breakroom board.",
    steps: Object.freeze([
      ["1", "Make a packet for one resident", "Open the packet tool. Type their first name and year of birth. Under “How much of a challenge?” choose Early, Middle or Late; if you are unsure, choose the easier one. Press “Make the packet”, then “Download PDF Packet”, and print."],
      ["2", "Make the month for everyone", "In the packet tool choose “Download Month (All Residents)”. Pick the month, the paper size and the residents, then press “Generate Bundle PDF”."],
      ["3", "Use the tablet with a resident", "Open Tablet Activities. Choose Early, Middle or Late, then tap an activity. “Finish for me” helps anyone who is stuck. “Home” comes back to the choices."],
      ["4", "Ask accounts payable to buy", "On the Plans and pricing page, fill in “Pay by purchase order or invoice (Net 30)” and press “Make my invoice (PDF)”. Forward the PDF to your Accounts Payable department."]
    ]),
    goodTitle: "Good to know",
    good: Object.freeze([
      "Resident details stay in this computer’s browser. Nothing is sent anywhere.",
      "Pages print in pure black on white, so no color ink is used.",
      "The packet tools work without an internet connection.",
      "After 15 minutes with no activity the screen clears itself. Saved residents are kept."
    ]),
    help: "Questions? Write to cognicopia@outlook.com. Cognicopia is made by BarronCrafts.",
    file: "Cognicopia_Staff_QuickStart.pdf"
  });

  root.CognicopiaStaffGuide = { eraDecades: eraDecades, eraSentence: eraSentence, invoiceFileName: invoiceFileName, SHEET: SHEET };
  var d = root.document;
  if (!d || !d.getElementById("sgTabs")) return;

  var $ = function (id) { return d.getElementById(id); };
  var reduce = !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches);

  /* ---------- the four tabs ---------- */
  var tabs = Array.prototype.slice.call(d.querySelectorAll("#sgTabs [role=tab]"));
  function pick(i, focus) {
    tabs.forEach(function (t, k) {
      var on = k === i; t.setAttribute("aria-selected", on ? "true" : "false"); t.tabIndex = on ? 0 : -1;
      $(t.getAttribute("aria-controls")).hidden = !on;
    });
    if (focus) tabs[i].focus();
  }
  tabs.forEach(function (t, i) {
    t.addEventListener("click", function () { pick(i, false); });
    t.addEventListener("keydown", function (e) {
      var k = e.key, n = tabs.length;
      if (k === "ArrowRight" || k === "ArrowDown") { e.preventDefault(); pick((i + 1) % n, true); }
      else if (k === "ArrowLeft" || k === "ArrowUp") { e.preventDefault(); pick((i + n - 1) % n, true); }
      else if (k === "Home") { e.preventDefault(); pick(0, true); }
      else if (k === "End") { e.preventDefault(); pick(n - 1, true); }
    });
  });
  var fromHash = /^#tour-(\d)$/.exec(root.location.hash || ""); pick(fromHash ? Math.min(3, Math.max(0, +fromHash[1] - 1)) : 0, false);

  /* ---------- the step buttons in every panel ---------- */
  Array.prototype.forEach.call(d.querySelectorAll(".sg-tour"), function (tour) {
    var items = Array.prototype.slice.call(tour.querySelectorAll(".sg-steps li")), at = 0;
    var back = tour.querySelector(".sg-back"), next = tour.querySelector(".sg-next"), count = tour.querySelector(".sg-count");
    function show() {
      items.forEach(function (li, k) { if (k === at) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current"); });
      tour.setAttribute("data-step", String(at + 1));
      count.textContent = "Step " + (at + 1) + " of " + items.length;
      back.disabled = at === 0; next.textContent = at === items.length - 1 ? "Start again" : "Next step";
    }
    back.addEventListener("click", function () { if (at > 0) { at--; show(); } });
    next.addEventListener("click", function () { at = at === items.length - 1 ? 0 : at + 1; show(); });
    show();
  });

  /* ---------- 1. level and era ---------- */
  var stageBtns = Array.prototype.slice.call(d.querySelectorAll("[data-sg-stage]"));
  function drawGrid(stage) {
    var n = { early: 6, middle: 5, late: 4 }[stage] || 5, letters = "CRAFTSUNGLOWBEACHDAYMUSICHOME", g = $("sgGrid"), html = "", i;
    g.style.setProperty("--n", n); g.setAttribute("data-stage", stage);
    for (i = 0; i < n * n; i++) html += "<span>" + letters.charAt((i * 7 + n) % letters.length) + "</span>";
    g.innerHTML = html;
    $("sgStageNote").textContent = { early: "Early: more words, regular letters. Still enjoys working at something.", middle: "Middle: shorter puzzles, larger letters, fewer words.", late: "Late: very simple pages, the largest letters, mostly conversation." }[stage];
  }
  stageBtns.forEach(function (b) {
    b.addEventListener("click", function () {
      stageBtns.forEach(function (o) { o.setAttribute("aria-pressed", o === b ? "true" : "false"); });
      drawGrid(b.getAttribute("data-sg-stage"));
    });
  });
  drawGrid("middle");
  var born = $("sgBorn");
  function era() { $("sgEra").textContent = eraSentence(born.value); }
  born.addEventListener("input", era); era();

  /* ---------- 2. the month ---------- */
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"], sel = $("sgMonth");
  MONTHS.forEach(function (m, i) { var o = d.createElement("option"); o.value = String(i); o.textContent = m; sel.appendChild(o); });
  sel.value = String(new Date().getMonth());
  var timer = null;
  $("sgGo").addEventListener("click", function () {
    var fill = $("sgFill"), bar = $("sgBar"), msg = $("sgBundleMsg"), v = 0;
    clearInterval(timer); msg.textContent = "";
    if (reduce) { fill.style.width = "100%"; bar.setAttribute("aria-valuenow", "100"); msg.textContent = "Practice only: nothing was made. In the real tool your PDF is ready to print or save."; return; }
    timer = setInterval(function () {
      v += 10; fill.style.width = v + "%"; bar.setAttribute("aria-valuenow", String(v));
      if (v >= 100) { clearInterval(timer); msg.textContent = "Practice only: nothing was made. In the real tool your PDF is ready to print or save."; }
    }, 120);
  });

  /* ---------- 3. the tablet ---------- */
  var praiseTimer = null;
  Array.prototype.forEach.call(d.querySelectorAll("[data-sg-tile]"), function (b) {
    b.addEventListener("click", function () {
      var out = $("sgPraise"), word = b.getAttribute("data-praise") || "Lovely.";
      out.textContent = word; out.classList.add("on"); clearTimeout(praiseTimer);
      praiseTimer = setTimeout(function () { out.classList.remove("on"); }, 1800);
    });
  });

  /* ---------- 4. the invoice ---------- */
  $("sgInvoiceMake").addEventListener("click", function () {
    var chip = $("sgFile"), po = String($("sgPo").value || "").replace(/\s+/g, " ").trim().slice(0, 40) || "PO PENDING";
    chip.textContent = invoiceFileName($("sgFacility").value);
    $("sgInvoiceMsg").textContent = "Practice only: no file was made. The real one would carry the purchase order number “" + po + "”, Net 30 terms and the line for Accounts Payable. Forward the PDF to your billing office.";
    $("sgInvoiceOut").hidden = false;
  });

  /* ---------- the Quick-Start sheet (a PDF made on this computer) ---------- */
  var kit = null, here = (d.currentScript && d.currentScript.src) || "";
  var base = here ? here.replace(/js\/staffGuide\.js(?:[?#].*)?$/, "") : "../../";
  function loadKit() {
    if (kit) return kit;
    var add = function (src) { return new Promise(function (ok, no) { var s = d.createElement("script"); s.src = base + src; s.onload = ok; s.onerror = function () { no(new Error(src)); }; d.head.appendChild(s); }); };
    kit = (root.jspdf && root.jspdf.jsPDF ? Promise.resolve() : add("assets/vendor/jspdf.umd.min.js")).then(function () { return root.jspdf.jsPDF.__atkinson ? null : add("assets/vendor/jspdf-atkinson.js"); })
      .then(function () { return root.jspdf.jsPDF; }, function (e) { kit = null; throw e; });
    return kit;
  }
  function makeSheet(JsPDF) {
    var doc = new JsPDF({ unit: "pt", format: "letter", orientation: "portrait", compress: true });
    doc.__noLegal = true;                      // a staff sheet is not an activity page: no activity footer
    var L = 54, W = 504, y = 78;
    var T = function (s, x, yy, size, bold) { doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(size); doc.setTextColor(0, 0, 0); doc.text(String(s), x, yy); };
    var wrap = function (s, w, size, bold) { doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(size); return doc.splitTextToSize(String(s), w); };
    T(SHEET.title, L, y, 22, true); y += 26;
    T(SHEET.lead, L, y, 12, false); y += 34;
    SHEET.steps.forEach(function (s) {
      T(s[0], L, y, 20, true); T(s[1], L + 30, y, 14, true); y += 20;
      wrap(s[2], W - 30, 12, false).forEach(function (t) { T(t, L + 30, y, 12, false); y += 16; });
      y += 14;
    });
    y += 4; T(SHEET.goodTitle, L, y, 14, true); y += 20;
    SHEET.good.forEach(function (g) { wrap(g, W - 16, 12, false).forEach(function (t, i) { T((i ? "" : "•") , L, y, 12, false); T(t, L + 14, y, 12, false); y += 16; }); y += 3; });
    y += 12; wrap(SHEET.help, W, 12, true).forEach(function (t) { T(t, L, y, 12, true); y += 16; });
    return doc;
  }
  var btn = $("sgPrint"), note = $("sgPrintMsg");
  btn.addEventListener("click", function () {
    note.textContent = "Making your sheet…";
    loadKit().then(function (J) { makeSheet(J).save(SHEET.file); note.textContent = "Your one-page guide was saved as " + SHEET.file + ". Open it and print it."; },
      function () { note.textContent = "The PDF library could not load. Reload the page and try again, or use your browser’s Print command on this page."; });
  });
})(typeof window !== "undefined" ? window : globalThis);
