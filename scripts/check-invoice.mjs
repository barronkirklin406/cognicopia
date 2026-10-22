#!/usr/bin/env node
/* =====================================================================
   The purchase-order and invoice-request maker (pricing.html#invoice, js/invoiceMaker.js).

     rules      the form's checks (what is required, what a good ZIP, state, email and phone look like), an empty PO number
                becoming "PO PENDING", the totals from the prices in src/config/license.js, the file name
     email      the request as plain "Label: value" lines under the subject "[Cognicopia Invoice Request] <reference>", opened
                in the person's own mail program by a button (or copied), so the Net-30 desk (docs/net30-desk.md) can read it
     browser    in a real browser (Playwright; exit 2 where it is not installed): an empty form names what to fix and
                moves to the first field; a filled form downloads Cognicopia_Invoice_<FACILITY>_<DATE>.pdf and says to forward it
                to Accounts Payable; the answers are kept in this browser only and "Clear the form" removes them;
                nothing is requested from outside the page, and nothing is sent at all (no POST, no beacon)
     pdf        the PDF is read back with PyMuPDF: one US Letter page, every line inside the 0.75 in margins, no line over another,
                black text; it holds the vendor, "Net 30", the PO number, the line item, the total, "Payment Due within 30 Days
                of Invoice Date." and the forward-to-accounts-payable sentence; an Enterprise request says "To be quoted"
   ===================================================================== */
import fs from "fs";
import os from "os";
import path from "path";
import vm from "vm";
import { spawnSync } from "child_process";
import { loadPlaywright, serve, ROOT } from "./lib/browser.mjs";

let passed = 0; const problems = [], notes = [];
const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");

/* ---------- the rules, with no browser ---------- */
const box = { crypto: { getRandomValues: a => { a[0] = 4242; return a; } } }; box.globalThis = box; vm.createContext(box);
vm.runInContext(read("src/config/license.js"), box); vm.runInContext(read("js/invoiceMaker.js"), box);
const I = box.CognicopiaInvoice, P = box.CognicopiaLicenseConfig.PRICES;
const good = { facility: "Maple Grove Senior Living", contact: "Pat Example", email: "ap@maplegrove.example", phone: "(701) 555-0100", street: "100 Example Street", city: "Minot", state: "nd", zip: "58701", po: "", plan: "annual", qty: "2" };

const v = I.validate(good);
ok(v.ok && v.clean.po === "PO PENDING", "an empty PO number becomes \"PO PENDING\"");
ok(v.clean.state === "ND", "the state is made upper case");
ok(I.validate(Object.assign({}, good, { po: "  PO-7731  " })).clean.po === "PO-7731", "a PO number is kept, trimmed");
ok(I.validate(Object.assign({}, good, { po: "   " })).clean.po === "PO PENDING", "a PO number of spaces is empty");
const bad = I.validate({});
ok(!bad.ok && ["facility", "contact", "email", "phone", "street", "city", "state", "zip", "plan", "qty"].every(f => bad.errors[f]), "an empty form names every required field");
ok(!bad.errors.po, "the PO number is never required");
[["email", "not-an-email"], ["phone", "12345"], ["state", "North Dakota"], ["zip", "5870"], ["zip", "58701-12"], ["qty", "0"], ["qty", "1.5"], ["qty", "100"], ["qty", "abc"], ["plan", "lifetime"]]
  .forEach(([f, x]) => ok(!!I.validate(Object.assign({}, good, { [f]: x })).errors[f], `${f} "${x}" is refused`));
[["zip", "58701-1234"], ["zip", "58701"], ["phone", "701-555-0100"], ["phone", "+1 701 555 0100"], ["qty", "99"], ["plan", "monthly"], ["plan", "enterprise"]]
  .forEach(([f, x]) => ok(!I.validate(Object.assign({}, good, { [f]: x })).errors[f], `${f} "${x}" is accepted`));
ok(I.validate(Object.assign({}, good, { facility: "A\u0000B\n  C" })).clean.facility === "A B C", "control characters and runs of spaces are removed");
ok(I.validate(Object.assign({}, good, { facility: "x".repeat(500) })).clean.facility.length === 120, "a very long name is cut to 120 characters");

const now = new Date(2026, 9, 21, 12, 0, 0);
const a = I.build(v.clean, now);
ok(a.total === "$" + (P.annual.amount * 2).toLocaleString("en-US", { minimumFractionDigits: 2 }), `2 annual licenses total ${a.total} (the price in license.js is $${P.annual.amount})`);
ok(a.dateText === "October 21, 2026" && a.dueText === "November 20, 2026", `the invoice date is ${a.dateText} and 30 days later is ${a.dueText}`);
ok(/^CGR-20261021-\d{4}$/.test(a.ref), `the reference looks like CGR-20261021-1234 (${a.ref})`);
const m = I.build(I.validate(Object.assign({}, good, { plan: "monthly", qty: "3" })).clean, now);
ok(m.total === "$" + (P.monthly.amount * 3).toFixed(2), `3 monthly licenses total ${m.total}`);
const e = I.build(I.validate(Object.assign({}, good, { plan: "enterprise", qty: "5" })).clean, now);
ok(e.quoted && e.total === "To be quoted" && e.line.amount === "To be quoted", "an Enterprise request is \"To be quoted\", never a made-up price");
const cross = I.build(I.validate(Object.assign({}, good, { plan: "annual", qty: "1" })).clean, new Date(2026, 11, 15)); ok(cross.dueText === "January 14, 2027", `30 days from December 15 is ${cross.dueText} (the year turns over)`);
ok(I.fileName(v.clean, now) === "Cognicopia_Invoice_Maple_Grove_Senior_Living_2026-10-21.pdf", `the file is named Cognicopia_Invoice_<FACILITY>_<DATE>.pdf (${I.fileName(v.clean, now)})`);
ok(I.fileName({ facility: "St. Mary's / North (Wing) #2" }, now) === "Cognicopia_Invoice_St_Mary_s_North_Wing_2_2026-10-21.pdf", "a name with punctuation makes a safe file name");
{ /* the request as an email: plain "Label: value" lines, a fixed subject, the vendor's own address, and no PDF bytes */
  const mr = I.mailRequest(a, I.fileName(v.clean, now)), lines = mr.text.split("\r\n"), field = k => (lines.find(l => l.startsWith(k + ": ")) || "").slice(k.length + 2);
  ok(mr.to === I.VENDOR.email && mr.subject === "[Cognicopia Invoice Request] " + a.ref && I.MAIL_SUBJECT === "[Cognicopia Invoice Request] ", "the email goes to the vendor's own address under the fixed subject with the reference");
  ok(field("Reference") === a.ref && field("Facility") === v.clean.facility && field("Billing contact") === v.clean.contact && field("Contact email") === v.clean.email && field("Phone") === v.clean.phone, "it carries the reference, the facility, the contact, the email and the phone");
  ok(field("Address") === `${v.clean.street}, ${v.clean.city}, ${v.clean.state} ${v.clean.zip}` && field("PO number") === a.po && field("License") === v.clean.plan && field("Buildings") === String(v.clean.qty) && field("Total") === a.total && field("Terms") === "Net 30", "and the address, PO number, license, buildings, total and terms");
  ok(mr.href.startsWith("mailto:" + I.VENDOR.email + "?subject=") && decodeURIComponent(mr.href.split("&body=")[1]) === mr.text && mr.href.length < 1800, `the link opens a mail program with the same text (${mr.href.length} characters)`);
  const em = I.mailRequest(e, "x.pdf"); ok(/Total: To be quoted/.test(em.text) && !/\$\d/.test(em.text), "an Enterprise request says \"To be quoted\" in the email too");
  ok(!/routing|account number|\bEIN: \d|\bDUNS: \d/i.test(mr.text), "the email holds no bank detail, EIN or DUNS number"); }
ok(I.fileName({ facility: "!!!" }, now) === "Cognicopia_Invoice_Facility_2026-10-21.pdf", "a name with no letters still makes a file name");
ok(I.DUE_LINE === "Payment Due within 30 Days of Invoice Date.", "the payment sentence is the owner's, word for word");
ok(I.FORWARD_LINE === "Please forward this generated PDF invoice to your Accounts Payable department.", "the forwarding sentence is the owner's, word for word");
const vb = I.vendorBlock();
ok(/Legal Name: BarronCrafts \/ Cognicopia/.test(vb) && /Location: Minot, ND 58701/.test(vb) && /Payment Methods: Corporate Check, ACH\/Wire, Purchase Order/.test(vb), "the vendor block names the vendor, the place and the payment methods");
ok(/EIN: /.test(vb) && vb.includes("DUNS: " + I.VENDOR.duns) && !/\b\d{9}\b/.test(I.VENDOR.duns), "the vendor block states the EIN and the DUNS status, and no 9-digit number is written in the script");
ok(!/\b\d{2}-\d{7}\b/.test(read("js/invoiceMaker.js") + read("pricing.html")), "no EIN number is written in a page or script");
ok(!/\b0[0-9]{8}\b.*DUNS|DUNS[^\n]{0,30}\b\d{9}\b/.test(read("js/invoiceMaker.js")), "no DUNS number is written in a script");
ok(!/routing|account number|IBAN|SWIFT/i.test(read("js/invoiceMaker.js").replace(/never printed[^"]*/gi, "")), "no bank detail is written in a script");
const src = read("js/invoiceMaker.js").replace(/\/\*[\s\S]*?\*\//g, "");
ok(!/fetch\(|XMLHttpRequest|sendBeacon|WebSocket|navigator\.sendBeacon/.test(src), "the invoice maker makes no request");
ok((src.match(/mailto:/g) || []).length === 1 && /function mailRequest[\s\S]*?"mailto:" \+ VENDOR\.email/.test(src) && /\$\("invMail"\)\.addEventListener\("click"/.test(src), "the only mail is the person's own: one mailto link, built in mailRequest, opened only when they press the button");
ok(!/https?:\/\//.test(src), "the invoice maker names no web address");
ok(/js\/invoiceMaker\.js/.test(read("sw.js")), "the offline cache holds the invoice maker");
ok(/<script src="js\/invoiceMaker\.js"><\/script>/.test(read("pricing.html")), "pricing.html loads the invoice maker");

/* ---------- the browser ---------- */
const PY = `
import sys, json
import pymupdf as fitz
doc = fitz.open(sys.argv[1]); out = {"pages": doc.page_count, "w": doc[0].rect.width, "h": doc[0].rect.height, "text": "", "lines": [], "colors": []}
for pg in doc:
    out["text"] += pg.get_text() + "\\n"
    for blk in pg.get_text("dict")["blocks"]:
        for ln in blk.get("lines", []):
            t = "".join(s["text"] for s in ln["spans"]).strip()
            if t:
                out["lines"].append({"t": t, "b": ln["bbox"]})
                out["colors"] += [s["color"] for s in ln["spans"] if s["text"].strip()]
print(json.dumps(out))
`;
const pdfInfo = file => { const r = spawnSync("python3", ["-I", "-c", PY, file], { encoding: "utf8", timeout: 60000 }); try { return JSON.parse(r.stdout.trim().split("\n").pop()); } catch (x) { return null; } };
const norm = s => s.replace(/\s+/g, " ");

const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cg-invoice-"));
const outside = [], posts = [], errors = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, serviceWorkers: "block", acceptDownloads: true });
  await ctx.addInitScript(() => { try { localStorage.setItem("cognicopia_eula_accepted", "true"); } catch (x) { /* ignore */ } });
  const p = await ctx.newPage();
  p.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about|mailto):/.test(u)) outside.push(u); if (r.method() !== "GET") posts.push(r.method() + " " + u); });
  p.on("pageerror", x => errors.push(x.message));
  p.on("console", x => { if (x.type() === "error") errors.push("console: " + x.text().slice(0, 140)); });
  await p.goto(base + "pricing.html#invoice"); await p.waitForSelector("#invForm");

  /* an empty form */
  await p.click("#invMake");
  const shown = await p.evaluate(() => ({ errs: [...document.querySelectorAll(".inv-err:not([hidden])")].length, focus: document.activeElement && document.activeElement.id, summary: document.getElementById("invSummary").textContent, hidden: document.getElementById("invStatus").hidden }));
  ok(shown.errs === 8, `an empty form says what to fix, field by field: the 8 that have no default (${shown.errs})`);
  ok(shown.focus === "inv-facility", `and moves to the first field (${shown.focus})`);
  ok(/Please fix \d+ things above/.test(shown.summary) && shown.hidden, "and does not make an invoice");
  const sizes = await p.evaluate(() => [...document.querySelectorAll("#invForm input, #invForm select, #invForm button, #invCopy, #invAgain")].map(e => { const r = e.getBoundingClientRect(); return r.width ? Math.min(r.width, r.height) : 99; }));
  ok(Math.min(...sizes) >= 52, `every control in the form is at least 52 px tall (${Math.round(Math.min(...sizes))})`);
  const opts = await p.evaluate(() => [...document.querySelectorAll("#inv-plan option")].map(o => o.textContent));
  ok(opts.some(t => t.includes("$" + P.annual.amount)) && opts.some(t => t.includes("$" + P.monthly.amount)), `the license choices carry the prices from license.js (${opts.join(" | ")})`);
  ok(await p.evaluate(() => getComputedStyle(document.getElementById("invPrint")).display) === "none", "the printable copy is hidden unless it is needed");

  /* a made invoice */
  const fill = async o => { for (const [k, val] of Object.entries(o)) { if (k === "plan") await p.selectOption("#inv-plan", val); else await p.fill("#inv-" + k, val); } };
  const make = async (o, label) => {
    await fill(o);
    const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 20000 }), p.click("#invMake")]);
    const file = path.join(tmp, label + ".pdf"); await dl.saveAs(file);
    return { name: dl.suggestedFilename(), info: pdfInfo(file) };
  };
  const today = await p.evaluate(() => { const d = new Date(), z = n => (n < 10 ? "0" : "") + n; return d.getFullYear() + "-" + z(d.getMonth() + 1) + "-" + z(d.getDate()); });
  const base1 = { facility: "Maple Grove Senior Living", contact: "Pat Example", email: "ap@maplegrove.example", phone: "(701) 555-0100", street: "100 Example Street", city: "Minot", state: "nd", zip: "58701", po: "", qty: "2" };
  const r1 = await make(Object.assign({ plan: "annual" }, base1), "annual");
  ok(r1.name === `Cognicopia_Invoice_Maple_Grove_Senior_Living_${today}.pdf`, `the download is named ${r1.name}`);
  const st = await p.evaluate(() => ({ hidden: document.getElementById("invStatus").hidden, msg: document.getElementById("invOutMsg").textContent, ref: document.getElementById("invOutRef").textContent, total: document.getElementById("invOutTotal").textContent, focus: document.activeElement && document.activeElement.id }));
  ok(!st.hidden && st.msg === "Please forward this generated PDF invoice to your Accounts Payable department.", "the page says to forward the PDF to Accounts Payable, word for word");
  ok(st.total === "$" + (P.annual.amount * 2).toFixed(2), `and shows the total (${st.total})`);
  const lum = rgb => { const k = rgb.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * k[0] + 0.7152 * k[1] + 0.0722 * k[2]; };
  const cols = await p.evaluate(() => { const g = (sel, prop) => getComputedStyle(document.querySelector(sel))[prop]; return { bg: g("#invStatus", "backgroundColor"), h2: g("#invStatus h2", "color"), msg: g("#invOutMsg", "color"), ref: g("#invOutRef", "color"), btn: g("#invAgain", "color"), btnBg: g("#invAgain", "backgroundColor") }; });
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  ok(ratio(cols.h2, cols.bg) >= 7 && ratio(cols.msg, cols.bg) >= 7 && ratio(cols.ref, cols.bg) >= 7, `the confirmation's text is readable on its panel (${ratio(cols.msg, cols.bg).toFixed(1)}:1)`);
  ok(ratio(cols.btn, cols.btnBg) >= 7, `and so is its button (${ratio(cols.btn, cols.btnBg).toFixed(1)}:1)`);
  /* the email buttons: the person's own mail program opens with the details; nothing is sent by the page */
  {
    const cdp = await ctx.newCDPSession(p); await cdp.send("Page.enable"); const mails = [];
    cdp.on("Page.frameRequestedNavigation", ev => { if (/^mailto:/.test(ev.url)) mails.push(ev.url); });
    await p.click("#invMail"); await p.waitForTimeout(400);
    ok(mails.length === 1, `pressing "Email this request" opens one mail program window (${mails.length})`);
    const decoded = mails[0] ? decodeURIComponent(mails[0]) : "";
    ok(decoded.startsWith("mailto:" + I.VENDOR.email + "?subject=[Cognicopia Invoice Request] CGR-") && /Facility: Maple Grove Senior Living/.test(decoded) && /Total: \$/.test(decoded) && /Please attach the PDF you just downloaded \(Cognicopia_Invoice_Maple_Grove_Senior_Living_/.test(decoded), "with the subject, the facility, the total and the reminder to attach the PDF");
    await ctx.grantPermissions(["clipboard-read", "clipboard-write"]);
    await p.click("#invMailCopy"); await p.waitForTimeout(300);
    const copied = await p.evaluate(() => navigator.clipboard.readText());
    ok(/^Cognicopia Net-30 invoice request\n\nReference: CGR-/.test(copied) && /Contact email: ap@maplegrove\.example/.test(copied) && /Please paste/.test("Please paste") && /subject/i.test(await p.textContent("#invMailState")), "\"Copy the details instead\" puts the same text on the clipboard and says where to paste it");
    const small = await p.evaluate(() => ["invMail", "invMailCopy"].map(id => { const r = document.getElementById(id).getBoundingClientRect(); return Math.min(r.width, r.height); }));
    ok(Math.min(...small) >= 52, `both buttons are at least 52 px (${Math.round(Math.min(...small))})`);
  }

  const pdf = r1.info;
  if (!pdf) problems.push("the invoice PDF could not be read back with PyMuPDF");
  else {
    const T = norm(pdf.text);
    ok(pdf.pages === 1 && Math.abs(pdf.w - 612) < .01 && Math.abs(pdf.h - 792) < .01, `the invoice is one US Letter page (${pdf.pages} page, ${pdf.w} x ${pdf.h} pt)`);
    for (const need of ["INVOICE REQUEST", "BarronCrafts / Cognicopia", "Minot, ND 58701", "Payment terms: Net 30", "PO number: PO PENDING", "Maple Grove Senior Living", "Attn: Pat Example", "ap@maplegrove.example", "(701) 555-0100", "100 Example Street", "Minot, ND 58701", "Cognicopia Annual Facility Engagement License", "Total due", "$" + (P.annual.amount * 2).toFixed(2),
      "Payment Due within 30 Days of Invoice Date.", "Please forward this generated PDF invoice to your Accounts Payable department.", "Corporate Check, ACH/Wire, Purchase Order", "DUNS: " + I.VENDOR.duns.slice(0, 20), "REMIT PAYMENT", "Check: payable to BarronCrafts", "request, not a final invoice"])
      ok(T.includes(need), `the invoice says "${need}"`);
    ok(!/Not Medical Advice/.test(T), "an invoice does not carry the activity footer");
    const m0 = 54 - 0.75; let outOf = 0, over = 0;
    pdf.lines.forEach(l => { if (l.b[0] < m0 || l.b[2] > 612 - m0 || l.b[1] < 36 || l.b[3] > 792 - 30) outOf++; });
    for (let i = 0; i < pdf.lines.length; i++) for (let j = i + 1; j < pdf.lines.length; j++) {
      const A = pdf.lines[i].b, B = pdf.lines[j].b, ix = Math.min(A[2], B[2]) - Math.max(A[0], B[0]), iy = Math.min(A[3], B[3]) - Math.max(A[1], B[1]);
      if (ix > 1 && iy > 2.5) { over++; if (over < 3) problems.push(`two lines of the invoice overlap: "${pdf.lines[i].t}" and "${pdf.lines[j].t}"`); }
    }
    ok(outOf === 0, `every line of the invoice is inside the 0.75 in margins (${outOf} outside)`);
    ok(over === 0, "no line of the invoice is printed over another");
    ok(pdf.colors.every(c => c === 0), "all invoice text is black");
  }
  const kept = await p.evaluate(() => localStorage.getItem("cognicopia_invoice_request"));
  ok(!!kept && JSON.parse(kept).facility === "Maple Grove Senior Living", "the answers are kept in this browser");
  await p.reload(); await p.waitForSelector("#invForm");
  ok(await p.inputValue("#inv-facility") === "Maple Grove Senior Living" && await p.inputValue("#inv-qty") === "2", "and are filled in again on the next visit");
  const [dl2] = await Promise.all([p.waitForEvent("download", { timeout: 20000 }), p.click("#invMake")]); ok(!!dl2, "a second invoice needs no retyping");
  await p.click("#invAgain").catch(() => {});

  /* other plans and a PO number */
  const r2 = await make(Object.assign({}, base1, { plan: "monthly", qty: "3", po: "PO-7731" }), "monthly");
  const t2 = r2.info && norm(r2.info.text);
  ok(t2 && t2.includes("PO number: PO-7731") && t2.includes("Cognicopia Monthly Facility Engagement License") && t2.includes("$" + (P.monthly.amount * 3).toFixed(2)), "a monthly request with a PO number says so and totals three months' licenses");
  const r3 = await make(Object.assign({}, base1, { plan: "enterprise", qty: "5", facility: "A Very Long Facility Name That Goes On And On For Several Words Group Of Senior Communities LLC" }), "enterprise");
  const t3 = r3.info && norm(r3.info.text);
  ok(t3 && t3.includes("To be quoted") && !/\$\d/.test(t3.replace(/\$\d[\d,]*\.\d\d.*never/, "")), "an Enterprise request says \"To be quoted\" and prints no price");
  ok(r3.info && r3.info.pages === 1, "a very long facility name still fits on one page");
  const pairs = [];
  if (r3.info) r3.info.lines.forEach((l, i) => r3.info.lines.forEach((m, j) => { if (j > i && Math.min(l.b[2], m.b[2]) - Math.max(l.b[0], m.b[0]) > 1 && Math.min(l.b[3], m.b[3]) - Math.max(l.b[1], m.b[1]) > 2.5) pairs.push(`"${l.t}" and "${m.t}"`); }));
  ok(r3.info && pairs.length === 0, "and nothing overlaps" + (pairs.length ? ": " + pairs.slice(0, 2).join("; ") : ""));

  /* every field at its longest */
  const r4 = await make({ facility: ("Greenfield Meadows Assisted Living and Memory Care Community of the Northern Plains ").repeat(2).slice(0, 120), contact: "Alexandria Montgomery-Livingstone, Director of Accounts Payable Services".padEnd(80, "x").slice(0, 80), email: ("very.long.address.for.accounts.payable.department" + "@" + "mail.".repeat(12) + "example.org").slice(0, 120), phone: "+1 (701) 555-0100 ext. 12345", street: "1234 North Example Boulevard, Building C, Suite 400, Attention Accounts Payable, Rear Entrance".slice(0, 100), city: "Minot Falls Township South".slice(0, 60), state: "ND", zip: "58701-1234", po: "PO-2026-000123-LONGREFERENCE-ABCDEFGHIJ", plan: "annual", qty: "99" }, "longest");
  ok(r4.info && r4.info.pages === 1, "every field at its longest still makes one page");
  const worst = r4.info ? r4.info.lines.reduce((m, l) => Math.max(m, l.b[3]), 0) : 999;
  ok(worst <= 792 - 30, `and the lowest line is inside the bottom margin (${worst.toFixed(0)} of 792 pt)`);
  const pairs4 = [];
  if (r4.info) r4.info.lines.forEach((l, i) => r4.info.lines.forEach((m, j) => { if (j > i && Math.min(l.b[2], m.b[2]) - Math.max(l.b[0], m.b[0]) > 1 && Math.min(l.b[3], m.b[3]) - Math.max(l.b[1], m.b[1]) > 2.5) pairs4.push(`"${l.t}" and "${m.t}"`); }));
  ok(pairs4.length === 0, "and nothing overlaps" + (pairs4.length ? ": " + pairs4.slice(0, 2).join("; ") : ""));
  ok(r4.info && r4.info.lines.every(l => l.b[0] >= 53 && l.b[2] <= 559), "and every line is inside the side margins");

  /* clear, vendor block, no requests */
  await p.click("#invClear");
  ok(await p.evaluate(() => localStorage.getItem("cognicopia_invoice_request")) === null && await p.inputValue("#inv-facility") === "", "\"Clear the form\" removes the kept answers");
  ok(norm(await p.textContent("#invVendor")) === norm(I.vendorBlock()), "the vendor block on the page is the one in the PDF");
  ok(outside.length === 0, "nothing was requested from outside the page" + (outside.length ? ": " + outside.slice(0, 3).join(", ") : ""));
  ok(posts.length === 0, "nothing was sent: no POST, PUT or other request that carries data" + (posts.length ? ": " + posts.join(", ") : ""));
  ok(errors.length === 0, "no script or console error" + (errors.length ? ": " + [...new Set(errors)].slice(0, 3).join("; ") : ""));
  await ctx.close();

  /* a phone */
  const c2 = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await c2.addInitScript(() => { try { localStorage.setItem("cognicopia_eula_accepted", "true"); } catch (x) { /* ignore */ } });
  const q = await c2.newPage(); await q.goto(base + "pricing.html#invoice"); await q.waitForSelector("#invForm");
  const ph = await q.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  ok(ph.sw <= ph.cw + 1, `on a phone the form does not scroll sideways (${ph.sw} of ${ph.cw} px)`);
  await c2.close();
} finally { await browser.close(); srv.close(); fs.rmSync(tmp, { recursive: true, force: true }); }

console.log(problems.length ? `invoice check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.join("\n  - ") : `invoice check passed: ${passed} checks (the form's rules, PO PENDING, totals from license.js, Net 30 and the owner's two sentences, the PDF read back from a real download, nothing sent anywhere)`);
process.exit(problems.length ? 1 : 0);
