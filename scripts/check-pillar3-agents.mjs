#!/usr/bin/env node
/* =====================================================================
   js/pillar3-qa-agents.js (Agents 16 to 20), in Node. (The page-level accessibility checks run in a browser:
   scripts/check-pillar3-ui.mjs.)

     sentinel      eight kinds of identifier and given names are found and redacted, findings never carry the value,
                   ordinary numbers and dates are left alone; a sheet that picked one up has it removed and says so;
                   a network guard records and can block calls to other hosts
     validator     undignified, over-promising, keep-off and unsafe customizations are left out and listed
     accessibility contrast math, print size, plain language, square grids, and the pipeline report
     feedback      categories, severity, sentiment, redaction, triage, digest and duplicate groups
     comms         drafts for each category from checked facts; claims the product cannot back are caught; nothing is sent
   ===================================================================== */
import { createOrchestrator, assetText } from "../js/agent-orchestrator.js";
import { ClinicalAuditAgent } from "../js/clinical-audit-agent.js";
import { registerReminiscence } from "../js/reminiscence-engine.js";
import { registerPillar1 } from "../js/pillar1-production-agents.js";
import { registerPillar2 } from "../js/pillar2-functionality-agents.js";
import { registerPillar3, PrivacySentinel, CustomizationValidator, AccessibilityChecker, FeedbackCategorizer, ClientCommsAssistant, contrastRatio, claimsProblems, PII_KINDS, CATEGORIES, WCAG, PILLAR3_AGENTS } from "../js/pillar3-qa-agents.js";
import "../src/config/license.js";

let passed = 0; const problems = [];
const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const ps = new PrivacySentinel();

/* ---------- 16. sentinel ---------- */
const samples = { ssn: "SSN 123-45-6789", email: "write to dana.smith@example.org today", phone: "call (555) 123-4567", dob: "born 04/12/1938", mrn: "MRN: 00123456", medicare: "id 1EG4TE5MK73", address: "lives at 123 Maple Street", card: "card 4111 1111 1111 1111" };
for (const [kind, text] of Object.entries(samples)) ok(ps.scan(text).kinds.includes(kind) && ps.scan(text).count >= 1, "finds a " + kind + " in: " + text);
ok(["555-123-4567", "+1 555.123.4567", "555 123 4567"].every((t) => ps.scan(t).kinds.includes("phone")) && ["April 12, 1938", "1938-04-12", "DOB: 4/12/1938", "date of birth 04-12-1938"].every((t) => ps.scan(t).kinds.includes("dob")), "phone numbers and birth dates are found in their usual forms");
ok(["Born in 1938", "Room 12, bed 3", "50 free packets", "$349 a year", "on 2026-11-10 at 9:30", "ages 65 to 90", "1234 5678 9012 3456", "000-12-3456", "version 1.2.3", "Peggy loves the garden"].every((t) => ps.scan(t).ok), "ordinary numbers, dates, prices, room numbers, a card number that fails its check, and a name with no name list are left alone");
ok(Object.keys(samples).every((k) => PII_KINDS.includes(k)) && PII_KINDS.includes("name") && ps.scan("123-45-6789").findings.every((f) => Object.keys(f).sort().join() === "at,kind,length"), "findings carry a kind, a place and a length, never the value");
ok(ps.scan("Peggy and Walter went out. Peggyann stayed.", { names: ["Peggy", "Walter"] }).findings.filter((f) => f.kind === "name").length === 2, "given names are found as whole words only");
const rd = ps.redact("Call Dana at 555-123-4567 about Peggy, SSN 123-45-6789.", { names: ["Peggy"] });
ok(rd.text === "Call Dana at [phone removed] about [name removed], SSN [ssn removed]." && rd.findings.length === 3 && ps.redact("nothing here").text === "nothing here" && ps.redact(null).text === "", "redaction names the kind and nothing else");
ok(ps.scanDeep({ a: ["x", { b: "mail me at a@b.org" }], c: 5 }).kinds.join() === "email" && ps.scanDeep(null).ok && ps.scanDeep({ a: { b: { c: "123-45-6789" } } }).count === 1, "every string inside a payload is scanned");
/* pipeline */
const o = registerReminiscence(createOrchestrator().use(new ClinicalAuditAgent())); registerPillar1(o); registerPillar2(o); const p3 = registerPillar3(o);
const peggy = { preferredName: "Peggy", formativeEra: "1938", ailmentTier: 2, hobbies: "gardening", petNames: "Biscuit", spouse: "Walter", pastCareer: "schoolteacher", hometown: "Cedar Falls, Iowa" };
const leak = await o.execute({ profile: peggy, deep: { staffNotes: "Call Dana at 555-123-4567\nDOB 04/12/1938" }, options: { template: "reminiscence" } });
const leakText = JSON.stringify(leak.asset);
ok(!/555-123-4567|04\/12\/1938/.test(leakText) && /\[phone removed\]/.test(leakText) && leak.audit.status === "fixed" && leak.audit.fixes.some((f) => /identifier was removed/.test(f.rule)) && /Peggy/.test(leakText), "an identifier that reached a sheet is removed, the audit says so, and the resident's own name stays");
const clean = await o.execute({ profile: peggy, options: { template: "reminiscence" } }); ok(clean.audit.status === "pass", "a clean sheet is left alone and passes");
ok(ps.scanDeep(o.log.entries, { names: ["Peggy", "Walter", "Biscuit", "Cedar Falls"] }).ok, "the diagnostic log holds no name and no identifier after these runs");
/* network guard */
const calls = []; const win = { location: { href: "https://cognicopia.org/index.html", origin: "https://cognicopia.org" }, fetch: (u) => { calls.push(["fetch", String(u)]); return Promise.resolve("ok"); }, navigator: { sendBeacon: (u) => { calls.push(["beacon", u]); return true; } }, XMLHttpRequest: function () {}, WebSocket: function (u) { calls.push(["ws", u]); }, EventSource: function (u) { calls.push(["es", u]); } };
win.XMLHttpRequest.prototype.open = function (m, u) { calls.push(["xhr", u]); };
const watch = ps.installNetworkGuard(win);
await win.fetch("/data/content-catalog.json"); await win.fetch("https://api.example.com/x"); win.navigator.sendBeacon("https://t.example.net/b"); new win.XMLHttpRequest().open("GET", "https://x.example.org/");
ok(watch.attempts().length === 3 && watch.attempts().map((a) => a.host).join() === "api.example.com,t.example.net,x.example.org" && calls.length === 4 && watch.blocked() === 0, "watching records each call to another host, ignores the site's own files, and lets everything through");
watch.restore(); ok(typeof win.fetch === "function" && (await win.fetch("https://zzz.example.com/")) === "ok" && watch.attempts().length === 3, "restoring puts the original calls back");
calls.length = 0; const guard = ps.installNetworkGuard(win, { block: true, allow: ["licenses.example.com"] });
let rejected = false; try { await win.fetch("https://api.example.com/x"); } catch (e) { rejected = e instanceof TypeError; }
let xhrBlocked = false; try { new win.XMLHttpRequest().open("GET", "https://x.example.org/"); } catch (e) { xhrBlocked = e instanceof TypeError; }
let wsBlocked = false; try { new win.WebSocket("wss://x.example.org/"); } catch (e) { wsBlocked = e instanceof TypeError; }
const beacon = win.navigator.sendBeacon("https://t.example.net/b"), allowedOk = await win.fetch("https://licenses.example.com/k"), sameOk = await win.fetch("https://cognicopia.org/a");
ok(rejected && xhrBlocked && wsBlocked && beacon === false && allowedOk === "ok" && sameOk === "ok" && calls.every((c) => /licenses|cognicopia/.test(c[1])) && guard.blocked() === 4, "blocking stops fetch, XHR, WebSocket and beacons to other hosts, and allows the listed host and the site itself (" + guard.blocked() + " blocked)");
guard.restore(); ok(ps.installNetworkGuard(undefined).restore() === undefined, "with no window the guard does nothing and does not fail");

/* ---------- 17. validator ---------- */
const cv = new CustomizationValidator();
const v1 = cv.validate({ deep: { staffNotes: ["Prefers the window seat", "Be a good girl and behave", "Stubborn about meals", "This will cure the decline"], foods: ["apple pie", "honey, dear"], music: ["Patsy Cline", "Do you remember the radio?"], words: ["orchard", "armoire"] }, tier: 3, avoid: ["armoire", "radio"] });
ok(v1.cleaned.staffNotes.join() === "Prefers the window seat" && v1.omitted.filter((x) => x.field === "staffNotes").length === 3 && v1.cleaned.music.join() === "Patsy Cline" && v1.cleaned.words.join() === "orchard" && v1.cleaned.foods.join() === "apple pie", "talking down, labels, medical promises, quiz wording and keep-off words are left out of each list");
ok(v1.errors.length === 1 && /promise of a medical result/.test(v1.errors[0]) && v1.ok === false && v1.omitted.some((x) => /promises/.test(x.reason)) && v1.omitted.some((x) => /keep-off/.test(x.reason)) && v1.omitted.some((x) => /talks down/.test(x.reason)), "every omission has a plain reason, and a medical promise is an error");
const v2 = cv.validate({ deep: { foods: ["eat a bite of pie"], staffNotes: ["Likes holding small beads and scissors"], words: ["extraordinary", "wonderfully"], include: { wordSearch: false, sparks: false, matching: false } }, tier: 3 });
ok(v2.ok && v2.warnings.some((w) => /instruction to eat/.test(w)) && v2.warnings.some((w) => /unsafe for someone at the latest stage/.test(w)) && v2.warnings.some((w) => /long words/.test(w)) && v2.warnings.some((w) => /every part/.test(w)), "unsafe objects, eating instructions, long words and an empty page are warned about, not silently accepted");
ok(cv.validate(null).ok && cv.validate({}).omitted.length === 0 && cv.validate({ deep: { music: "not a list" } }).ok && cv.validate({ deep: { words: Array(12).fill("garden") } }).warnings.some((w) => /more than eight/.test(w)), "nothing, junk and over-long lists are handled");
const piped = await o.execute({ profile: peggy, deep: { staffNotes: "Be a good girl and behave\nPrefers the window seat", music: "Patsy Cline" }, options: { template: "reminiscence" } });
ok(!/good girl|behave/.test(JSON.stringify(piped.asset)) && /window seat/.test(JSON.stringify(piped.asset.pages.caregiver)) && piped.analysis.customization.omitted === 1 && piped.audit.status === "pass", "in the pipeline the offending note never reaches the sheet, and the rest does");

/* ---------- 18. accessibility ---------- */
ok(contrastRatio("#000", "#fff") === 21 && contrastRatio("black", "white") === 21 && contrastRatio("#777", "#fff") === 4.48 && contrastRatio("rgb(0,0,0)", "rgb(255,255,255)") === 21 && contrastRatio("rgba(0,0,0,0.5)", "#fff") > 3 && contrastRatio("nonsense", "#fff") === null && contrastRatio("#fff", "#fff") === 1, "contrast is computed for hex, rgb, names and transparency, and refuses what it cannot read");
const ac = new AccessibilityChecker();
ok(ac.checkAsset(clean.asset).ok && ac.checkAsset(clean.asset).contrast === 21, "a generated sheet passes: 18 pt or more, short sentences, a square grid, a title, black on white");
const base = () => JSON.parse(JSON.stringify(clean.asset));
const a1 = base(); a1.pages.resident.fontPt = 14; a1.pages.resident.blocks.push({ type: "prompts", title: "x", items: ["This sentence goes on and on and on for far more words than a plain language rule would ever allow a reader who is tired to follow along with."] }); a1.pages.resident.blocks.push({ type: "wordsearch", title: "w", grid: ["ABC", "DEF"], words: ["ABC"], cellPx: 20 }); a1.branding = { logoDataUrl: "javascript:x" };
const r1 = ac.checkAsset(a1);
ok(!r1.ok && ["1.4.4", "3.1.5", "1.3.1", "2.5.8", "1.1.1"].every((c) => r1.problems.some((p) => p.criterion === c)), "print size, long sentences, a non-square grid, tiny squares and a non-image logo are each reported with their WCAG number (" + r1.problems.map((p) => p.criterion).join(",") + ")");
ok(ac.checkAsset(null).ok === false && ac.checkAsset({}).problems.length >= 2 && ac.checkDom(null, null).ok === false, "nothing at all is reported, not thrown");
ok(clean.audit.problems.length === 0 && clean.audit.status === "pass", "the pipeline ran the accessibility check on a clean sheet and found nothing");
o.registerLocalTemplate("tiny", (ctx) => { const b = o.generator.template("reminiscence")(ctx); b.pages.resident.blocks.push({ type: "wordsearch", title: "w", grid: ["ABC", "DEF", "GHI"], words: ["ABC"], cellPx: 20 }); return b; });
const flagged = await o.execute({ profile: peggy, options: { template: "tiny" } }); ok(flagged.audit.problems.some((p) => /accessibility 2\.5\.8/.test(p.rule)), "a problem found in the pipeline appears in the audit's problems");

/* ---------- 19. feedback ---------- */
const fb = p3.feedback;
const cat = (t) => fb.categorize(t);
ok(cat("The printer cuts off the margins on every page").category === "print" && cat("The app crashed and I lost my work").category === "bug" && cat("The text is too small and hard to read").category === "accessibility" && cat("The wording on page 2 felt childish and patronizing").category === "content" && cat("I could not find the button, it was confusing").category === "usability" && cat("How much is the license and is there a free trial?").category === "pricing" && cat("It would be nice if you could add a bingo sheet").category === "feature" && cat("We love this, the residents enjoyed it, thank you").category === "praise" && cat("xyz").category === "other", "each message lands in its category");
ok(cat("Is our resident data sent to the cloud? That would be a HIPAA problem").category === "privacy" && cat("Is our resident data sent to the cloud? That would be a HIPAA problem").severity === "critical", "a privacy worry comes first, and one that says data was sent is critical");
ok(cat("It crashed and all my saved profiles disappeared").severity === "critical" && cat("It crashed once").severity === "high" && cat("print margins look off").severity === "medium" && cat("lovely").severity === "low", "severity follows the harm: lost data is critical, a crash high, print medium, praise low");
ok(cat("We love it, thank you, it is great").sentiment === "positive" && cat("This is terrible and frustrating, it crashed").sentiment === "negative" && cat("Where is the page?").sentiment === "neutral" && CATEGORIES.length === 10, "sentiment is positive, negative or neutral");
const c1 = fb.categorize("Margaret Smith (555-123-4567, margaret@example.org) says printing cuts off. MRN: 00123456.", { names: ["Margaret Smith"] });
ok(!/555-123-4567|margaret@|00123456|Margaret Smith/.test(c1.text + c1.summary) && c1.redactions.includes("phone") && c1.redactions.includes("name") && c1.category === "print", "identifiers and given names are removed before anything is kept");
const e1 = fb.add("Printing cuts off at the bottom, call me at 555-123-4567"), e2 = fb.add("The app crashed and my profiles disappeared"), e3 = fb.add("We love it, thank you!"), e4 = fb.add("Printing cuts off at the bottom of the page"), e5 = fb.add("It would be nice to add a bingo sheet");
ok(!/555-123-4567/.test(JSON.stringify(fb.all())) && fb.all().length === 5, "only redacted text is stored");
const tri = fb.triage(); ok(tri[0].severity === "critical" && tri[tri.length - 1].severity === "low", "triage puts the critical item first and praise last");
const dg = fb.digest(); ok(dg.total === 5 && dg.byCategory.print === 2 && dg.critical === 1 && dg.bySentiment.positive >= 1, "the digest counts by category, severity and sentiment");
const grp = fb.groups(); ok(grp.length === 1 && grp[0].ids.includes(e1.id) && grp[0].ids.includes(e4.id) && grp[0].category === "print", "two entries about the same thing are grouped");
ok(fb.triage([]).length === 0 && fb.digest([]).total === 0 && fb.groups([]).length === 0 && fb.categorize(null).category === "other" && fb.categorize("x".repeat(20000)).text.length <= 4000, "empty input and huge input are handled");

/* ---------- 20. comms ---------- */
const cc = p3.comms;
ok(claimsProblems("It is HIPAA compliant").length === 1 && claimsProblems("We guarantee results").length === 1 && claimsProblems("saves 10 hours a week").length === 1 && claimsProblems("30% faster").length === 1 && claimsProblems("clinically proven").length === 1 && claimsProblems("It ensures compliance with F679").length === 1, "unbacked claims are caught: compliance, guarantees, hours saved, percentages, medical claims");
ok(claimsProblems("No resident data leaves the device. It supports a facility's HIPAA privacy practices.").length === 0 && claimsProblems("It does not make a facility HIPAA compliant.").length === 0 && claimsProblems("A license is $39 a month or $349 a year.").length === 0, "the approved wording, a denial and a price are allowed");
const d = { privacy: "Is our resident data sent to the cloud?", bug: "The page froze and nothing happens", print: "My printer cuts off the margins", accessibility: "The font size is too small", content: "This wording is childish", usability: "I can't find where to start", pricing: "How much is a license? Is there a free trial?", feature: "Please add a bingo sheet", praise: "Thank you, we love it", other: "hello there" };
const drafts = Object.fromEntries(Object.entries(d).map(([k, t]) => [k, cc.draft({ text: t, name: "Dana Rivera" })]));
ok(Object.keys(d).every((k) => drafts[k].category === k && drafts[k].status === "draft" && drafts[k].sent === false && drafts[k].claims.ok && /^Hello Dana,/.test(drafts[k].body) && /The Cognicopia team$/.test(drafts[k].body)), "every category gets a draft that is marked a draft, is not sent, passes the claims check and greets by first name");
ok(/no resident data leaves the device/i.test(drafts.privacy.body) && /supports a facility's HIPAA privacy practices/.test(drafts.privacy.body) && !/HIPAA compliant\./.test(drafts.privacy.body.replace(/we do not describe the software as HIPAA compliant/, "")), "the privacy reply uses only the approved wording");
ok(/50 packets free/.test(drafts.pricing.body) && /\$39 a month/.test(drafts.pricing.body) && /\$349 a year/.test(drafts.pricing.body) && /custom quote/.test(drafts.pricing.body), "the pricing reply quotes the numbers from the license configuration (" + (drafts.pricing.body.match(/\d+ packets free[^.]*\./) || [""])[0] + ")");
ok(/100% or Actual size/.test(drafts.print.body) && /browser and device/.test(drafts.bug.body) && /Please leave out any resident's name/.test(drafts.bug.body), "print and bug replies carry the practical steps and ask for no resident details");
const lawyer = cc.draft({ text: "I will contact my lawyer about a refund for the breach" }), phi = cc.draft({ text: "My resident Margaret, DOB 04/12/1938, MRN: 00123456, printing is broken" }), crit = cc.draft({ text: "It crashed and my saved profiles disappeared" });
ok(lawyer.needsPerson && /legal|billing/.test(lawyer.reasons.join()) && phi.needsPerson && /personal identifiers/.test(phi.reasons.join()) && !/00123456/.test(phi.reasons.join() + phi.body) && crit.needsPerson && /data loss|privacy/.test(crit.reasons.join()) && !drafts.print.needsPerson, "a legal or billing matter, personal identifiers and possible data loss are flagged for a person, and no identifier is repeated");
const noFacts = new ClientCommsAssistant({ facts: null }); const saved = globalThis.CognicopiaLicenseConfig; delete globalThis.CognicopiaLicenseConfig;
ok(/confirm current pricing/.test(noFacts.draft({ text: "price?" }).body), "with no license configuration the reply promises no number"); globalThis.CognicopiaLicenseConfig = saved;
ok(cc.draft(null).category === "other" && cc.draft({}).status === "draft" && cc.draft({ text: "price", name: "<script>alert(1)</script>" }).body.startsWith("Hello,") && cc.draft({ text: "price", name: "Dana-Lee Rivera" }).body.startsWith("Hello Dana-Lee,"), "a missing message is handled, a name with markup is not used, and a hyphenated first name is kept");

/* ---------- pipeline ---------- */
const ids = o.integrity();
ok(ids.ok && PILLAR3_AGENTS.every((n) => o.agents().some((x) => x.name === n)) && ids.pings.every((p) => p.ok), "the five agents are registered and answer the ping");
ok(p3.sentinel instanceof PrivacySentinel && p3.validator instanceof CustomizationValidator && p3.accessibility instanceof AccessibilityChecker && p3.feedback instanceof FeedbackCategorizer && p3.comms instanceof ClientCommsAssistant && WCAG.minTargetPx === 52, "the five agents are the five classes");
let t = false; try { registerPillar3(null); } catch (e) { t = e instanceof TypeError; } ok(t, "registering with no orchestrator is refused");
const all30 = await o.execute({ profile: peggy, condition: "lewy", preset: "music-first", deep: { music: "Patsy Cline" }, options: { template: "reminiscence" } });
ok(all30.audit.status === "pass" && all30.analysis.calibration && all30.analysis.preset && all30.analysis.customization && !/[{}]/.test(assetText(all30.asset)), "pillars 1 to 3 together on one request: condition, preset and customization all apply and the sheet passes");

if (problems.length) { console.error("pillar 3 check FAILED: " + problems.length + " problem(s), " + passed + " passed"); problems.forEach((x) => console.error("  - " + x)); process.exit(1); }
console.log("pillar 3 check passed: " + passed + " checks (identifiers and the network guard, customization validation, sheet accessibility, feedback triage, drafted replies and the claims check, orchestrator wiring)");
