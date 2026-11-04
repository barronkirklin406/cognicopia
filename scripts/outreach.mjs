#!/usr/bin/env node
/* =====================================================================
   The outreach desk, from the command line. Nothing here sends an email: it prepares each day's batch for the sending tool,
   and keeps the record of who was written to and who must never be written to again. Real contacts stay in outreach/data/
   (not committed). docs/outreach-desk.md explains it step by step.

     node scripts/outreach.mjs init                         make outreach/data/ with a config to fill in
     node scripts/outreach.mjs import leads.csv             add public business contacts (checks every row, says why one is refused)
     node scripts/outreach.mjs plan [--date 2026-11-03]     today's batch -> outreach/data/batch-DATE.csv, .json and .html (the .html is a page to send them by hand: open it in a browser)
     node scripts/outreach.mjs plan --record                the same, and write it down as sent (only after the sending tool has sent it)
     node scripts/outreach.mjs sent batch-DATE.json         write a batch down as sent
     node scripts/outreach.mjs event someone@x.org replied  replied | unsubscribed | bounced | complaint | customer
     node scripts/outreach.mjs events export.csv            a sending tool's export with email,event columns
     node scripts/outreach.mjs suppress @example.org        never write to this address or this whole domain again
     node scripts/outreach.mjs copy                         the four notes as text with merge tags, to paste into a sending tool
     node scripts/outreach.mjs report                       where things stand, and any warning
   ===================================================================== */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv, toCsv, newState, importLeads, applyEvent, suppress, planDay, recordSent, report, batchHtml, LEAD_COLUMNS, EVENTS } from "./lib/outreach.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "outreach", "data");
const seq = JSON.parse(fs.readFileSync(path.join(ROOT, "outreach", "sequences.json"), "utf8"));
const args = process.argv.slice(2), cmd = args[0];
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const today = flag("--date") || new Date().toISOString().slice(0, 10);
const statePath = path.join(DATA, "state.json"), configPath = path.join(DATA, "config.json");
const loadState = () => fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, "utf8")) : newState();
const saveState = (s) => { fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(statePath, JSON.stringify(s, null, 1)); };
const loadConfig = () => { if (!fs.existsSync(configPath)) { console.error("There is no outreach/data/config.json yet. Run: node scripts/outreach.mjs init"); process.exit(1); } return JSON.parse(fs.readFileSync(configPath, "utf8")); };
const BATCH_COLUMNS = ["email", "first_name", "facility", "mailbox", "reply_to", "step", "variant", "subject", "body"];

if (cmd === "init") {
  fs.mkdirSync(DATA, { recursive: true });
  if (!fs.existsSync(configPath)) fs.copyFileSync(path.join(ROOT, "outreach", "config.sample.json"), configPath);
  const leads = path.join(DATA, "leads.csv");
  if (!fs.existsSync(leads)) fs.writeFileSync(leads, LEAD_COLUMNS.join(",") + "\n");
  console.log("Made outreach/data/ (it is not committed). Fill in outreach/data/config.json, then add contacts to outreach/data/leads.csv.");
} else if (cmd === "import") {
  const file = args[1]; if (!file) { console.error("Say which file: node scripts/outreach.mjs import leads.csv"); process.exit(1); }
  const state = loadState(), res = importLeads(state, parseCsv(fs.readFileSync(file, "utf8")), today);
  saveState(state);
  console.log(`Added ${res.added.length}. Turned away ${res.rejected.length}.`);
  for (const r of res.rejected.slice(0, 25)) console.log(`  line ${r.line} ${r.email}: ${r.why}`);
  if (res.rejected.length) { fs.writeFileSync(path.join(DATA, `rejected-${today}.csv`), toCsv(res.rejected, ["line", "email", "why"])); console.log(`  (all of them are in outreach/data/rejected-${today}.csv)`); }
} else if (cmd === "plan") {
  const state = loadState();
  let plan; try { plan = planDay(state, seq, loadConfig(), today); } catch (e) { console.error(e.message); process.exit(1); }
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(path.join(DATA, `batch-${today}.json`), JSON.stringify(plan.items, null, 1));
  fs.writeFileSync(path.join(DATA, `batch-${today}.csv`), toCsv(plan.items, BATCH_COLUMNS));
  fs.writeFileSync(path.join(DATA, `batch-${today}.html`), batchHtml(plan.items, today, loadConfig()));
  console.log(`${today}: ${plan.items.length} messages (today's limit is ${plan.limit}). ${plan.note}`);
  if (args.includes("--record")) { recordSent(state, plan.items, today); saveState(state); console.log("Written down as sent."); }
  else console.log("Preview only. After the sending tool has sent them, run:  node scripts/outreach.mjs sent outreach/data/batch-" + today + ".json");
} else if (cmd === "sent") {
  const items = JSON.parse(fs.readFileSync(args[1], "utf8")), state = loadState(); recordSent(state, items, today); saveState(state);
  console.log(`Wrote down ${items.length} messages as sent on ${today}.`);
} else if (cmd === "event") {
  const [, email, ev] = args; if (!email || !EVENTS.includes(ev)) { console.error("Use: event someone@x.org " + EVENTS.join(" | ")); process.exit(1); }
  const state = loadState(); applyEvent(state, email, ev, today); saveState(state); console.log(`${email}: ${ev}`);
} else if (cmd === "events") {
  const state = loadState(); let n = 0;
  for (const r of parseCsv(fs.readFileSync(args[1], "utf8"))) { const ev = String(r.event || "").toLowerCase().replace("unsubscribe", "unsubscribed").replace("bounce", "bounced").replace("reply", "replied"); if (r.email && EVENTS.includes(ev)) { applyEvent(state, r.email, ev, today); n++; } }
  saveState(state); console.log(`Applied ${n} events.`);
} else if (cmd === "suppress") {
  const state = loadState(); suppress(state, args[1]); saveState(state); console.log("Will never be written to again: " + args[1]);
} else if (cmd === "copy") {
  const cfg = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, "utf8")) : {};
  const lines = [];
  seq.steps.forEach((s, i) => {
    lines.push(`=== Note ${i + 1} (send ${s.delayDays === 0 ? "first" : s.delayDays + " days after the one before"}) ===`);
    s.subjects.forEach((sub, k) => lines.push(`Subject ${"AB"[k]}: ${sub}`));
    lines.push("", s.body.replace("{{footer}}", seq.footer).replace(/\{\{postal_address\}\}/g, cfg.postal_address || "{{postal_address}}").replace(/\{\{unsubscribe_line\}\}/g, seq.unsubscribeLine).replace(/\{\{sender_name\}\}/g, cfg.sender_name || "{{sender_name}}"), "");
  });
  fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(path.join(DATA, "sequence-copy.txt"), lines.join("\n"));
  console.log("Wrote outreach/data/sequence-copy.txt. Merge tags for the sending tool: {{first_name}} {{facility}} {{city}}.");
} else if (cmd === "report") {
  const r = report(loadState(), seq);
  console.log(`Contacts: ${r.leads}   still to write: ${r.stillToWrite}   sent so far: ${r.sent}`);
  console.log("By status:", JSON.stringify(r.byStatus));
  console.log(`Replies ${r.replyRate}   unsubscribes ${r.unsubscribeRate}   bounces ${r.bounceRate}   spam complaints ${r.complaintRate}`);
  for (const w of r.warnings) console.log("WARNING: " + w);
} else {
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0].replace("/* =====================================================================\n", ""));
}
