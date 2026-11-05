/* =====================================================================
   The outreach desk's engine: no network, no dependencies, nothing here sends an email.

   It turns a list of public business contacts (senior living Activity Directors) into each day's small batch of
   messages for a sending tool, and keeps the record that makes the whole thing safe:
     - who has been written to and how far along the four-note sequence they are,
     - who must never be written to again (asked to stop, replied, bounced, complained),
     - how many may go out today (a slow ramp-up, so the new sending address earns a good name),
     - a gate that refuses to plan anything until the sender's real postal address is filled in (the U.S. CAN-SPAM rules).

   Real contacts live in outreach/data/ (ignored by git: the repository is public). Nothing about a resident is ever
   stored here: a lead is a business contact and the community it belongs to.
   Used by scripts/outreach.mjs; proved by scripts/check-outreach.mjs.
   ===================================================================== */

/* personal mailboxes are skipped: this is a message to a business, at its business address */
export const PERSONAL_DOMAINS = new Set(["gmail.com", "googlemail.com", "yahoo.com", "ymail.com", "outlook.com", "hotmail.com", "live.com", "msn.com", "aol.com", "icloud.com", "me.com", "comcast.net", "att.net", "verizon.net", "proton.me", "protonmail.com"]);

/* the only columns a lead may have. There is no place for a resident here. */
export const LEAD_COLUMNS = ["email", "first_name", "role", "facility", "city", "state", "source", "source_url", "added"];

export const EVENTS = ["replied", "unsubscribed", "bounced", "complaint", "customer"];

/* ---------- csv (quotes, commas, and line breaks inside quotes) ---------- */
export function parseCsv(text) {
  const rows = []; let row = [], cell = "", q = false;
  const s = String(text).replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && s[i + 1] === "\n") i++; row.push(cell); cell = ""; if (row.some(x => x.trim() !== "")) rows.push(row); row = []; }
    else cell += c;
  }
  row.push(cell); if (row.some(x => x.trim() !== "")) rows.push(row);
  if (!rows.length) return [];
  const head = rows[0].map(h => h.trim().toLowerCase());
  return rows.slice(1).map(r => Object.fromEntries(head.map((h, i) => [h, (r[i] || "").trim()])));
}
export function toCsv(rows, columns) {
  const esc = v => { v = v == null ? "" : String(v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  return [columns.join(","), ...rows.map(r => columns.map(c => esc(r[c])).join(","))].join("\n") + "\n";
}

/* ---------- leads ---------- */
const EMAIL = /^[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+\.)+[A-Za-z]{2,}$/;
export function domainOf(email) { return String(email).toLowerCase().split("@")[1] || ""; }

export function validateLead(row) {
  const problems = [], email = String(row.email || "").trim().toLowerCase();
  if (!EMAIL.test(email)) problems.push("the email address is not valid");
  else if (PERSONAL_DOMAINS.has(domainOf(email))) problems.push("a personal mailbox (" + domainOf(email) + "): use the community's own address");
  if (!String(row.facility || "").trim()) problems.push("no community name");
  if (!/^[A-Za-z]{2}$/.test(String(row.state || "").trim())) problems.push("the state needs its two letters");
  if (!String(row.source || "").trim()) problems.push("no source: say where this address was found");
  if (!/^https?:\/\//i.test(String(row.source_url || "").trim())) problems.push("no source_url: the public page where this address was found");
  const lead = {
    email, first_name: String(row.first_name || "").trim(), role: String(row.role || "").trim(), facility: String(row.facility || "").trim(),
    city: String(row.city || "").trim(), state: String(row.state || "").trim().toUpperCase(), source: String(row.source || "").trim(),
    source_url: String(row.source_url || "").trim(), added: String(row.added || "").trim()
  };
  return { ok: problems.length === 0, problems, lead };
}

export function newState() { return { leads: {}, suppressed: [], pausedDomains: [], sentTotal: 0 }; }

export function isSuppressed(state, email) {
  const e = String(email).toLowerCase(), d = domainOf(e);
  return state.suppressed.includes(e) || state.suppressed.includes("@" + d);
}

/* add the good rows, say why the others were turned away; a repeat address or a suppressed one is never added twice */
export function importLeads(state, rows, today) {
  const added = [], rejected = [];
  rows.forEach((row, i) => {
    const v = validateLead(row);
    if (!v.ok) { rejected.push({ line: i + 2, email: v.lead.email, why: v.problems.join("; ") }); return; }
    if (state.leads[v.lead.email]) { rejected.push({ line: i + 2, email: v.lead.email, why: "already on the list" }); return; }
    if (isSuppressed(state, v.lead.email)) { rejected.push({ line: i + 2, email: v.lead.email, why: "on the do-not-contact list" }); return; }
    state.leads[v.lead.email] = { ...v.lead, added: v.lead.added || today, status: "active", step: 0, lastSent: null, history: [] };
    added.push(v.lead.email);
  });
  return { added, rejected };
}

/* ---------- events from the sending tool or from a reply ---------- */
export function applyEvent(state, email, event, today) {
  const e = String(email).trim().toLowerCase();
  if (!EVENTS.includes(event)) throw new Error("unknown event: " + event);
  const lead = state.leads[e];
  if (event === "unsubscribed" || event === "complaint" || event === "bounced") {
    if (!state.suppressed.includes(e)) state.suppressed.push(e);
  }
  if (lead) {
    lead.status = event === "replied" ? "replied" : event === "customer" ? "customer" : event;
    lead.statusDate = today;
    /* one person at a community answered or opted out: leave the rest of that community alone for now */
    if (event === "replied" || event === "unsubscribed" || event === "complaint" || event === "customer") {
      const d = domainOf(e);
      if (!state.pausedDomains.includes(d)) state.pausedDomains.push(d);
    }
  } else if (event !== "replied" && event !== "customer") {
    /* a stop request from an address that was never on the list is still honored */
  }
  return lead || null;
}

export function suppress(state, emailOrDomain) {
  const v = String(emailOrDomain).trim().toLowerCase();
  if (!v) return false;
  if (!state.suppressed.includes(v)) state.suppressed.push(v);
  const d = v.startsWith("@") ? v.slice(1) : null;
  for (const lead of Object.values(state.leads)) {
    if (lead.email === v || (d && domainOf(lead.email) === d)) lead.status = "unsubscribed";
  }
  return true;
}

/* ---------- the send plan ---------- */
export const DEFAULT_WARMUP = [{ week: 1, perMailbox: 10 }, { week: 2, perMailbox: 20 }, { week: 3, perMailbox: 30 }, { week: 4, perMailbox: 40 }];
export const DEFAULT_SEND_DAYS = [1, 2, 3, 4];   /* Monday to Thursday (0 is Sunday): business hours on workdays, never a weekend */

function dayNumber(iso) { const [y, m, d] = iso.split("-").map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86400000); }
export function daysBetween(a, b) { return dayNumber(b) - dayNumber(a); }
export function weekdayOf(iso) { const [y, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); }

/* what must be true before any message is made */
export function gateProblems(config) {
  const p = [];
  const addr = String(config.postal_address || "");
  if (!addr.trim() || /REPLACE_ME|YOUR[_ ]|\[.*\]/i.test(addr) || addr.trim().length < 12) p.push("postal_address: put the real mailing address (a P.O. box or a mailbox rental is fine) in outreach/data/config.json");
  if (!String(config.sender_name || "").trim() || /REPLACE_ME/i.test(config.sender_name)) p.push("sender_name: the name the notes are signed with");
  if (!Array.isArray(config.mailboxes) || !config.mailboxes.length) p.push("mailboxes: at least one sending address");
  else for (const m of config.mailboxes) if (!EMAIL.test(String(m.email || "")) || /REPLACE_ME/i.test(m.email)) p.push("mailboxes: " + (m.id || "one entry") + " has no real email address");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(config.start_date || ""))) p.push("start_date: the day the first message goes out, as YYYY-MM-DD");
  if (!EMAIL.test(String(config.reply_to || ""))) p.push("reply_to: where replies are read (Cognicopia@outlook.com)");
  return p;
}

export function dailyLimit(config, today) {
  const warm = config.warmup || DEFAULT_WARMUP;
  const week = Math.floor(daysBetween(config.start_date, today) / 7) + 1;
  if (week < 1) return 0;
  const step = [...warm].reverse().find(w => week >= w.week) || warm[0];
  return step.perMailbox * config.mailboxes.length;
}

function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

export function renderMessage(seq, stepIndex, lead, config) {
  const step = seq.steps[stepIndex];
  const variant = hash(lead.email) % step.subjects.length;
  const fill = (t, extra = {}) => {
    const v = { first_name: lead.first_name || "there", facility: lead.facility, city: lead.city, sender_name: config.sender_name, postal_address: config.postal_address, unsubscribe_line: seq.unsubscribeLine, footer: "", ...extra };
    v.footer = String(seq.footer).replace(/\{\{(\w+)\}\}/g, (_, k) => (v[k] != null && k !== "footer" ? v[k] : ""));
    return String(t).replace(/\{\{(\w+)\}\}/g, (_, k) => (v[k] != null ? v[k] : ""));
  };
  return { subject: fill(step.subjects[variant]), body: fill(step.body), variant: "ABCDEFG"[variant], step: stepIndex + 1, stepId: step.id };
}

/* today's batch. Follow-ups that are due go first (oldest first), then people who have not heard from us yet. */
export function planDay(state, seq, config, today) {
  const problems = gateProblems(config);
  if (problems.length) { const e = new Error("Not ready to send:\n - " + problems.join("\n - ")); e.problems = problems; throw e; }
  const sendDays = config.send_days || DEFAULT_SEND_DAYS;
  if (!sendDays.includes(weekdayOf(today))) return { items: [], limit: 0, note: "not a sending day (messages go out on workdays only)" };
  const limit = dailyLimit(config, today);
  if (limit <= 0) return { items: [], limit: 0, note: "before the start date" };
  const maxPerDomain = config.max_per_domain_per_day || 1;
  const due = [];
  for (const lead of Object.values(state.leads)) {
    if (lead.status !== "active") continue;
    if (isSuppressed(state, lead.email)) continue;
    if (state.pausedDomains.includes(domainOf(lead.email))) continue;
    if (lead.step >= seq.steps.length) continue;
    const delay = seq.steps[lead.step].delayDays;
    if (lead.step > 0 && daysBetween(lead.lastSent, today) < delay) continue;
    if (lead.lastSent === today) continue;
    due.push(lead);
  }
  const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
  due.sort((a, b) => (b.step - a.step) || cmp(a.lastSent || "", b.lastSent || "") || cmp(a.added, b.added) || cmp(a.email, b.email));
  const items = [], perDomain = {};
  for (const lead of due) {
    if (items.length >= limit) break;
    const d = domainOf(lead.email);
    if ((perDomain[d] || 0) >= maxPerDomain) continue;
    perDomain[d] = (perDomain[d] || 0) + 1;
    const m = config.mailboxes[items.length % config.mailboxes.length];
    const msg = renderMessage(seq, lead.step, lead, config);
    items.push({ email: lead.email, first_name: lead.first_name, facility: lead.facility, mailbox: m.email, reply_to: config.reply_to, ...msg });
  }
  return { items, limit, note: items.length < limit ? "fewer people are due than today's limit" : "" };
}

/* write down what was really sent (call this only after the sending tool has sent the batch) */
export function recordSent(state, items, today) {
  for (const it of items) {
    const lead = state.leads[it.email]; if (!lead) continue;
    lead.step = it.step; lead.lastSent = today; lead.history.push({ step: it.step, id: it.stepId, date: today, variant: it.variant });
    if (lead.step >= 4 && lead.status === "active") { /* the last note is out: nothing more is due */ }
    state.sentTotal += 1;
  }
  return state;
}

export function report(state, seq) {
  const by = {}; let waiting = 0;
  for (const l of Object.values(state.leads)) { by[l.status] = (by[l.status] || 0) + 1; if (l.status === "active" && l.step < seq.steps.length) waiting++; }
  const sent = state.sentTotal, replied = by.replied || 0, bounced = by.bounced || 0, unsub = by.unsubscribed || 0, complaints = by.complaint || 0;
  const pct = (n) => (sent ? (100 * n / sent).toFixed(1) + "%" : "n/a");
  const warnings = [];
  if (sent >= 100 && bounced / sent > 0.03) warnings.push("Bounces are above 3%: stop sending and clean the list before anything else.");
  if (sent >= 100 && complaints / sent > 0.001) warnings.push("Spam complaints are above 0.1%: stop, and look at who is receiving these notes.");
  return { leads: Object.keys(state.leads).length, byStatus: by, stillToWrite: waiting, sent, replyRate: pct(replied), bounceRate: pct(bounced), unsubscribeRate: pct(unsub), complaintRate: pct(complaints), warnings };
}

/* a page the owner opens on their own computer to send a small batch by hand: each message with big copy buttons, and a link that
   opens a new email already addressed and titled. Self-contained: no network, nothing loaded from anywhere. */
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export function batchHtml(items, today, config = {}) {
  const from = config.mailboxes && config.mailboxes[0] ? config.mailboxes[0].email : "your business address";
  const cards = items.map((it, i) => `<section class="card" id="m${i}">
<h2>${i + 1}. ${esc(it.facility)} <small>${esc(it.email)}</small></h2>
<p class="meta">Send from <b>${esc(it.mailbox)}</b> &middot; note ${it.step} of 4</p>
<p><b>Subject:</b> <span id="s${i}">${esc(it.subject)}</span></p>
<textarea id="b${i}" readonly rows="14">${esc(it.body)}</textarea>
<p class="row"><button type="button" data-copy="s${i}">1. Copy the subject</button> <button type="button" data-copy="b${i}">2. Copy the message</button>
<a class="btn" href="mailto:${encodeURIComponent(it.email).replace(/%40/g, "@")}?subject=${encodeURIComponent(it.subject)}">3. Open a new email to this address</a></p></section>`).join("\n");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Today's notes, ${esc(today)}</title>
<style>body{font:18px/1.5 system-ui,Segoe UI,Arial,sans-serif;max-width:46rem;margin:0 auto;padding:1rem;background:#f5f1e6;color:#111}h1{font-size:1.6rem}h2{font-size:1.2rem;margin:.2rem 0}small{font-weight:400;color:#444}
.card{background:#fff;border:1px solid #d8cfb8;border-radius:14px;padding:1rem;margin:1rem 0}.meta{color:#444;margin:.2rem 0 .6rem}textarea{width:100%;box-sizing:border-box;font:inherit;padding:.6rem;border:1px solid #999;border-radius:8px;background:#fafafa}
.row{display:flex;flex-wrap:wrap;gap:.6rem}button,.btn{min-height:52px;padding:.6rem 1rem;font:700 1rem system-ui,Arial,sans-serif;border:2px solid #0e3c43;border-radius:10px;background:#fff;color:#0e3c43;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center}
.btn{background:#0e3c43;color:#fff}.note{background:#fff;border-left:6px solid #0e3c43;padding:.6rem 1rem;border-radius:8px}</style></head><body>
<h1>Today's notes: ${esc(today)} (${items.length})</h1>
<div class="note"><p>Send each one from <b>${esc(from)}</b>, one at a time, then close it. Please send no more than ${items.length} today.</p>
<p>When you have sent them all, tell the desk (or tell me): <code>node scripts/outreach.mjs sent outreach/data/batch-${esc(today)}.json</code></p>
<p>If anyone answers &ldquo;no thanks&rdquo;: <code>node scripts/outreach.mjs event their@address unsubscribed</code> &mdash; or just tell me, and I will do it.</p></div>
${cards || "<p>Nothing is due today.</p>"}
<script>document.addEventListener("click",function(e){var b=e.target.closest("[data-copy]");if(!b)return;var el=document.getElementById(b.getAttribute("data-copy")),t=el.value!==undefined?el.value:el.textContent,old=b.textContent;function done(){b.textContent="Copied";setTimeout(function(){b.textContent=old},1500)}
if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(done,fallback)}else fallback();function fallback(){var a=document.createElement("textarea");a.value=t;document.body.appendChild(a);a.select();try{document.execCommand("copy");done()}catch(x){}a.remove()}});</script></body></html>`;
}
