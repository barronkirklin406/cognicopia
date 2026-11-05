#!/usr/bin/env node
/* js/studio-core.js in Node: storage schema and migration, the tracking trend engine and its Transition Recommendation,
   the planner's bulk pre-map, and the journal's keyword feed into the resident's insights. */
import * as S from "../js/studio-core.js";
let passed = 0; const problems = []; const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const mem = () => { const m = new Map(); return { get length() { return m.size; }, key: (i) => [...m.keys()][i], getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
const st = mem(), today = new Date(2026, 10, 10), mk = (m, f, fr, e, stage = "middle", t = []) => ({ month: m, stage, fatigue: f, frustration: fr, engagement: e, triggers: t });
/* tracking */
for (const e of [mk("2026-09", 3, 3, 1, "middle", ["Noise"]), mk("2026-10", 3, 2, 1, "middle", ["Noise", "Tiredness"]), mk("2026-11", 4, 3, 1, "middle", ["Noise"])]) S.saveEntry(st, "r1", e);
const a = S.analyze(S.readTracking(st, "r1").entries, today);
ok(a.recommendation.type === "gentler" && a.recommendation.to === "late" && /Transition Recommendation/.test(a.recommendation.banner) && a.windows[3].n === 3 && a.windows[3].triggers[0].trigger === "Noise" && /not an assessment/.test(a.recommendation.note), "sustained fatigue recommends the next gentler stage and names the main trigger");
for (const e of [mk("2026-09", 1, 0, 3, "late"), mk("2026-10", 1, 1, 4, "late"), mk("2026-11", 0, 0, 4, "late")]) S.saveEntry(st, "r2", e);
const b = S.analyze(S.readTracking(st, "r2").entries, today); ok(b.recommendation.type === "step-up" && b.recommendation.to === "middle", "sustained success suggests a trial of the stage above");
ok(S.analyze([], today).recommendation.type === "insufficient" && S.analyze([mk("2026-11", 4, 4, 0)], today).recommendation.type === "insufficient" && S.analyze(null).recommendation.type === "insufficient", "too little data gives no recommendation");
const g = S.analyze([mk("2026-09", 4, 4, 0, "late"), mk("2026-10", 4, 4, 0, "late"), mk("2026-11", 4, 4, 0, "late")], today); ok(g.recommendation.type === "gentler" && g.recommendation.to === null && /gentlest stage/.test(g.recommendation.banner), "at the gentlest stage the advice is comfort and a care-team conversation");
const mixed = S.analyze([mk("2026-09", 2, 1, 2), mk("2026-10", 1, 2, 3), mk("2026-11", 2, 1, 2)], today); ok(mixed.recommendation.type === "hold", "a mixed pattern holds");
ok(Object.keys(a.windows).join() === "3,6,12" && S.saveEntry(st, "r1", mk("2026-11", 0, 0, 4)).entries.length === 3, "windows of 3, 6 and 12 months; a month has one entry");
let bad = 0; for (const f of [() => S.saveEntry(st, "", mk("2026-11", 1, 1, 1)), () => S.saveEntry(st, "r1", { month: "nope" }), () => S.saveEntry(st, "../x", mk("2026-11", 1, 1, 1))]) { try { f(); } catch (e) { if (e instanceof RangeError) bad++; } } ok(bad === 3, "no resident, no month and a bad id are refused");
/* journal and feed */
st.setItem(S.KEYS.profile + "r1", JSON.stringify({ schema: "cognicopia.residentProfile", tier1_core: { preferredName: "Peggy" }, tier3_deep: {} }));
const j = S.saveJournalEntry(st, "r1", { kind: "calming", text: "Hummed Amazing Grace and settled when Biscuit the dog sat beside her. Call 555-123-4567." });
ok(!/555/.test(j.entry.text) && j.entry.keywords.includes("biscuit") && j.entry.keywords.includes("hummed"), "keywords are found and identifiers are removed before keeping");
const f = S.feedProfile(st, "r1", j.entry); ok(f.ok && f.profileUpdated && S.readInsights(st, "r1").keywords.biscuit === 1 && S.readInsights(st, "r1").anecdotes.length === 1 && JSON.parse(st.getItem(S.KEYS.profile + "r1")).tier3_deep.lifeNarrative.keywords.includes("biscuit") && JSON.parse(st.getItem(S.KEYS.profile + "r1")).tier1_core.preferredName === "Peggy", "the feed updates insights and the profile's narrative keywords without touching the rest");
ok(S.readInsights(st, "r2").anecdotes.length === 0 && S.readTracking(st, "r2").entries.length === 3 && !st.getItem(S.KEYS.journal + "r2"), "one resident's records never appear in another's");
/* listener */
const ev = new EventTarget(); ev.__x = 0; const feed = S.startJournalFeed(ev, () => st); let fed = null; ev.addEventListener("cg-studio-profile-fed", (e) => { fed = e.detail; });
const j2 = S.saveJournalEntry(st, "r2", { kind: "breakthrough", text: "Named her sister Ruth while looking at the quilt." }); ev.dispatchEvent(new CustomEvent("cg-studio-journal-added", { detail: { residentId: "r2", entry: j2.entry } })); await new Promise((r) => setTimeout(r, 20));
ok(fed && fed.ok && fed.keywords.includes("ruth") && S.readInsights(st, "r2").keywords.ruth === 1 && S.startJournalFeed(ev, () => st) === feed, "the background listener feeds the profile when an entry is announced, and starts only once"); feed.stop();
/* planner */
const plan = S.defaultPlan(2026); ok(plan.months["11"].milestone === "Thanksgiving" && plan.months["07"].milestone === "Independence Day" && plan.months["01"].season === "Winter" && !Object.values(plan.months).some((m) => /Mother|Father|Memorial|Easter|Christmas/.test(m.milestone)), "defaults give each month an era, season and arc, and leave out sensitive or religious days");
const pm = S.premap(plan, new Date(2026, 10, 1), 12); ok(pm.mapped === 2 && pm.planner.bundles.map((x) => x.month).join() === "2026-11,2026-12" && pm.planner.bundles[0].theme === "Thanksgiving" && pm.planner.bundles[0].words.length > 0, "the bulk pre-map links this year's remaining months to bundles (" + pm.mapped + ")");
const pm2 = S.premap(S.defaultPlan(2027), new Date(2027, 0, 1), 12); ok(pm2.mapped === 12 && new Set(pm2.planner.bundles.map((x) => x.month)).size === 12, "a full year maps twelve bundles");
const reqs = S.requestsFor(pm.planner, "2026-11", [{ preferredName: "A" }, { preferredName: "B" }]); ok(reqs.length === 2 && reqs[0].deep.themeWords.length > 0 && reqs[0].tokens.theme === "Thanksgiving" && reqs[1].deep.variant === 1 && S.requestsFor(pm.planner, "2026-05", [{}]).length === 0, "a month's bundle becomes one request per resident");
ok(S.markGenerated(pm.planner, "2026-11").bundles[0].status === "generated" && S.premap(S.markGenerated(pm.planner, "2026-11"), new Date(2026, 10, 1)).planner.bundles.find((x) => x.month === "2026-11").status === "generated", "a generated month is kept when the plan is mapped again");
S.savePlanner(st, pm.planner); ok(S.readPlanner(st, 2026).bundles.length === 2, "the plan is saved under its year");
/* migration */
st.setItem(S.KEYS.tracking + "r9", JSON.stringify({ entries: [{ month: "2026-10", fatigue: 9, stage: "bogus" }, { month: "x" }] })); const rep = S.migrate(st, today);
ok(rep.to === 1 && rep.repaired >= 1 && S.readTracking(st, "r9").entries[0].fatigue === 4 && JSON.parse(st.getItem(S.KEYS.meta)).v === 1 && S.migrate(st, today).repaired === 0, "the schema update repairs old records, stamps the version and is safe to run again");
st.setItem(S.KEYS.meta, JSON.stringify({ v: 99 })); ok(S.migrate(st).skipped, "a newer version's records are left alone");
if (problems.length) { console.error("studio core check FAILED: " + problems.length + ", " + passed + " passed"); problems.forEach((x) => console.error("  - " + x)); process.exit(1); }
console.log("studio core check passed: " + passed + " checks (schema and migration, trend engine and recommendation, planner pre-map, journal feed and listener, isolation)");
