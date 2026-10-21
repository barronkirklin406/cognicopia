/* =====================================================================
   Pay by purchase order or invoice (Net 30): the invoice-request form on pricing.html.

   A facility's accounts payable can buy without a card. This script reads the form, checks it, and makes a one-page
   PDF "invoice request" on this computer with the PDF library the site already carries (assets/vendor/jspdf.umd.min.js).
   Nothing is sent anywhere: no server, no email from this page, no request of any kind. The form's answers are kept in
   this browser only (localStorage "cognicopia_invoice_request": a business's name, billing contact and address, never a
   resident) so a second invoice does not mean typing it all again; "Clear the form" removes them.

   The PDF is a request, not a final invoice: BarronCrafts confirms it by email and sends the final invoice with the
   license key. Prices come from src/config/license.js (the one place prices live); the vendor's own facts are VENDOR
   below, to be changed here as they change (the DUNS number, once issued).

   The pure parts (validate, lines, filename, dates) are exported as CognicopiaInvoice so scripts/check-invoice.mjs can
   run them with no browser.
   ===================================================================== */
(function (root) {
  "use strict";

  var KEY = "cognicopia_invoice_request";
  var DUE_LINE = "Payment Due within 30 Days of Invoice Date.";
  var FORWARD_LINE = "Please forward this generated PDF invoice to your Accounts Payable department.";

  /* The vendor's facts. EIN: issued (the number goes on the W-9, never on a public page). DUNS: applied for. */
  var VENDOR = Object.freeze({
    name: "BarronCrafts / Cognicopia",
    place: "Minot, ND 58701",
    web: "cognicopia.org",
    email: "cognicopia@outlook.com",
    ein: "Issued. Provided on our W-9 on request.",
    duns: "Application in progress. Available when issued.",
    methods: "Corporate Check, ACH/Wire, Purchase Order",
    terms: "Net 30"
  });

  var LIMITS = Object.freeze({ facility: 120, contact: 80, email: 120, phone: 30, street: 100, city: 60, po: 40 });

  /* ---------- plain helpers ---------- */
  function clean(s, max) { return String(s == null ? "" : s).replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max || 200); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function iso(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  function longDate(d) { return MONTHS[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear(); }
  function addDays(d, n) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; }
  function money(n) { return "$" + (Math.round(n * 100) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  /* ---------- the plans, from the one place prices live ---------- */
  function plans() {
    var C = root.CognicopiaLicenseConfig, P = C && C.PRICES;
    if (!P || !P.annual || !P.monthly) throw new Error("src/config/license.js must load before the invoice maker");
    return {
      annual: { key: "annual", label: "Annual facility license ($" + P.annual.amount + " a year, per building)", title: "Cognicopia Annual Facility Engagement License", detail: "12-month term, one building", unit: P.annual.amount },
      monthly: { key: "monthly", label: "Monthly facility license ($" + P.monthly.amount + " a month, per building)", title: "Cognicopia Monthly Facility Engagement License", detail: "First month, one building; renews monthly until cancelled", unit: P.monthly.amount },
      enterprise: { key: "enterprise", label: "Enterprise or multi-site license (custom quote)", title: "Cognicopia Enterprise Facility Engagement License", detail: "Several buildings; the amount follows in a written quote", unit: null }
    };
  }

  /* ---------- validate: what a person typed -> what goes on the invoice, or what to fix ---------- */
  function validate(v) {
    v = v || {}; var P = plans(), e = {}, c = {};
    c.facility = clean(v.facility, LIMITS.facility); if (!c.facility) e.facility = "Enter the facility or company name.";
    c.contact = clean(v.contact, LIMITS.contact); if (!c.contact) e.contact = "Enter the billing contact's name.";
    c.email = clean(v.email, LIMITS.email); if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c.email)) e.email = "Enter an email address such as name@facility.com.";
    c.phone = clean(v.phone, LIMITS.phone); if (c.phone.replace(/\D/g, "").length < 10) e.phone = "Enter the accounts payable phone number with its area code.";
    c.street = clean(v.street, LIMITS.street); if (!c.street) e.street = "Enter the street address.";
    c.city = clean(v.city, LIMITS.city); if (!c.city) e.city = "Enter the city.";
    c.state = clean(v.state, 20).toUpperCase(); if (!/^[A-Z]{2}$/.test(c.state)) e.state = "Enter the two-letter state, such as ND.";
    c.zip = clean(v.zip, 10); if (!/^\d{5}(-\d{4})?$/.test(c.zip)) e.zip = "Enter a 5-digit ZIP code, such as 58701.";
    c.po = clean(v.po, LIMITS.po) || "PO PENDING";
    c.plan = P[String(v.plan)] ? String(v.plan) : null; if (!c.plan) e.plan = "Choose a license.";
    var q = Number(String(v.qty == null ? "" : v.qty).trim());
    c.qty = q; if (!(Number.isInteger(q) && q >= 1 && q <= 99)) e.qty = "Enter how many buildings, from 1 to 99.";
    return { ok: Object.keys(e).length === 0, errors: e, clean: c, order: ["facility", "contact", "email", "phone", "street", "city", "state", "zip", "po", "plan", "qty"] };
  }

  /* ---------- the invoice itself, from clean values ---------- */
  function build(c, now) {
    now = now || new Date();
    var p = plans()[c.plan], quoted = p.unit == null, amount = quoted ? null : p.unit * c.qty;
    var due = addDays(now, 30);
    return {
      ref: "CGR-" + iso(now).replace(/-/g, "") + "-" + refDigits(),
      date: now, dateText: longDate(now), dateIso: iso(now), due: due, dueText: longDate(due),
      po: c.po, bill: c,
      line: { title: p.title, detail: p.detail, qty: c.qty, unit: quoted ? "To be quoted" : money(p.unit), amount: quoted ? "To be quoted" : money(amount) },
      total: quoted ? "To be quoted" : money(amount), quoted: quoted
    };
  }
  function refDigits() {
    try { var a = new Uint16Array(1); root.crypto.getRandomValues(a); return String(1000 + (a[0] % 9000)); }
    catch (e) { return String(1000 + Math.floor(Math.random() * 9000)); }
  }
  function fileName(c, now) {
    var f = String(c.facility).replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "Facility";
    return "Cognicopia_Invoice_" + f + "_" + iso(now || new Date()) + ".pdf";
  }
  function vendorBlock() {
    return ["Vendor Information", "Legal Name: " + VENDOR.name, "Location: " + VENDOR.place, "EIN: " + VENDOR.ein, "DUNS: " + VENDOR.duns,
      "Payment Methods: " + VENDOR.methods, "Payment Terms: " + VENDOR.terms, "Contact: " + VENDOR.email].join("\n");
  }
  function addressLines(c) { return [c.street, c.city + ", " + c.state + " " + c.zip]; }

  /* ---------- the PDF: US Letter, 0.75 in margins, black on white with light grey bands ---------- */
  function makePdf(JsPDF, inv, tight) {
    var d = new JsPDF({ unit: "pt", format: "letter", orientation: "portrait", compress: true });
    d.__noLegal = true;                       // an invoice is not an activity page: no activity footer
    var L = 54, R = 558, W = R - L, y, G = function (n) { return tight ? Math.round(n * 0.55) : n; };   // G: the gaps between blocks, shrunk when a long name would run into the foot
    var T = function (s, x, yy, size, bold, o) { d.setFont("helvetica", bold ? "bold" : "normal"); d.setFontSize(size); d.setTextColor(0, 0, 0); d.text(String(s), x, yy, o || {}); };
    var wrap = function (s, w, size, bold) { d.setFont("helvetica", bold ? "bold" : "normal"); d.setFontSize(size); return d.splitTextToSize(String(s), w); };
    var lines = function (arr, x, yy, size, lead, bold) { arr.forEach(function (t, i) { T(t, x, yy + i * lead, size, bold); }); return yy + arr.length * lead; };

    /* header */
    T(VENDOR.name, L, 70, 18, true);
    T(VENDOR.place, L, 88, 11); T(VENDOR.web, L, 102, 11); T(VENDOR.email, L, 116, 11);
    T("INVOICE REQUEST", R, 70, 20, true, { align: "right" });
    var meta = [["Reference", inv.ref], ["Invoice date", inv.dateText], ["Payment terms", VENDOR.terms], ["Due date", inv.dueText], ["PO number", inv.po]], ex = 0;
    meta.forEach(function (r, i) {
      var yy = 90 + i * 14;
      T(r[0] + ":", 380, yy, 10.5, true);
      if (r[0] === "PO number" && (d.setFont("helvetica", "normal"), d.setFontSize(10.5), d.getTextWidth(r[1]) > R - 380 - 72)) {
        wrap(r[1], R - 380, 10.5, false).forEach(function (t, k) { T(t, R, yy + 13 + k * 12.5, 10.5, false, { align: "right" }); ex += 12.5; });   // a long PO number goes on its own line(s) under its label
      } else T(r[1], R, yy, 10.5, false, { align: "right" });
    });
    ex = Math.ceil(ex);
    d.setDrawColor(0, 0, 0); d.setLineWidth(2); d.line(L, 168 + ex, R, 168 + ex);

    /* bill to */
    T("BILL TO", L, 190 + ex, 9.5, true);
    var b = inv.bill; y = 207 + ex;
    wrap(b.facility, 480, 14, true).forEach(function (t) { T(t, L, y, 14, true); y += 17; });
    var rest = []; ["Attn: " + b.contact, b.email, "Accounts payable phone: " + b.phone].concat(addressLines(b)).forEach(function (t) { rest = rest.concat(wrap(t, 480, 11, false)); });
    y = lines(rest, L, y + 1, 11, 14.5);

    /* the one line */
    y = Math.max(y + G(22), tight ? 0 : 300);
    d.setFillColor(232, 232, 232); d.rect(L, y, W, 24, "F");
    T("Description", L + 8, y + 16, 10.5, true); T("Qty", 396, y + 16, 10.5, true, { align: "right" }); T("Unit price", 478, y + 16, 10.5, true, { align: "right" }); T("Amount", R - 8, y + 16, 10.5, true, { align: "right" });
    y += 24 + 18;
    var tl = wrap(inv.line.title, 290, 11.5, true), dl = wrap(inv.line.detail, 290, 10, false);
    tl.forEach(function (t, i) { T(t, L + 8, y + i * 14, 11.5, true); });
    var by = y + tl.length * 14 - 2; dl.forEach(function (t, i) { T(t, L + 8, by + i * 12.5, 10, false); });
    T(String(inv.line.qty), 396, y, 11.5, false, { align: "right" }); T(inv.line.unit, 478, y, 11.5, false, { align: "right" }); T(inv.line.amount, R - 8, y, 11.5, false, { align: "right" });
    y = by + dl.length * 12.5 + 8;
    d.setLineWidth(0.75); d.line(L, y, R, y);
    y += 24; T("Total due", 430, y, 13, true, { align: "right" }); T(inv.total, R - 8, y, 13, true, { align: "right" });
    if (inv.quoted) { y += 16; T("A written quote follows for several buildings; no amount is due until it is agreed.", R - 8, y, 9.5, false, { align: "right" }); }

    /* the terms sentence and how to pay */
    y += G(34); T(DUE_LINE, L, y, 12.5, true);
    y += G(26); T("REMIT PAYMENT", L, y, 9.5, true); y += 16;
    var remit = [
      "Check: payable to BarronCrafts. The mailing address is in our confirmation email.",
      "ACH or wire: the bank details come by email with the final invoice. They are never printed on this request.",
      "Purchase order: email the PO number to " + VENDOR.email + ". “PO PENDING” means it will follow."
    ];
    remit.forEach(function (r) { wrap(r, W - 14, 10.5, false).forEach(function (t, i) { T((i ? "" : "• ") + t, L + (i ? 12 : 0), y, 10.5, false); y += 14; }); y += 2; });

    /* vendor block */
    y += G(8); var vb = vendorBlock().split("\n"), bh = vb.length * 14 + 14;
    d.setDrawColor(0, 0, 0); d.setLineWidth(1); d.rect(L, y, W, bh);
    T(vb[0].toUpperCase(), L + 10, y + 16, 9.5, true);
    vb.slice(1).forEach(function (t, i) { var k = t.indexOf(":"); T(t.slice(0, k + 1), L + 10, y + 31 + i * 14, 10, true); T(t.slice(k + 2), L + 112, y + 31 + i * 14, 10, false); });
    y += bh + G(18);

    /* what to do next */
    d.setFillColor(238, 238, 238); var nx = wrap("When we confirm this request by email we send the final invoice and the license key together. Until then this page is a request, not a final invoice. Questions: " + VENDOR.email + ".", W - 20, 10, false);
    var fl = wrap(FORWARD_LINE, W - 20, 11, true), nh = 10 + fl.length * 14 + 4 + nx.length * 12.5 + 8; d.rect(L, y, W, nh, "F");
    fl.forEach(function (t, i) { T(t, L + 10, y + 18 + i * 14, 11, true); });
    nx.forEach(function (t, i) { T(t, L + 10, y + 18 + fl.length * 14 + 4 + i * 12.5, 10, false); });
    if (!tight && y + nh > 736) return makePdf(JsPDF, inv, true);       // a very long name: the same page with tighter gaps

    if (y + nh < 738) T(VENDOR.name + "  \u00B7  " + VENDOR.place + "  \u00B7  " + VENDOR.web, 306, 756, 8.5, false, { align: "center" });
    return d;
  }

  /* a plain-HTML copy of the same invoice, for printing when the PDF library cannot load */
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function html(inv) {
    var b = inv.bill;
    return "<h1>Invoice request</h1><p><b>" + esc(VENDOR.name) + "</b><br>" + esc(VENDOR.place) + "<br>" + esc(VENDOR.email) + "</p>" +
      "<p>Reference " + esc(inv.ref) + " &middot; Invoice date " + esc(inv.dateText) + " &middot; Payment terms " + VENDOR.terms + " &middot; Due " + esc(inv.dueText) + " &middot; PO number " + esc(inv.po) + "</p>" +
      "<p><b>Bill to</b><br>" + esc(b.facility) + "<br>Attn: " + esc(b.contact) + "<br>" + esc(b.email) + " &middot; " + esc(b.phone) + "<br>" + addressLines(b).map(esc).join("<br>") + "</p>" +
      "<table><tr><th>Description</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr><tr><td>" + esc(inv.line.title) + "<br>" + esc(inv.line.detail) + "</td><td>" + inv.line.qty + "</td><td>" + esc(inv.line.unit) + "</td><td>" + esc(inv.line.amount) + "</td></tr></table>" +
      "<p><b>Total due " + esc(inv.total) + "</b></p><p><b>" + DUE_LINE + "</b></p>" +
      "<p>Check payable to BarronCrafts. ACH or wire details come by email with the final invoice. Purchase order numbers go to " + esc(VENDOR.email) + ".</p>" +
      "<pre>" + esc(vendorBlock()) + "</pre><p><b>" + FORWARD_LINE + "</b> This is a request, not a final invoice, until we confirm it by email.</p>";
  }

  var api = { KEY: KEY, DUE_LINE: DUE_LINE, FORWARD_LINE: FORWARD_LINE, VENDOR: VENDOR, plans: plans, validate: validate, build: build, fileName: fileName, vendorBlock: vendorBlock, makePdf: makePdf, html: html, money: money };
  root.CognicopiaInvoice = api;
  if (!root.document || !root.document.getElementById("invForm")) return;

  /* ---------- the page ---------- */
  var d = root.document, $ = function (id) { return d.getElementById(id); };
  var FIELDS = ["facility", "contact", "email", "phone", "street", "city", "state", "zip", "po", "plan", "qty"];
  var last = null, kit = null;

  function values() { var v = {}; FIELDS.forEach(function (f) { v[f] = $("inv-" + f).value; }); return v; }
  function save() { try { root.localStorage.setItem(KEY, JSON.stringify(values())); } catch (e) { /* private window: nothing is kept */ } }
  function restore() {
    var v = null; try { v = JSON.parse(root.localStorage.getItem(KEY) || "null"); } catch (e) { v = null; }
    var m = /[?&]plan=(annual|monthly|enterprise)\b/.exec(root.location.search);
    if (v) FIELDS.forEach(function (f) { if (typeof v[f] === "string") $("inv-" + f).value = v[f]; });
    if (m) $("inv-plan").value = m[1];
  }
  function showErrors(r) {
    FIELDS.forEach(function (f) {
      var el = $("inv-" + f), msg = $("inv-err-" + f), bad = !!r.errors[f];
      el.setAttribute("aria-invalid", bad ? "true" : "false"); msg.textContent = bad ? r.errors[f] : ""; msg.hidden = !bad;
    });
  }
  function loadKit() {
    if (kit) return kit;
    var add = function (src) { return new Promise(function (ok, no) { var s = d.createElement("script"); s.src = src; s.onload = ok; s.onerror = function () { no(new Error(src)); }; d.head.appendChild(s); }); };
    kit = (root.jspdf && root.jspdf.jsPDF ? Promise.resolve() : add("assets/vendor/jspdf.umd.min.js")).then(function () { return root.jspdf.jsPDF.__atkinson ? null : add("assets/vendor/jspdf-atkinson.js"); })
      .then(function () { return root.jspdf.jsPDF; }, function (e) { kit = null; throw e; });
    return kit;
  }
  function say(inv, saved) {
    var box = $("invStatus"); box.hidden = false;
    $("invOutRef").textContent = inv.ref; $("invOutTotal").textContent = inv.total; $("invOutDue").textContent = inv.dueText; $("invOutFile").textContent = saved || "";
    $("invOutMsg").textContent = FORWARD_LINE;
    box.focus();
  }
  function make(ev) {
    ev.preventDefault();
    var r = validate(values()); showErrors(r);
    if (!r.ok) { var first = r.order.filter(function (f) { return r.errors[f]; })[0]; $("inv-" + first).focus(); $("invSummary").textContent = "Please fix " + Object.keys(r.errors).length + " thing" + (Object.keys(r.errors).length === 1 ? "" : "s") + " above."; return; }
    $("invSummary").textContent = ""; save();
    var now = new Date(), inv = build(r.clean, now), name = fileName(r.clean, now); last = { inv: inv, name: name };
    loadKit().then(function (J) { var doc = makePdf(J, inv); last.doc = doc; doc.save(name); say(inv, name); },
      function () { $("invPrint").innerHTML = html(inv); say(inv, ""); $("invOutMsg").textContent = "The PDF library could not load, so the invoice is ready to print instead. " + FORWARD_LINE; $("invPrintBtn").hidden = false; });
  }

  var P0 = plans(); Array.prototype.forEach.call($("inv-plan").options, function (o) { if (P0[o.value]) o.textContent = P0[o.value].label; });   // the labels come from the one place prices live
  restore();
  $("invForm").addEventListener("submit", make);
  $("invForm").addEventListener("input", function () { save(); });
  $("invAgain").addEventListener("click", function () { if (last && last.doc) last.doc.save(last.name); });
  $("invPrintBtn").addEventListener("click", function () { d.body.classList.add("inv-printing"); root.print(); d.body.classList.remove("inv-printing"); });
  $("invClear").addEventListener("click", function () { try { root.localStorage.removeItem(KEY); } catch (e) { /* nothing kept */ } $("invForm").reset(); $("inv-plan").value = "annual"; showErrors({ errors: {} }); $("invSummary").textContent = "The form is cleared."; });
  $("invVendor").textContent = vendorBlock();
  $("invCopy").addEventListener("click", function () {
    var s = $("invCopyState"), text = vendorBlock();
    var done = function () { s.textContent = "Copied. You can paste it into a vendor setup form."; };
    var fail = function () { var r = d.createRange(); r.selectNodeContents($("invVendor")); var g = root.getSelection(); g.removeAllRanges(); g.addRange(r); s.textContent = "Select the block and copy it with your keyboard (Ctrl+C, or Command+C on a Mac)."; };
    if (root.navigator.clipboard && root.navigator.clipboard.writeText) root.navigator.clipboard.writeText(text).then(done, fail); else fail();
  });
})(typeof window !== "undefined" ? window : globalThis);
