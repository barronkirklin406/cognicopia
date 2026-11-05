#!/usr/bin/env node
/* js/scenario-trees.js in Node: every scenario is a clean tree (no loops, no dead ends, one best choice per screen, a reason for every choice),
   the dignity wording rules hold, scoring and passing work, the record stores only what it should, and certificates are made and can be checked. */
import * as T from "../js/scenario-trees.js";
let passed = 0; const problems = []; const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, String(v)), dump: () => [...m.values()].join("\n") }; };
ok(T.SCENARIOS.length === 4 && new Set(T.SCENARIOS.map((s) => s.id)).size === 4, "there are four scenarios with their own ids");
const issues = T.SCENARIOS.flatMap(T.validate); ok(issues.length === 0, "every scenario is a clean tree (" + issues.slice(0, 3).join("; ") + ")");
const all = JSON.stringify(T.SCENARIOS);
ok(!/sweetie|honey|dearie|good (girl|boy)|combative|non-?complian|wanderer|demented|\brefus/i.test(all), "no elderspeak and no labels that judge a person appear in any scenario");
const best = T.SCENARIOS.flatMap((s) => Object.values(s.nodes).filter((n) => !n.end).flatMap((n) => n.choices.filter((x) => x.quality === 2)));
ok(best.length >= 14 && !best.some((x) => /do you remember|quiz|test them|tell them (it is|they are)/i.test(x.text)), "the best choice on every screen invites and never quizzes (" + best.length + " best choices)");
ok(T.SCENARIOS.every((s) => Object.values(s.nodes).some((n) => n.end && /Shift board|tell the (nurse|next shift|team)/i.test(n.text))), "every scenario ends by saying what to hand on to the next shift");
for (const s of T.SCENARIOS) { const st = T.bestPath(s.id), sc = T.score(st); ok(st.done && sc.percent === 1 && sc.passed && sc.steps >= 3, s.id + ": the best path scores 100% and passes in " + sc.steps + " steps"); }
let st = T.start("dusk"); const r1 = T.choose(st, "c"); ok(r1 && r1.quality === 0 && r1.state.node === "a1x" && /unheard|Correcting/.test(r1.feedback), "a less helpful first choice gives a reason and a repair screen");
let s2 = r1.state; s2 = T.choose(s2, "a").state; s2 = T.choose(s2, "a").state; s2 = T.choose(s2, "a").state;
const sc2 = T.score(s2); ok(s2.done && sc2.steps === 4 && sc2.earned === 6 && sc2.possible === 8 && sc2.percent === 0.75 && sc2.passed, "one wrong move then repairs is 6 of 8 points, exactly 75%, which passes (" + JSON.stringify(sc2) + ")");
let bad = T.start("bath"); for (const id of ["c", "b", "c", "c", "c"].slice(0, 5)) { const r = T.choose(bad, id); if (!r) break; bad = r.state; } const scb = T.score(bad); ok(scb.percent < T.PASS && !scb.passed, "choosing the less helpful answers throughout does not pass (" + Math.round(scb.percent * 100) + "%)");
ok(T.choose(st, "zzz") === null && T.choose(null, "a") === null && T.choose({ scenario: "nope", node: "x", steps: [] }, "a") === null && T.choose(T.bestPath("dusk"), "a") === null, "an unknown choice, an unknown scenario or a finished one gives nothing");
ok(!T.score(T.start("dusk")).passed && T.score(null).percent === 0, "an unfinished scenario never passes");
/* record + certificates */
const store = mem(), now = new Date("2026-11-10T14:00:00Z"); let err = "";
try { T.complete(store, { name: "" }, T.bestPath("dusk"), now); } catch (e) { err = e.message; } ok(/name/.test(err), "a certificate needs a name");
try { T.complete(store, { name: "Sam Example" }, T.start("dusk"), now); err = ""; } catch (e) { err = e.message; } ok(/Finish/.test(err), "an unfinished scenario cannot be recorded");
const failRun = T.complete(store, { name: "Sam Example", role: "Care aide" }, bad, now); ok(!failRun.passed && failRun.id === "", "a run that does not pass is recorded without a certificate");
const res = T.SCENARIOS.map((s, i) => T.complete(store, { name: "Sam Example", role: "Care aide" }, T.bestPath(s.id), new Date(now.getTime() + i * 60000)));
ok(res.every((r) => /^SC-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(r.id)) && new Set(res.map((r) => r.id)).size === 4, "each pass gets its own certificate id");
const rec = T.read(store); ok(rec.results.length === 5 && T.passedBy(rec, "sam example").all && T.passedBy(rec, "Someone Else").done.length === 0, "the record is read back; all four are passed for Sam, none for someone else");
ok(T.find(rec, res[1].id.toLowerCase()).scenario === "bath" && T.find(rec, "SC-ZZZZ-ZZZZ") === null && T.find(rec, "") === null, "a certificate id can be checked, in any letter case, and a wrong one is not found");
ok(!/Restless in the late|children from school|Where is Walter|my purse|Get out/.test(store.dump()), "the record holds ids and numbers, not the scenario text");
ok(T.read({ getItem: () => "{bad" }).results.length === 0 && T.read({ getItem: () => { throw new Error("x"); } }).results.length === 0 && T.normalize({ results: [{ scenario: "zzz", at: "x", learner: "A" }] }).results.length === 0, "damaged or foreign records read as empty");
const page = T.certificatePage(res[0], { facility: "Maple Grove" });
ok(/Certificate of Completion/.test(page) && /Sam Example/.test(page) && /Restless in the late afternoon/.test(page) && new RegExp(res[0].id).test(page) && /not accredited/i.test(page) && /Maple Grove/.test(page) && /Signature/.test(page), "the certificate names the learner, scenario, date, id and says it is not accredited");
ok(!/<script/i.test(T.certificatePage(Object.assign({}, res[0], { learner: "<script>x</script>" }))), "markup in a name is escaped");
const sp = T.seriesPage("Sam Example", rec, { facility: "Maple Grove" }); ok(/Responding to Distress with Dignity/.test(sp) && T.SCENARIOS.every((s) => sp.includes(s.title)) && /SS-[A-Z2-9]{3}-[A-Z2-9]{3}/.test(sp), "the series certificate lists all four scenarios and has its own id");
ok(T.seriesId("Sam Example", rec) === T.seriesId("sam example", rec), "the series id does not depend on letter case");
if (problems.length) { console.error("scenario trees check FAILED: " + problems.length + ", " + passed + " passed"); problems.forEach((x) => console.error("  - " + x)); process.exit(1); }
console.log("scenario trees check passed: " + passed + " checks (clean trees, dignity wording, scoring, record, certificates)");
