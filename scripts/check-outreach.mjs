#!/usr/bin/env node
/* =====================================================================
   The outreach desk: the notes it sends and the rules it keeps. No network, nothing is sent.
   Run: node scripts/check-outreach.mjs   (also in npm test)

     the notes      four plain notes over 21 days, short, one link at most, each with the sender's postal address, an easy way to opt out
                    and an "advertisement" line; no hype, no claim the site does not make (no "HIPAA compliant", no unmeasured numbers,
                    no savings, no quizzing words); every link goes to a page that exists; prices match src/config/license.js
     the answers    the pre-approved replies obey the same rules
     the engine     refuses to plan without a real postal address; ramps up slowly; weekdays only; follow-ups on time and before new people;
                    never writes again to anyone who stopped, replied, bounced or complained; one contact per community per day;
                    a person at a community replying pauses the rest of it; bounces and complaints raise a warning
     the privacy    a lead is a business contact: no column for a resident; the sample list is made up; real contacts are not committed
   ===================================================================== */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv, toCsv, validateLead, newState, importLeads, applyEvent, suppress, isSuppressed, planDay, recordSent, report, renderMessage, gateProblems, batchHtml, dailyLimit, weekdayOf, LEAD_COLUMNS, PERSONAL_DOMAINS } from "./lib/outreach.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
const problems = []; let passed = 0;
const ok = (c, m) => { if (c) passed++; else problems.push(m); };

const seq = JSON.parse(read("outreach/sequences.json"));
const replies = JSON.parse(read("outreach/replies.json"));
const lic = read("src/config/license.js");
const PRICE_MONTHLY = (lic.match(/monthly:[^}]*?text:\s*"([^"]+)"/) || [])[1], PRICE_ANNUAL = (lic.match(/annual:[^}]*?text:\s*"([^"]+)"/) || [])[1];
ok(PRICE_MONTHLY === "$39 a month" && PRICE_ANNUAL === "$349 a year", `the prices are read from src/config/license.js (${PRICE_MONTHLY}, ${PRICE_ANNUAL})`);

const SPAM = /\b(act now|limited time|urgent|winner|cash|risk[- ]free|buy now|click here|100% free|no obligation|congratulations|exclusive deal|discount|order now|don't miss|last chance)\b|\$\$|!!|\bfree!!/i;
const CLAIMS = [
  [/HIPAA[- ]compliant|ensures? compliance|guarantee/i, "a compliance or guarantee claim"],
  [/\b\d+\s?%/, "a percentage"],
  [/\b(hours?|minutes?|seconds?)\b/i, "a time or saving that has not been measured"],
  [/\b(save|saves|saving|savings)\b/i, "a saving"],
  [/\b(patients?|elderly|dementia sufferers?|victims?)\b/i, "a word that talks down to the people being served"],
  [/do you remember|test your memory|quiz(?:zes)? your/i, "memory quizzing"],
  [/\b(revolutioniz|game[- ]chang|cutting[- ]edge|best[- ]in[- ]class|world[- ]class|synergy|AI-powered|leverage)\w*/i, "hype"],
  [/Kirk Barron|barron\.kirklin/i, "a personal name or address"]
];
const SAMPLE = { first_name: "Dana", facility: "Maple Court Memory Care", city: "Springfield" };
const CFG = { sender_name: "Alex Sample", sender_place: "Springfield, Illinois", reply_to: "Cognicopia@outlook.com", postal_address: "PO Box 100, Springfield, IL 62701", start_date: "2026-11-02", mailboxes: [{ id: "a", email: "a@sending.example" }, { id: "b", email: "b@sending.example" }] };
const words = t => (t.match(/[A-Za-z0-9'’$@.:/-]+/g) || []).length;
const linksOf = t => t.match(/https?:\/\/[^\s)]+/g) || [];
const exists = u => { const m = u.match(/^https:\/\/cognicopia\.org\/?(.*)$/); if (!m) return false; let p = m[1].replace(/[.,]$/, ""); if (p === "" || p.endsWith("/")) p += "index.html"; return fs.existsSync(path.join(ROOT, p)); };

/* ---------- the four notes ---------- */
ok(!/Minot|Kirk|Barron/i.test(JSON.stringify(seq) + JSON.stringify(replies)), "no personal name or town is in the shared copy: they are filled in from the private settings");
ok(seq.steps.length === 4, `four notes (${seq.steps.length})`);
ok(seq.steps[0].delayDays === 0 && seq.steps.reduce((n, s) => n + s.delayDays, 0) <= 21, "the first goes out at once and all four are done within 21 days");
ok(/\{\{postal_address\}\}/.test(seq.footer) && /\{\{unsubscribe_line\}\}/.test(seq.footer) && /advertisement/i.test(seq.footer), "the footer holds the postal address, the opt-out line and an 'advertisement' line");
ok(/reply/i.test(seq.unsubscribeLine) && /removed/i.test(seq.unsubscribeLine), "opting out is one reply and says so");
seq.steps.forEach((s, i) => {
  const msg = renderMessage(seq, i, { ...SAMPLE, email: "x@maplecourt.example" }, CFG), all = msg.subject + "\n" + msg.body, label = `note ${i + 1}`;
  ok(!/\{\{|\}\}/.test(all), `${label}: every merge field is filled`);
  ok(s.body.includes("{{footer}}"), `${label}: carries the footer`);
  ok(msg.body.includes(CFG.postal_address) && /advertisement/i.test(msg.body) && /no thanks/i.test(msg.body), `${label}: shows the postal address, the advertisement line and the way to opt out`);
  ok(/Cognicopia@outlook\.com/.test(msg.body), `${label}: says how to reach the owner (Cognicopia@outlook.com)`);
  const main = msg.body.split(CFG.postal_address)[0];
  ok(words(main) <= (i === 0 ? 190 : 130), `${label}: short (${words(main)} words before the footer)`);
  for (const sub of s.subjects) {
    const r = renderMessage({ ...seq, steps: [{ ...s, subjects: [sub] }] }, 0, { ...SAMPLE, facility: "The Residences at Maple Court Memory Care", email: "x@y.example" }, CFG).subject;
    ok(r.length <= 70 && !/^(re|fwd?):/i.test(r) && !/[A-Z]{5,}/.test(r.replace(/\b(CMS|HIPAA)\b/g, "")) && !/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(r) && !/!/.test(r), `${label}: the subject is plain and short ("${r}")`);
  }
  ok(!SPAM.test(all), `${label}: no spam-filter phrases`);
  for (const [re, why] of CLAIMS) ok(!re.test(all), `${label}: no ${why}`);
  const links = linksOf(msg.body);
  ok(i === 0 ? links.length === 0 : links.length <= 1, `${label}: ${i === 0 ? "no link in the first note" : "at most one link"} (${links.length})`);
  for (const u of links) ok(exists(u), `${label}: ${u} is a real page of the site`);
  ok(!/\$\d/.test(all) || (all.includes(PRICE_MONTHLY) || all.includes(PRICE_ANNUAL)), `${label}: any price matches the license config`);
  ok(/^[\x09\x0A\x0D\x20-\x7E]*$/.test(msg.body.replace(/’/g, "'")), `${label}: plain text, no pictures or special characters`);
});
ok(renderMessage(seq, 0, { ...SAMPLE, first_name: "", email: "x@y.example" }, CFG).body.startsWith("Hello there,"), "with no first name the note says 'Hello there'");
ok(renderMessage(seq, 0, { ...SAMPLE, email: "same@y.example" }, CFG).subject === renderMessage(seq, 0, { ...SAMPLE, email: "same@y.example" }, CFG).subject, "the same person always gets the same subject line");

/* ---------- the answers ---------- */
const auto = Object.entries(replies.categories).filter(([, c]) => c.auto && c.body);
ok(auto.length === 4, `four pre-approved answers (${auto.length})`);
for (const [k, c] of auto) {
  const body = c.body.replace("{{price_monthly}}", PRICE_MONTHLY).replace("{{price_annual}}", PRICE_ANNUAL).replace(/\{\{first_name\}\}/g, "Dana").replace(/\{\{sender_name\}\}/g, "Alex Sample");
  ok(!/\{\{|\}\}/.test(body + c.subject), `answer ${k}: every merge field is filled`);
  ok(!SPAM.test(body), `answer ${k}: no spam-filter phrases`);
  for (const [re, why] of CLAIMS) ok(!re.test(body), `answer ${k}: no ${why}`);
  for (const u of linksOf(body)) ok(exists(u), `answer ${k}: ${u} is a real page`);
  ok(!/\$\d/.test(c.body), `answer ${k}: no price typed by hand`);
  ok(/Cognicopia@outlook\.com/.test(body), `answer ${k}: signs with the business address`);
}
ok(replies.categories.unsubscribe.auto && !replies.categories.unsubscribe.body, "a stop request sends nothing back and removes the person");
ok(!replies.categories.other.auto && !replies.categories.wrong_person.auto, "anything unusual waits for the owner");
ok(/No resident information leaves the computer|no resident information leaves/i.test(replies.categories.asks_privacy.body) && /supports your community's own privacy practices/.test(replies.categories.asks_privacy.body), "the privacy answer says what is true and no more");

/* ---------- the engine ---------- */
const bad = gateProblems(JSON.parse(read("outreach/config.sample.json")));
ok(bad.length >= 3 && bad.some(p => /postal_address/.test(p)) && bad.some(p => /sender_name/.test(p)) && bad.some(p => /mailboxes/.test(p)), "the sample config is refused: no postal address, name or mailbox yet");
let refused = false; try { planDay(newState(), seq, JSON.parse(read("outreach/config.sample.json")), "2026-11-02"); } catch (e) { refused = /Not ready to send/.test(e.message); }
ok(refused, "nothing is planned until the gate is passed");
ok(gateProblems({ ...CFG, postal_address: "[your address]" }).length > 0 && gateProblems({ ...CFG, postal_address: "" }).length > 0, "a placeholder or empty postal address is refused");
ok(gateProblems(CFG).length === 0, "a complete config passes the gate");

const rows = parseCsv(read("outreach/leads.sample.csv"));
ok(rows.length === 3 && Object.keys(rows[0]).join(",") === LEAD_COLUMNS.join(","), "the sample list has the allowed columns and three made-up contacts");
ok(rows.every(r => /\.example$/.test(r.email.split("@")[1]) && /\.example/.test(r.source_url)), "every sample contact is made up (.example addresses only)");
ok(!LEAD_COLUMNS.some(c => /resident|patient|diagnos|birth|dob|room|medical|ssn/i.test(c)), "a lead has no column for a resident");
ok(/^outreach\/data\/$/m.test(read(".gitignore")), "real contacts and the send record are ignored by git");
const csvRound = parseCsv(toCsv([{ a: 'x, "y"', b: "line\nbreak" }], ["a", "b"]));
ok(csvRound[0].a === 'x, "y"' && csvRound[0].b === "line\nbreak", "the csv reader and writer agree on quotes, commas and line breaks");

ok(!validateLead({ ...rows[0], email: "someone@gmail.com" }).ok && /personal mailbox/.test(validateLead({ ...rows[0], email: "someone@gmail.com" }).problems.join()), "a personal mailbox is refused");
ok(!validateLead({ ...rows[0], source_url: "" }).ok && !validateLead({ ...rows[0], source: "" }).ok, "a contact with no source is refused (where was this address found?)");
ok(!validateLead({ ...rows[0], email: "not-an-email" }).ok && !validateLead({ ...rows[0], state: "Illinois" }).ok && !validateLead({ ...rows[0], facility: "" }).ok, "a bad address, state or community name is refused");
ok(PERSONAL_DOMAINS.has("outlook.com") && PERSONAL_DOMAINS.has("gmail.com"), "the personal-mailbox list covers the common ones");

/* a thousand-contact style run, in miniature: 60 communities */
const state = newState();
const many = Array.from({ length: 60 }, (_, i) => ({ ...rows[0], email: `activities@home${i}.example`, facility: `Home ${i}`, source_url: `https://home${i}.example/contact` }));
const imp = importLeads(state, [...many, many[0], { ...rows[0], email: "x@gmail.com" }], "2026-10-23");
ok(imp.added.length === 60 && imp.rejected.length === 2, `60 added, a repeat and a personal mailbox turned away (${imp.added.length} added, ${imp.rejected.length} refused)`);
ok(dailyLimit(CFG, "2026-11-02") === 20 && dailyLimit(CFG, "2026-11-09") === 40 && dailyLimit(CFG, "2026-11-16") === 60 && dailyLimit(CFG, "2026-11-23") === 80 && dailyLimit(CFG, "2027-02-01") === 80, "the daily limit ramps 20, 40, 60, 80 with two mailboxes and then holds");
ok(dailyLimit(CFG, "2026-10-26") === 0, "nothing goes before the start date");
ok(weekdayOf("2026-11-02") === 1 && planDay(state, seq, CFG, "2026-11-07").items.length === 0 && planDay(state, seq, CFG, "2026-11-08").items.length === 0 && planDay(state, seq, CFG, "2026-11-06").items.length === 0, "Monday to Thursday only: Friday, Saturday and Sunday send nothing");
const d1 = planDay(state, seq, CFG, "2026-11-02");
ok(d1.items.length === 20, `the first Monday sends exactly the limit (${d1.items.length})`);
ok(new Set(d1.items.map(i => i.mailbox)).size === 2 && d1.items[0].mailbox !== d1.items[1].mailbox, "messages alternate between the sending addresses");
ok(d1.items.every(i => i.step === 1 && i.reply_to === "Cognicopia@outlook.com"), "the first day is all first notes, with replies going to the business address");
ok(planDay(state, seq, CFG, "2026-11-02").items.map(i => i.email).join() === d1.items.map(i => i.email).join(), "planning twice gives the same batch (nothing is written until it is recorded)");
recordSent(state, d1.items, "2026-11-02");
ok(planDay(state, seq, CFG, "2026-11-02").items.every(i => !d1.items.some(x => x.email === i.email)), "someone already written to today is not written to again today");
const d4 = planDay(state, seq, CFG, "2026-11-05");
ok(d4.items.every(i => i.step === 1), "three days later the follow-ups are not due yet (the second note waits four days)");
const d9 = planDay(state, seq, CFG, "2026-11-09");
ok(d9.items.length === 40 && d9.items.slice(0, 20).every(i => i.step === 2) && d9.items.slice(20).every(i => i.step === 1), "the next Monday: the 20 follow-ups come first, then new people up to the limit");
recordSent(state, d9.items, "2026-11-09");

/* people who stop are never written to again */
const target = d9.items[0].email;
applyEvent(state, target, "unsubscribed", "2026-11-10");
ok(isSuppressed(state, target) && state.leads[target].status === "unsubscribed", "an opt-out is remembered at once");
const later = planDay(state, seq, CFG, "2026-11-16");
ok(!later.items.some(i => i.email === target), "and that person is never in a later batch");
ok(importLeads(state, [{ ...rows[0], email: target, facility: "Back again", source_url: "https://x.example/y" }], "2026-11-16").rejected[0].why === "already on the list", "adding the same address again changes nothing");
const s2 = newState(); suppress(s2, target); ok(importLeads(s2, [{ ...rows[0], email: target, source_url: "https://x.example/y" }], "2026-11-16").rejected[0].why === "on the do-not-contact list", "an address on the do-not-contact list cannot be imported");
const s3 = newState(); importLeads(s3, [{ ...rows[0], email: "a@twin.example" }, { ...rows[0], email: "b@twin.example" }, { ...rows[0], email: "c@other.example" }], "2026-10-23");
ok(planDay(s3, seq, CFG, "2026-11-02").items.filter(i => i.email.endsWith("@twin.example")).length === 1, "one contact per community per day");
applyEvent(s3, "a@twin.example", "replied", "2026-11-03");
ok(!planDay(s3, seq, CFG, "2026-11-16").items.some(i => i.email.endsWith("@twin.example")) && planDay(s3, seq, CFG, "2026-11-16").items.some(i => i.email === "c@other.example"), "when one person at a community replies, the rest of that community is left alone");
const s4 = newState(); importLeads(s4, [{ ...rows[0], email: "p@pause.example" }, { ...rows[0], email: "q@pause.example" }], "2026-10-23"); suppress(s4, "@pause.example");
ok(planDay(s4, seq, CFG, "2026-11-02").items.length === 0, "a whole community can be put on the do-not-contact list");
const s5 = newState(); importLeads(s5, [{ ...rows[0], email: "z@long.example" }], "2026-10-23");
for (const [day, n] of [["2026-11-02", 1], ["2026-11-09", 2], ["2026-11-16", 3], ["2026-11-30", 4]]) { const p = planDay(s5, seq, CFG, day); ok(p.items.length === 1 && p.items[0].step === n, `a person gets note ${n} on ${day}`); recordSent(s5, p.items, day); }
ok(planDay(s5, seq, CFG, "2027-03-01").items.length === 0, "after the fourth note nothing more is ever sent");
const s6 = newState(); importLeads(s6, [{ ...rows[0], email: "r@reply.example" }], "2026-10-23"); recordSent(s6, planDay(s6, seq, CFG, "2026-11-02").items, "2026-11-02"); applyEvent(s6, "r@reply.example", "replied", "2026-11-03");
ok(planDay(s6, seq, CFG, "2026-11-09").items.length === 0, "a reply stops the notes");
const s7 = newState(); importLeads(s7, [{ ...rows[0], email: "c@cust.example" }], "2026-10-23"); applyEvent(s7, "c@cust.example", "customer", "2026-11-03");
ok(planDay(s7, seq, CFG, "2026-11-09").items.length === 0, "a customer is never sent the introduction");
let threw = false; try { applyEvent(newState(), "a@b.example", "purchased", "2026-11-03"); } catch (e) { threw = true; } ok(threw, "an unknown event is refused, not guessed at");

/* the warning lights */
const s8 = newState(); s8.sentTotal = 200; for (let i = 0; i < 10; i++) s8.leads["b" + i + "@x.example"] = { status: "bounced", step: 1 };
ok(report(s8, seq).warnings.some(w => /Bounces/.test(w)), "5% bounces raises a warning to stop and clean the list");
const s9 = newState(); s9.sentTotal = 200; s9.leads["c@x.example"] = { status: "complaint", step: 1 }; s9.leads["d@x.example"] = { status: "complaint", step: 1 };
ok(report(s9, seq).warnings.some(w => /complaints/.test(w)), "spam complaints raise a warning");
ok(report(newState(), seq).warnings.length === 0, "a quiet start raises none");

/* the page for sending a small batch by hand */
const pg = batchHtml([{ email: "a@maple.example", facility: "Maple <Court> & Sons", mailbox: "Cognicopia@outlook.com", step: 1, subject: 'Activity "packets"', body: "Hello Dana,\n\nLine two & <b>bold</b>" }], "2026-11-16", { mailboxes: [{ email: "Cognicopia@outlook.com" }] });
ok(/mailto:a@maple\.example\?subject=Activity%20%22packets%22/.test(pg) && /Copy the subject/.test(pg) && /Copy the message/.test(pg), "the by-hand page has a copy button for the subject, one for the message, and a link that opens an addressed email");
ok(!/Maple <Court>/.test(pg) && /Maple &lt;Court&gt; &amp; Sons/.test(pg) && !/<b>bold<\/b>/.test(pg), "what is written on the page is escaped, so a community's name cannot break it");
ok(!/\bfetch\(|XMLHttpRequest|<script[^>]*\ssrc=|<link[^>]*href=|<img|@import|url\(/i.test(pg), "the page loads nothing from anywhere (no network, no outside file)");
ok(/Please send no more than 1 today/.test(pg) && batchHtml([], "2026-11-16", {}).includes("Nothing is due today"), "it says how many to send, and says so when nothing is due");

/* the docs and the helper exist */
ok(fs.existsSync(path.join(ROOT, "docs/marketing-strategy.md")) && fs.existsSync(path.join(ROOT, "docs/outreach-desk.md")) && fs.existsSync(path.join(ROOT, ".claude/agents/outreach.md")), "the strategy, the desk guide and the reply helper are written");
const strat = fs.existsSync(path.join(ROOT, "docs/marketing-strategy.md")) ? read("docs/marketing-strategy.md") : "";
ok(!/\{\{|\{%/.test(strat + read("docs/outreach-desk.md")), "the guides hold no Liquid openers (GitHub Pages would break on them)");
ok(!/HIPAA[- ]compliant/i.test(strat), "the strategy never calls the product HIPAA compliant");

if (problems.length) { console.error(`outreach check FAILED: ${problems.length} problem(s), ${passed} passed`); for (const p of problems) console.error("  - " + p); process.exit(1); }
console.log(`outreach check passed: ${passed} checks (four plain notes with the postal address and an easy opt-out, answers that say only what is true, a ramp-up that starts at ${dailyLimit(CFG, "2026-11-02")} a day, nobody written to twice or after stopping, nothing sent)`);
