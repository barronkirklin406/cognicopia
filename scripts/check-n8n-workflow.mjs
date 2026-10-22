#!/usr/bin/env node
/* =====================================================================
   The n8n workflow (n8n-cognicopia-operations.json): proved with no n8n and no network.

     shape     valid JSON; every node has an id, a unique name, a type, a typeVersion, a position and parameters; every connection
               names nodes that exist; only standard n8n node types are used (no made-up package name such as googleAi)
     safety    nothing reaches a customer or an accounts payable contact except through a "Send and wait" approval sent to the owner and
               an IF node on its answer; the owner's approval emails go only to the owner; no key, token or password is in the file (credentials
               are named placeholders); nothing signs, makes or mentions a license key; nothing calls Stripe
     code      each Code node is run here with stand-in data: a support email becomes a question with the approved facts, a draft that makes a
               forbidden claim is flagged, an email from ourselves or a robot is skipped, an invoice becomes reminders on Day 15, 25 and 30 with
               the right dates, and a bad form is refused
     facts     the approved facts say what the Terms page says, never say "HIPAA compliant" except as a thing not to say, quote no price
   ===================================================================== */
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILE = path.join(ROOT, "n8n-cognicopia-operations.json");
let passed = 0; const problems = [];
const ok = (c, m) => { if (c) passed++; else problems.push(m); };

const raw = fs.readFileSync(FILE, "utf8");
let wf; try { wf = JSON.parse(raw); } catch (e) { console.log("n8n workflow check FAILED: not valid JSON: " + e.message); process.exit(1); }

/* ---------- shape ---------- */
const TYPES = new Set(["n8n-nodes-base.emailReadImap", "n8n-nodes-base.code", "n8n-nodes-base.httpRequest", "n8n-nodes-base.emailSend", "n8n-nodes-base.if",
  "n8n-nodes-base.noOp", "n8n-nodes-base.stickyNote", "n8n-nodes-base.formTrigger", "n8n-nodes-base.wait", "n8n-nodes-base.webhook", "n8n-nodes-base.set"]);
ok(typeof wf.name === "string" && Array.isArray(wf.nodes) && wf.nodes.length >= 10 && wf.connections && typeof wf.connections === "object", "the file has a name, nodes and connections");
ok(wf.active === false, "the workflow is saved turned off: it is switched on in n8n after the credentials are set");
const names = wf.nodes.map(n => n.name);
ok(new Set(names).size === names.length, "node names are unique");
ok(new Set(wf.nodes.map(n => n.id)).size === wf.nodes.length, "node ids are unique");
wf.nodes.forEach(n => {
  ok(n.id && n.name && n.type && typeof n.typeVersion === "number" && Array.isArray(n.position) && n.position.length === 2 && n.parameters && typeof n.parameters === "object", `node "${n.name}" has an id, name, type, typeVersion, position and parameters`);
  ok(TYPES.has(n.type), `node "${n.name}" uses a standard n8n node type (${n.type})`);
});
ok(!/googleAi/i.test(raw), "no made-up node type \"googleAi\"");
for (const [from, v] of Object.entries(wf.connections)) {
  ok(names.includes(from), `connection source "${from}" is a node`);
  (v.main || []).forEach(outs => (outs || []).forEach(c => ok(names.includes(c.node), `"${from}" connects to "${c.node}", which exists`)));
}
const byName = Object.fromEntries(wf.nodes.map(n => [n.name, n]));
const into = {}; for (const [from, v] of Object.entries(wf.connections)) (v.main || []).forEach((outs, i) => (outs || []).forEach(c => { (into[c.node] = into[c.node] || []).push({ from, out: i }); }));
const triggers = wf.nodes.filter(n => /Trigger$|emailReadImap$|webhook$/.test(n.type));
ok(triggers.length === 2 && triggers.some(n => n.type.endsWith("emailReadImap")) && triggers.some(n => n.type.endsWith("formTrigger")), "two triggers: the support mailbox and the invoice form");
ok(wf.nodes.some(n => n.type.endsWith("httpRequest") && /generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-2\.5-flash:generateContent/.test(n.parameters.url || "")), "the AI step is a Gemini 2.5 Flash call by HTTP request");

/* ---------- safety ---------- */
const OWNER = (/const OWNER_EMAIL = "([^"]+)"/.exec(raw.replace(/\\"/g, '"')) || [])[1];
const emailSends = wf.nodes.filter(n => n.type.endsWith("emailSend"));
const waits = emailSends.filter(n => n.parameters.operation === "sendAndWait");
const plain = emailSends.filter(n => n.parameters.operation !== "sendAndWait");
ok(waits.length === 2 && plain.length === 2, "two approval emails (to the owner) and two sends (to customers)");
waits.forEach(n => ok(/ownerEmail/.test(n.parameters.toEmail) && n.parameters.responseType === "approval" && n.parameters.approvalOptions && n.parameters.approvalOptions.values.approvalType === "double", `"${n.name}" goes only to the owner and offers Send and Do not send`));
plain.forEach(n => {
  const ins = into[n.name] || [];
  ok(ins.length === 1 && ins[0].out === 0 && byName[ins[0].from].type.endsWith(".if"), `"${n.name}" is reached only from the "yes" side of an IF`);
  const gate = byName[ins[0] && ins[0].from]; const gins = (gate && into[gate.name]) || [];
  ok(gins.length === 1 && byName[gins[0].from].parameters.operation === "sendAndWait", `and that IF is fed only by an owner approval ("${gins[0] && gins[0].from}")`);
  ok(/data\.approved/.test(JSON.stringify(gate.parameters)), `and that IF tests the owner's answer (data.approved)`);
});
ok(!/api\.stripe\.com|COG1\.|createSign|subtle\.sign|signLicense|PRIVATE KEY|license-service\/(functions|src)/i.test(raw) && !wf.nodes.some(n => /stripe/i.test(n.type)), "nothing here signs a key, makes a license or calls Stripe (the one mention is the note that license-service does it)");
ok(!/AIza[0-9A-Za-z_-]{20,}|\bre_[0-9A-Za-z]{16,}|whsec_|sk_(live|test)_|-----BEGIN|Bearer [A-Za-z0-9._-]{20,}/.test(raw), "no key, token, secret or password is written in the file");
const creds = wf.nodes.filter(n => n.credentials);
creds.forEach(n => Object.values(n.credentials).forEach(c => ok(c.id === "SET_IN_N8N" && !("data" in c), `"${n.name}" names its credential and holds no secret`)));
ok(creds.length >= 5, "the credentials (support mailbox, Google AI Studio key, Resend SMTP) are named placeholders");
ok(OWNER && /@/.test(OWNER) && !/\d{9}/.test(OWNER), `the owner's address is set in one place (${OWNER})`);

/* ---------- the code nodes, run with stand-in data ---------- */
const store = {};
const run = (name, json, { all, items } = {}) => {
  const n = byName[name]; const sandbox = {
    $json: json, $input: { all: () => items || [{ json }] }, $: nm => ({ item: { json: store[nm] }, first: () => ({ json: store[nm] }) }),
    Date, JSON, Math, String, Number, Array, Object, RegExp, Error, Promise, console
  };
  const fn = vm.runInNewContext("(function(){\n" + n.parameters.jsCode + "\n})", sandbox);
  return fn();
};
const P = "Prepare the question and the approved facts";
const mail = (from, text, subject = "Printing question") => ({ from: { value: [{ address: from }] }, subject, textPlain: text });
const out1 = run(P, null, { items: [{ json: mail("Pat <pat@maplegrove.example>", "How do I print the packets with no internet?") }] });
ok(out1.length === 1 && out1[0].json.customerEmail === "pat@maplegrove.example" && out1[0].json.ownerEmail === OWNER, "a support email becomes a question for the owner's approval flow");
const g = out1[0].json.geminiBody;
ok(g.systemInstruction.parts[0].text.length > 800 && g.generationConfig.responseMimeType === "application/json" && g.contents[0].parts[0].text.includes("How do I print"), "the AI request carries the approved facts, asks for JSON and holds the question");
ok(run(P, null, { items: [{ json: mail(OWNER, "hello") }, { json: mail("noreply@service.example", "hello") }, { json: mail("mailer-daemon@x.example", "bounced") }, { json: mail("a@b.example", "") }] }).length === 0, "mail from ourselves, a robot or with no text is skipped");
const sys = g.systemInstruction.parts[0].text;
ok(/not a medical device under FDA regulations/.test(sys) && /does not provide medical diagnoses, clinical treatment, physical health evaluation, or medical advice/.test(sys), "the approved facts carry the Terms page's wording");
ok(!/\bis HIPAA compliant\b/i.test(sys.replace(/Never say Cognicopia is HIPAA compliant[^.]*\./, "")) && /Never say Cognicopia is HIPAA compliant/.test(sys) && /supports a facility's own HIPAA privacy practices/.test(sys), "the facts say \"supports\" and forbid \"HIPAA compliant\"");
ok(!/\$\s?\d/.test(sys) && /never quote a price/i.test(sys), "no price is written in the facts");
ok(/No resident data leaves the device/.test(sys) && /Printing works with no internet/.test(sys) && /25 packets are free/.test(sys), "the facts cover zero-cloud, offline printing and the free packets");
store[P] = out1[0].json;
const model = r => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(r) }] } }] });
const C = "Check the draft";
const good = run(C, model({ reply: "Hello Pat, the tools make the PDF on your computer, so printing works with no internet. Print at 100%. Cognicopia support", confidence: "high", topics: ["printing"], contains_resident_info: false, reason_for_human: "" }));
ok(good.json.needsYou === false && good.json.finalReply.startsWith("Hello Pat") && /Nothing has been sent/.test(good.json.ownerMessage), "a clean, confident draft passes the automatic checks and says nothing has been sent");
for (const [reply, why] of [["Cognicopia is HIPAA compliant.", "HIPAA compliant"], ["It is FDA approved.", "FDA approval"], ["It costs $349 a year.", "a price"], ["We guarantee results.", "a promise"], ["It improves memory.", "a medical claim"], ["We can offer a refund.", "a refund"]]) {
  const r = run(C, model({ reply, confidence: "high", topics: [], contains_resident_info: false, reason_for_human: "" }));
  ok(r.json.needsYou === true && r.json.ownerSubject.startsWith("[Read carefully]"), `a draft that mentions ${why} is flagged for careful reading`);
}
const low = run(C, model({ reply: "The owner will follow up.", confidence: "low", topics: [], contains_resident_info: false, reason_for_human: "Not in the facts" }));
ok(low.json.needsYou && /not highly confident/.test(low.json.flags.join(" ")), "a low-confidence draft is flagged");
ok(run(C, model({ reply: "ok", confidence: "high", topics: [], contains_resident_info: true, reason_for_human: "" })).json.flags.some(f => /resident information/.test(f)), "a message that holds resident information is flagged");
ok(run(C, { candidates: [] }).json.needsYou === true && run(C, { candidates: [{ content: { parts: [{ text: "not json" }] } }] }).json.finalReply === "", "an empty or broken AI answer is flagged and sends no text");
const esc = run(C, model({ reply: "<script>alert(1)</script>", confidence: "high", topics: [], contains_resident_info: false, reason_for_human: "" }));
ok(!/<script>/.test(esc.json.ownerMessage), "the owner's email shows a draft's markup as plain text");

const D = "Work out the three dates";
const form = (o) => Object.assign({ "Facility name": "Maple Grove", "Accounts payable contact email": "ap@maplegrove.example", "Billing contact name": "Pat", "Invoice reference": "CGR-20990101-1234", "Invoice date": "2099-01-01", "PO number": "", "Amount due": "$349.00" }, o);
const d = run(D, form({}));
ok(d.length === 3 && d.map(x => x.json.stage).join() === "15,25,30", "an invoice becomes three reminders: Day 15, Day 25 and Day 30");
ok(d.map(x => x.json.sendAt).join() === "2099-01-16T14:00:00.000Z,2099-01-26T14:00:00.000Z,2099-01-31T14:00:00.000Z", `at 9 in the morning, North Dakota time, on those dates (${d.map(x => x.json.sendAt.slice(0, 10)).join(", ")})`);
ok(d[0].json.dueDate === "January 31, 2099" && d[0].json.po === "PO PENDING", "the due date is 30 days on and an empty PO number says \"PO PENDING\"");
const past = run(D, form({ "Invoice date": "2020-01-01" }));
ok(past.every(x => new Date(x.json.sendAt).getTime() > Date.now()), "an invoice dated in the past is drafted for review at once, never sent");
for (const bad of [{ "Accounts payable contact email": "nope" }, { "Facility name": "" }, { "Invoice reference": "" }, { "Invoice date": "01/01/2099" }]) {
  let threw = false; try { run(D, form(bad)); } catch (e) { threw = true; }
  ok(threw, `a form with ${Object.keys(bad)[0].toLowerCase()} wrong is refused`);
}
const R = "Draft the reminder";
for (const item of d) {
  const r = run(R, item.json).json; const t = r.reminderText;
  ok(t.includes("CGR-20990101-1234") && t.includes("PO PENDING") && t.includes("BarronCrafts") && t.includes("Minot, ND 58701") && t.includes("January 31, 2099"), `the Day ${item.json.stage} reminder names the invoice, the PO, the vendor, the place and the due date`);
  ok(/If (payment|a payment|it is already)/.test(t) && /(thank)/i.test(t), `the Day ${item.json.stage} reminder is polite and thanks them if it is paid`);
  ok(!/\b(overdue|late fee|penalt|collection|legal action|final notice|immediately)\b/i.test(t), `the Day ${item.json.stage} reminder uses no threatening words`);
  ok(!/routing|account number|IBAN|SWIFT/i.test(t) && /bank details that came with the final invoice/.test(t), `the Day ${item.json.stage} reminder prints no bank detail`);
  ok(/If this invoice is already paid, choose not to send/.test(r.ownerMessage), `the owner's Day ${item.json.stage} approval email says to decline if it is paid`);
}

console.log(problems.length ? `n8n workflow check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.join("\n  - ") : `n8n workflow check passed: ${passed} checks (valid shape and node types, every customer send gated by an owner approval, no secrets, the code nodes run on stand-in data)`);
process.exit(problems.length ? 1 : 0);
