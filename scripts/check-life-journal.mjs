#!/usr/bin/env node
/* =====================================================================
   Cognitive Life Journal checks.  Run: npm test
   Loads the journal engine straight out of builder.html (the lp-engine
   block, which carries the shared print kit, then the lj-engine block) and
   checks the rules the journal promises:
     - dignity-first tone guardrails, on every page and on AI copy; the AI
       request carries no name that is on file
     - personalization reaches the pages; topics to avoid remove their
       prompts and pages (war, religion, "going home", money)
     - the audience split: Sections I to III are the resident's life story,
       and Section IV ends in a separate, marked part for family and care
       team notes; three print scopes
     - two-page spreads: left pages hold the story prompts and a photo or
       drawing frame, right pages hold writing lines
     - print standards: 0.75 in inner gutter, 14 pt text and 16 pt bold
       heading floors, writing lines 0.5 in apart at 2 pt, Atkinson
       Hyperlegible on every page
     - section colors readable at WCAG AAA (7:1)
     - user text is escaped, and the screen is wired into the builder
   Node built-ins only. The real browser and PDF measurements were made
   with Playwright and PyMuPDF; see the pull request for the method.
   ===================================================================== */
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(ROOT, "builder.html"), "utf8");
const block = (tag, id) => {
  const m = new RegExp(`<${tag} id="${id}">\\n([\\s\\S]*?)\\n</${tag}>`).exec(html);
  if (!m) throw new Error(`builder.html has no <${tag} id="${id}"> block`);
  return m[1];
};
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(block("script", "lp-engine"), sandbox, { filename: "lp-engine" });
vm.runInContext(block("script", "lj-engine"), sandbox, { filename: "lj-engine" });
const LJ = sandbox.window.LifeJournal, LP = sandbox.window.LifePlanner;
const lpCss = block("style", "lp-css"), ljCss = block("style", "lj-css");

let passed = 0;
const failures = [];
function check(name, fn){
  try { const r = fn(); if (r === false) throw new Error("returned false"); passed++; }
  catch (e){ failures.push(name + ": " + e.message); }
}
function eq(a, b, what){ if (a !== b) throw new Error(`${what || "value"}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }
function ok(v, what){ if (!v) throw new Error(what || "expected true"); }

const EX = LJ.EXAMPLE_PROFILE;
/* Tier 1 prints every invitation and fact; the content checks read it. The tier checks build all three. */
const build = (prof, o, scope) => LJ.build(prof, Object.assign({ tier: 1 }, o), scope);
const TIERS = [1, 2, 3];
const text = pages => pages.map(p => LJ.textRuns(p.body).join(" ")).join("\n");
const SCOPES = ["story", "reflection", "complete", "resident"];
const SERVICE = Object.assign({}, EX, { militaryBranch: "navy", militaryRank: "Petty Officer Second Class", militaryYears: "1956 to 1960",
  militaryPlaces: "San Diego and Yokosuka, Japan", militaryTalk: "welcome", avoid: [] });

/* A worst-case profile: every field at its length and count limit. */
const long = (s, n) => (s + " ").repeat(20).slice(0, n).trim();
const many = (n, s, len) => Array.from({ length: n }, (_, i) => long(s + " " + i, len));
const MAX = {
  name: long("Maximiliana", 30), fullName: long("Maximiliana Wilhelmina", 50), birthSurname: long("Vanderhoeven", 30), birthMonth: 9, birthDay: 30, birthYear: 1931,
  birthplace: long("Wawatosa-on-the-Mississippi", 40), hometown: long("Saint Paul Park on the river", 40), career: long("Mechanical engineer and railroad signal maintainer", 50),
  militaryBranch: "army", militaryRank: long("Sergeant First Class", 40), militaryYears: "1951 to 1953 and 1955", militaryPlaces: long("Fort Leonard Wood, Missouri and Seoul", 60),
  militaryTalk: "welcome", origins: long("German and Norwegian dairy families", 60), childhoodHome: long("The white farmhouse at the end of County Road", 70),
  parents: ["mother", "father", "stepmother", "grandmother"].map((role, i) => ({ name: long("Wilhelmina " + i, 30), role })),
  siblings: Array.from({ length: 8 }, (_, i) => ({ name: long("Bartholomew " + i, 30), rel: ["brother", "sister", "sibling"][i % 3] })),
  friends: many(6, "Dorothea Lindqvist", 30), schools: many(4, "Saint Bartholomew Consolidated School", 45), teacher: long("Sister Mary Bernadette", 40),
  subject: long("Arithmetic and penmanship", 40), pets: Array.from({ length: 6 }, (_, i) => ({ name: long("Maximilian " + i, 24), kind: long("Golden retriever", 24) })),
  firstJob: long("Paper route for the Evening Tribune and grocery clerk", 60), workplace: long("Chicago Great Western Railway shops", 45), careerYears: "1953 to 1995",
  skills: many(8, "Cabinet making", 40), organizations: many(8, "Veterans of Foreign Wars Post", 45), proudMoments: many(6, "Building the family home with my own hands", 70),
  songs: many(10, "When the moon hits your eye", 60), genres: many(6, "Western swing", 40), hymns: many(6, "Blessed Assurance", 50),
  scents: many(6, "Pine boughs", 45), tastes: many(6, "Rhubarb pie", 45), comfortFoods: many(6, "Swedish meatballs with gravy", 50),
  textures: many(6, "Worn leather", 45), colors: many(6, "Forest green", 30), landscapes: many(6, "The bluffs above the Mississippi", 50),
  affirmations: LJ.DATA.AFFIRMATIONS.map(a => a.id), customAffirmations: many(6, "You built things that are still standing", 90),
  wisdom: many(6, "Measure twice and cut once, and leave every place better than you found it", 110), avoid: [], facility: long("Wawatosa Memorial Memory Care", 60)
};
const PROFILES = { example: EX, empty: {}, max: MAX, service: SERVICE };

/* Sensory cross-reference: an explicit era or a birth-year suggestion is
   paired with the active life-story topic, and staff instructions retain it. */
check("sensory cues cross-reference selected eras and topics", () => {
  const cue = LJ.sensoryCue({ birthYear:1938, sensoryEra:"auto" }, "tastes");
  eq(cue.era, "1950s", "suggested youth-era");
  ok(cue.eraText.indexOf("ground coffee") >= 0 && cue.eraText.indexOf("big band radio") >= 0, "era scent and music cues");
  ok(cue.topicText.indexOf("cinnamon or vanilla") >= 0 && cue.topicText.indexOf("wooden spoon") >= 0, "topic-specific kitchen cues");
  const result = LJ.build({ birthYear:1938 }, { tier:1 }, "story");
  const page = result.pages.find(p => p.spreadId === "tastes" && p.side === "left");
  ok(page && page.staffMeta && page.staffMeta.sensoryTrigger.summary.indexOf("1950s") >= 0, "cue retained in page staff metadata");
  ok(page.html.indexOf("For staff · Sensory pairing:") >= 0 && page.html.indexOf("avoid allergens") >= 0, "safe sensory cue printed on staff prompt");
});

/* ---------- 1. Tone guardrails ---------- */
const audit = (s, audience) => LJ.TONE.audit(s, { audience });
check("the built-in content library passes the dignity-first audit", () => {
  const lib = LJ.libraryStrings(), bad = lib.filter(x => audit(x.text, x.audience).length);
  ok(lib.length > 150, "library strings found: " + lib.length);
  eq(bad.length, 0, "library strings breaking a rule: " + bad.map(x => x.text).join(" | "));
});
for (const [pname, prof] of Object.entries(PROFILES)) for (const joyWeeks of [1, 12]) for (const tier of TIERS) {
  check(`every printed line passes the audit (${pname} profile, ${joyWeeks} week${joyWeeks > 1 ? "s" : ""} of joy logs, tier ${tier})`, () => {
    const v = LJ.auditPages(LJ.build(prof, { joyWeeks, noteSpreads: 4, tier }, "complete").pages);
    eq(v.length, 0, "violations " + JSON.stringify(v.slice(0, 3)));
  });
}
check("the journal uses the same audit rules as the rest of Cognicopia", () => {
  eq(LJ.TONE.RULES.map(r => r.id).join(), LP.TONE.RULES.map(r => r.id).join(), "rule ids");
  const MUST_FLAG = { "baby-talk": "Time to fill your tummy", "pet-name": "Here you go, honey.", "patronizing-we": "How are we feeling today?", "praise": "Good job!",
    "preschool": "It's circle time", "quizzing": "Do you remember your wedding?", "labels": "She suffers from dementia", "sing-song": "Yay! Music time",
    "emoji": "Lovely day \u{1F60A}", "medical-claim": "This activity slows dementia", "clinical-leak": "Ask the care team" };
  for (const [rule, s] of Object.entries(MUST_FLAG)) ok(audit(s, "resident").some(h => h.rule === rule), `"${s}" was not flagged as ${rule}`);
  ["Tell me about your mother, Ingrid.", "Who made her mother’s apple pie best, and how?", "Honey-glazed ham", "Retired after 41 years in the classroom"]
    .forEach(s => eq(audit(s, "resident").map(h => h.rule).join(), "", `"${s}"`));
});
check("the system prompt forbids infantilizing, patronizing and toddler-style language", () => {
  const p = LJ.TONE.SYSTEM_PROMPT;
  ["Cognitive Life Journal", "DIGNITY FIRST", "Infantilizing or toddler-style language", "Pet names", "patronizing \"we\"", "Do you remember", "Never invent",
    "past tense of memory", "never ask the resident to confirm a name or a date", "Affirmations must be true for any adult", "Return only the JSON"]
    .forEach(k => ok(p.indexOf(k) >= 0, "missing: " + k));
  ok(p.indexOf("present tense") < 0, "the memoir prompt must not also ask for the present tense");
  ok(p !== LP.TONE.SYSTEM_PROMPT, "the journal has its own prompt");
});
check("AI copy: failing lines are dropped, unknown pages ignored, clean lines kept", () => {
  const r = LJ.acceptAiCopy({ pages: [
    { id: "home", prompts: ["Tell me about the porch on a summer evening.", "Do you remember your address?", "Yay! Home time!!", "Who lived across the street, sweetie?"] },
    { id: "not-a-page", prompts: ["Tell me anything."] }, { id: "music", prompts: "not a list" }] });
  eq(JSON.stringify(r.copy.pages), JSON.stringify({ home: ["Tell me about the porch on a summer evening."] }), "kept copy");
  ok(r.rejected.length >= 3, "rejected lines are reported");
});
check("AI copy that passed the audit reaches its own page, and only that page", () => {
  const ai = LJ.acceptAiCopy({ pages: [{ id: "home", prompts: ["Tell me about the porch on a summer evening."] }] }).copy;
  const res = build(EX, { aiCopy: ai }, "story"), on = res.pages.filter(p => text([p]).indexOf("the porch on a summer evening") >= 0);
  eq(on.map(p => p.spreadId).join(), "home", "pages carrying the AI line");
});
check("AI copy keeps a place even when the resident's own details fill the page", () => {
  const ai = LJ.acceptAiCopy({ pages: [{ id: "music", prompts: ["Tell me about the first record you bought."] }] }).copy;
  const music = pages => LJ.textRuns(pages.filter(p => p.spreadId === "music" && p.side === "left")[0].body);
  for (const promptCount of [2, 3, 4]){
    const withAi = music(build(EX, { aiCopy: ai, promptCount }, "story").pages), own = music(build(EX, { promptCount }, "story").pages);
    ok(withAi.indexOf("Tell me about the first record you bought.") >= 0, promptCount + " prompts: AI line missing");
    eq(withAi.indexOf("Where were you the first time you heard “Moon River”?"), own.indexOf("Where were you the first time you heard “Moon River”?"), "personal prompts still lead");
  }
});
check("the AI request carries no name that is on file, and no family, friends or pets", () => {
  const prof = Object.assign({}, EX, { proudMoments: ["Margaret’s pie won first prize", "Singing with Dorothy Lind", "Teaching Skipper to fetch", "Karl’s farm"] });
  const r = LJ.buildAiRequest(prof), all = r.system + r.user;
  ["Margaret", "Hansen", "Ellen", "Olson", "Ingrid", "Karl", "Arne", "Ruth", "Dorothy", "Lind", "Helen", "Berg", "Skipper", "Biscuit"]
    .forEach(n => ok(!new RegExp("\\b" + n + "\\b").test(all), "name leaked into the request: " + n));
  ok(r.user.indexOf("the resident’s pie won first prize") >= 0 && r.user.indexOf("Singing with a loved one") >= 0 && r.user.indexOf("Teaching a pet to fetch") >= 0, "names are replaced, not dropped");
  ok(r.user.indexOf("Duluth") >= 0 && r.user.indexOf("Elementary school teacher") >= 0, "other facts are included");
  ok(!/"(?:parents|siblings|friends|pets)"/.test(r.user), "family, friends and pets are left out");
  eq(r.system, LJ.TONE.SYSTEM_PROMPT, "system prompt");
});
check("the AI request respects the family's limits on service, religion and the old house", () => {
  const u = LJ.buildAiRequest(Object.assign({}, SERVICE, { avoid: ["religion", "home"] })).user;
  ok(u.indexOf("How Great Thou Art") < 0, "hymns sent although religion is avoided");
  ok(u.indexOf("Jefferson Street") < 0, "childhood home sent although it is avoided");
  ok(/"talkAboutDeployments":true/.test(u), "welcome service is marked as welcome");
  ok(/"militaryService":null/.test(LJ.buildAiRequest(Object.assign({}, SERVICE, { avoid: ["war"] })).user), "service sent although war is avoided");
});
check("the wording check advises on typed text without blocking the build", () => {
  const p = Object.assign({}, EX, { songs: ["Sweetie Pie song time"], skills: ["Circle time games"] });
  ok(LJ.checkProfile(p).length >= 2, "advice given");
  eq(build(p, {}, "story").count, LJ.countPages(p, {}).story, "still builds");
});

/* ---------- 2. Four sections and personalization ---------- */
const all = build(EX, {}, "complete"), allText = text(all.pages);
check("the four sections are the ones the journal promises, in order", () => {
  eq(LJ.DATA.SECTIONS.map(s => s.roman + " " + s.title).join(" | "),
    "I Early Roots & Identity | II Lifelong Work, Roles & Pride | III Sensory & Emotional Anchors | IV Daily Grounding & Reflection");
  const ids = all.spreads.map(s => s.id).join();
  eq(ids, "cover,identity,home,family,school,pets,firstjob,career,skills,community,pride,music,tastes,places,closing,opener,affirm,wisdom,joy,joy-2,joy-3,joy-4,divider,notes,notes-2", "spreads");
  all.pages.forEach(p => ok(new RegExp(`lj-sec-${p.tab}\\b|lj-notes\\b`).test(p.html) || p.role === "cover" || p.role === "closing", `page ${p.no} carries its section color`));
});
check("the resident's details are woven into the life story", () => {
  ["Margaret’s Life Story", "Margaret Ellen Hansen", "born Olson", "March 14, 1938, in Two Harbors, Minnesota", "Duluth, Minnesota", "the Olson family",
    "You were born into the Olson family. Tell me about them.", "Norwegian and Swedish farm families", "Tell me about the yellow house on Jefferson Street",
    "What did your street in Duluth, Minnesota, look and sound like?", "Tell me about your mother, Ingrid. What did you learn from her?",
    "Tell me about growing up with your brother, Arne.", "Dorothy Lind and Helen Berg", "What made Mrs. Lund a teacher you have never forgotten?",
    "Tell me about Skipper, your collie.", "Soda fountain clerk at Miller’s Drugstore", "As an elementary school teacher, what did a good day at work look like?",
    "What were you known for at Lincoln School?", "Who taught you knitting?", "Duluth Garden Club", "Teaching forty-one years of second graders to read",
    "Where were you the first time you heard “Moon River”?", "Where did you sing “How Great Thou Art”?", "Who made her mother’s apple pie best, and how?",
    "Lingonberry jam", "Cornflower blue", "Tell me about the Lake Superior shoreline.", "A soft wool shawl"].forEach(s => ok(allText.indexOf(s) >= 0, "missing: " + s));
});
check("Section IV: words of comfort, wisdom and a comfort and joy log", () => {
  ["You are safe here at Maple Grove Community.", "You are among people who know you and care about you.", "You are Margaret, and your story matters.",
    "Your work as an elementary school teacher made a difference to many people.", "The lessons you learned growing up in Duluth, Minnesota, are still yours.",
    "You taught hundreds of children to read.", "Measure twice, cut once.", "— Margaret", "Comfort & Joy", "This Week’s Small Joys"].forEach(s => ok(allText.indexOf(s) >= 0, "missing: " + s));
  const aff = LJ.textRuns(all.pages.filter(p => p.spreadId === "affirm" && p.side === "left")[0].body);
  ok(aff.indexOf("You are safe here at Maple Grove Community.") < aff.indexOf("You are Margaret, and your story matters."), "reassurance comes first");
  ok(text(build({}, {}, "reflection").pages).indexOf("Your work as") < 0, "an affirmation that needs a missing detail is left out");
  eq(LJ.affirmationText({}, "story"), "Your life story matters.", "the unnamed version");
});
check("military service: rank and places when welcome, gently when not, and never when avoided", () => {
  const svc = text(build(SERVICE, {}, "story").pages);
  ["In Service", "Petty Officer Second Class", "Tell me about your time in San Diego and Yokosuka, Japan.", "What did your time in the Navy teach you?"].forEach(s => ok(svc.indexOf(s) >= 0, "missing: " + s));
  const gentle = text(build(Object.assign({}, SERVICE, { militaryTalk: "gentle" }), {}, "story").pages);
  ok(gentle.indexOf("In Service") >= 0 && gentle.indexOf("San Diego") < 0 && gentle.indexOf("letters from home") < 0, "gentle service shows no deployments");
  for (const p of [Object.assign({}, SERVICE, { militaryTalk: "avoid" }), Object.assign({}, SERVICE, { avoid: ["war"] })]){
    const r = build(p, {}, "story");
    ok(text(r.pages).indexOf("In Service") < 0, "service page printed although avoided");
    eq(r.count, LJ.countPages(SERVICE, {}).story - 2, "the service spread is left out");
  }
});
check("topics to avoid remove their pages and prompts", () => {
  const hymns = Object.assign({}, EX, { avoid: ["religion"] });
  ok(text(build(hymns, {}, "complete").pages).indexOf("How Great Thou Art") < 0, "hymns printed although religion is avoided");
  const home = build(Object.assign({}, EX, { avoid: ["home"] }), {}, "story");
  ok(!home.spreads.some(s => s.id === "home"), "childhood home spread printed although “going home” is avoided");
  eq(home.count, LJ.countPages(EX, {}).story - 2, "home spread counted");
  const book = avoid => text(build({ name: "Ruth", avoid }, { promptCount: 4 }, "story").pages);
  ok(book([]).indexOf("first paycheck") >= 0 && book(["money"]).indexOf("first paycheck") < 0, "money prompt printed although money is avoided");
});
check("family is spoken of in the past tense of memory", () => {
  const fam = text(all.pages.filter(p => p.spreadId === "family"));
  ok(fam.indexOf("What did you learn from her?") >= 0 && fam.indexOf("What did you learn from him?") >= 0, "past-tense prompts");
  ok(!/\b(?:is|are) your\b|\bDo you remember\b/.test(allText), "a present-tense or quizzing prompt about the past");
});
check("an empty profile still builds complete, respectful pages", () => {
  const r = build({}, {}, "complete"), t = text(r.pages);
  eq(r.count, LJ.countPages({}, {}).complete, "count");
  ok(t.indexOf("A Life Story") >= 0, "generic title");
  ok(!/undefined|null|NaN|\[object/.test(r.pages.map(p => p.html).join("")), "no blanks leaked");
  ok(r.pages.filter(p => /lj-blank/.test(p.html)).length >= 5, "missing facts leave lines to write them in");
});
check("typed apostrophes, places and song titles print in the book's own style", () => {
  ok(allText.indexOf("Miller's") < 0 && allText.indexOf("Miller’s") >= 0, "smart apostrophes");
  ok(allText.indexOf("in Duluth, Minnesota, look") >= 0, "a place in mid-sentence keeps its closing comma");
  ok(allText.indexOf("“Moon River,” “Tennessee Waltz,” “Blue Moon”") >= 0, "commas inside the quotes");
});
check("the pets drawing follows the pets", () => {
  const art = pets => (/<svg[^>]*aria-label="([^"]*)"/.exec(build({ pets }, {}, "story").pages.filter(p => p.spreadId === "pets" && p.side === "left")[0].body) || [])[1];
  eq(art([{ name: "Skipper", kind: "collie" }]), "A dog sitting on a rug beside a bowl", "collie");
  eq(art([{ name: "Tom", kind: "Tabby cat" }, { name: "Rex", kind: "dog" }]), "A cat on a rug beside a bowl", "tabby first");
  eq(art([]), "A dog sitting on a rug beside a bowl", "no pets");
});
check("user text is escaped, never injected as markup", () => {
  const evil = "<img src=x onerror=alert(1)><script>alert(1)</script>";
  const r = build({ name: evil, fullName: evil, birthSurname: evil, hometown: evil, childhoodHome: evil, songs: [evil], wisdom: [evil], customAffirmations: [evil],
    parents: [{ name: evil, role: "mother" }], siblings: [{ name: evil, rel: "sister" }], pets: [{ name: evil, kind: evil }], militaryBranch: "navy", militaryRank: evil,
    militaryTalk: "welcome", militaryPlaces: evil, facility: evil }, {}, "complete");
  r.pages.forEach(p => ok(p.html.indexOf("<img") < 0 && p.html.indexOf("<script") < 0, "unescaped markup on page " + p.no));
});
check("builds are deterministic", () => eq(build(MAX, {}, "complete").pages.map(p => p.html).join(""), build(MAX, {}, "complete").pages.map(p => p.html).join("")));

/* ---------- 3. Audience split and print scopes ---------- */
for (const joyWeeks of [1, 4, 12]) for (const noteSpreads of [1, 2, 4]) check(`print scopes split the audiences cleanly (${joyWeeks} joy, ${noteSpreads} note spreads)`, () => {
  const o = { joyWeeks, noteSpreads };
  for (const prof of [EX, SERVICE]){
    const c = LJ.countPages(prof, o), st = build(prof, o, "story"), rf = build(prof, o, "reflection"), cp = build(prof, o, "complete");
    eq(st.count, c.story, "story count"); eq(rf.count, c.reflection, "reflection count"); eq(cp.count, c.complete, "complete count");
    eq(cp.count, st.count + rf.count, "complete = story + reflection");
    ok(st.pages.every(p => p.audience === "resident" && p.tab <= 3), "the life story holds only Sections I to III, for the resident");
    ok(rf.pages.every(p => p.tab === 4), "the reflection book holds only Section IV");
    const cg = rf.pages.map(p => p.audience === "caregiver"), first = cg.indexOf(true);
    ok(first > 0 && cg.slice(first).every(Boolean), "family and care team pages come last, all together, behind the resident's own pages");
    eq(rf.pages.filter(p => p.audience === "caregiver").length, 2 + 2 * noteSpreads, "notes pages");
    rf.pages.filter(p => p.audience === "caregiver").forEach(p => ok(/lj-notes/.test(p.html) && /For family and care team/.test(p.html), `page ${p.no} is marked for family and care team`));
    cp.pages.filter(p => p.audience === "resident").forEach(p => ok(!/For family and care team|Family &amp; Care Team Notes/.test(p.html), `resident page ${p.no} carries notes furniture`));
  }
});
check("the resident-facing book holds every resident page and no family or care team notes, at any tier", () => {
  for (const prof of [EX, SERVICE, {}]) for (const tier of TIERS){
    const o = { tier, joyWeeks: 4, noteSpreads: 2 }, rb = LJ.build(prof, o, "resident"), cp = LJ.build(prof, o, "complete");
    eq(rb.count, LJ.countPages(prof, o).resident, "resident count");
    ok(rb.pages.every(p => p.audience === "resident"), "only resident pages");
    eq(rb.count, cp.pages.filter(p => p.audience === "resident").length, "every resident page of the complete journal");
    ok(rb.pages.every(p => !/For family and care team|Family &amp; Care Team Notes/.test(p.html)), "no notes furniture");
  }
});
check("resident pages, Section IV included, have no clinical language, at any tier", () => {
  for (const prof of Object.values(PROFILES)) for (const tier of TIERS) LJ.build(prof, { tier }, "complete").pages.filter(p => p.audience === "resident").forEach(p =>
    LJ.textRuns(p.body).forEach(t => eq(audit(t, "resident").filter(h => h.rule === "clinical-leak").length, 0, `page ${p.no}: "${t}"`)));
});
check("the notes part tells visitors to add updates there and leave the story as it is", () => {
  const div = text(all.pages.filter(p => p.spreadId === "divider"));
  ok(div.indexOf("leave Margaret’s story pages as they are") >= 0, "divider guidance");
  ok(div.indexOf("Topics to steer around:") >= 0 && div.indexOf("war and combat") >= 0, "topics to avoid are passed on to visitors");
  ok(text(all.pages.filter(p => p.spreadId === "opener")).indexOf("add their notes in the part at the back") >= 0, "the resident's opener explains the notes part");
});

/* ---------- 4. Two-page spreads and gutters ---------- */
for (const scope of SCOPES) for (const binding of ["book", "binder"]) for (const pname of ["max", "service", "empty"]) for (const tier of TIERS) {
  check(`spreads: left pages even with something to look at, right pages odd with writing lines (${scope}, ${binding}, ${pname}, tier ${tier})`, () => {
    const r = LJ.build(PROFILES[pname], { binding, joyWeeks: 12, noteSpreads: 4, tier }, scope);
    eq(r.pages.filter(p => p.filler).length, 0, "filler pages");
    r.pages.forEach((p, i) => eq(p.no, i + 1, "page numbering"));
    r.spreads.forEach(sp => {
      if (sp.left == null || sp.right == null) return;
      const L = r.pages[sp.left], R = r.pages[sp.right];
      eq(L.no % 2, 0, sp.id + " left page even"); eq(R.no, L.no + 1, sp.id + " right page follows");
      eq(L.role, "visual", sp.id + " left role"); eq(R.role, "lines", sp.id + " right role");
      ok(/class="lp-rule\b|lp-tbl-tall/.test(R.html), sp.id + " right page has writing lines");
      if (L.audience === "resident"){
        ok(/class="lj-frame|class="lp-anchor|class="lp-choices/.test(L.html), sp.id + " left page has a picture or something to point to");
        // what the storybook's left pages offer, by tier: invitations (1), things to circle (2), one word and one picture (3)
        if (L.tab <= 3) ok(new RegExp(['class="lj-asks"', 'class="lp-choices"', 'class="lp-anchor'][tier - 1]).test(L.html), sp.id + " left page fits tier " + tier);
        ok(new RegExp("\\blp-t" + tier + "\\b").test(L.html) && new RegExp("\\blp-t" + tier + "\\b").test(R.html), sp.id + " pages carry their tier");
      }
    });
    r.pages.forEach(p => {
      const recto = binding === "binder" || p.no % 2 === 1;
      ok(p.html.indexOf(recto ? "lp-recto" : "lp-verso") >= 0, `page ${p.no} gutter side (${recto ? "recto" : "verso"})`);
    });
  });
}
check("photo mode swaps every drawing for an empty photo frame", () => {
  const r = build(EX, { art: "photo" }, "complete");
  ok(r.pages.every(p => !/lj-frame-art/.test(p.html)), "no drawings");
  ok(r.pages.filter(p => /lj-frame-photo/.test(p.html)).length >= 15, "photo frames");
});
check("the inner gutter is 0.75 in and mirrors correctly", () => {
  eq(LJ.STANDARDS.GUTTER_IN, 0.75);
  ok(/\.lp-sheet\{[^}]*--gut:\.75in/.test(lpCss), "--gut:.75in");
  ok(/\.lp-sheet\.lp-recto\{padding-left:var\(--gut\)\}/.test(lpCss) && /\.lp-sheet\.lp-verso\{padding-right:var\(--gut\)\}/.test(lpCss), "gutter sides");
  ok(!/padding(?:-left|-right)?:/.test(ljCss.split("/* ---------- Cognitive Life Journal screen")[0].match(/\.lj-sec-\d\{[^}]*\}|\.lj\{[^}]*\}/g).join("")), "journal pages do not override the gutter");
});

/* ---------- 5. Type floors, line pitch, color ---------- */
const printCss = ljCss.split("/* ---------- Cognitive Life Journal screen")[0];
check("no printed journal text is set below 14 pt", () => {
  const sizes = [...printCss.matchAll(/font(?:-size)?:\s*(?:\d+\s+)?([\d.]+)pt/g)].map(m => +m[1]);
  ok(sizes.length > 30, "font sizes found"); ok(Math.min(...sizes) >= LJ.STANDARDS.MIN_TEXT_PT, "min " + Math.min(...sizes));
});
check("journal headings are 16 pt or larger, and bold", () => {
  for (const h of ["lj-h1", "lj-band", "lj-roman"]){
    const rules = [...printCss.matchAll(new RegExp(`\\.${h}(?![\\w-])[^{]*\\{([^}]*)\\}`, "g"))].map(m => m[1]);
    ok(rules.length, "rules for ." + h);
    rules.forEach(r => { const m = /font-size:([\d.]+)pt/.exec(r); if (m) ok(+m[1] >= LJ.STANDARDS.MIN_HEAD_PT, `.${h} at ${m[1]}pt`); });
  }
  ok(/\.lj-band\{[^}]*font-weight:700/.test(printCss), "section band is bold");
  ok(all.pages.every(p => (p.body.match(/<h[1-3][^>]*>/g) || []).every(h => /class="(?:lp-h[123]|lp-cover-h)\b/.test(h))), "every heading uses a checked heading style");
});
check("writing lines are 0.5 in apart with a 2 pt stroke", () => {
  eq(LJ.STANDARDS.MIN_RULE_IN, 0.5);
  const printedPt = (n, unit) => unit === "px" ? Math.floor(+n) * .75 : Math.floor(+n / .75) * .75;   // borders print in whole CSS pixels
  const rule = /\.lp-rule\{height:([\d.]+)in;border-bottom:([\d.]+)(px|pt)/.exec(lpCss);
  ok(rule && +rule[1] >= LJ.STANDARDS.MIN_RULE_IN && printedPt(rule[2], rule[3]) >= LJ.STANDARDS.RULE_PT, "ruled line " + (rule && rule[1] + "in " + printedPt(rule[2], rule[3]) + "pt"));
  ok(!/\.lp-rule\{[^}]*height:\.[0-4]\d*in/.test(printCss), "the journal never tightens the lines");
  // the journal's own write-in blanks meet the same standard
  [...printCss.matchAll(/\.lj-[\w.-]* (?:[\w.-]+ )?[\w]*\.lj-blank\{([^}]*)\}/g)].forEach(m => {
    const h = /height:([\d.]+)in/.exec(m[1]); ok(!h || +h[1] >= LJ.STANDARDS.MIN_RULE_IN, "a write-in blank at " + (h && h[1]) + "in");
    const b = /border-bottom:([\d.]+)(px|pt)/.exec(m[1]); ok(!b || printedPt(b[1], b[2]) >= LJ.STANDARDS.RULE_PT, "a write-in blank prints at " + (b && printedPt(b[1], b[2])) + "pt");
  });
  const tall = /\.lp-tbl-tall td\{height:([\d.]+)in/.exec(lpCss);
  ok(tall && +tall[1] >= LJ.STANDARDS.MIN_RULE_IN, "table rows " + (tall && tall[1]));
});
check("the journal prints in the embedded Atkinson Hyperlegible, with no serif override", () => {
  eq(LJ.STANDARDS.PRINT_FONT, "Atkinson Hyperlegible");
  ok(!/font-family/.test(printCss), "no journal rule changes the face");
  ok(/\.lp-sheet\{[^}]*font:14pt\/1\.3 "Atkinson Hyperlegible",/.test(lpCss), "the shared sheet sets it");
});
check("section colors are fixed and readable at WCAG AAA (7:1)", () => {
  const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4)); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  for (const s of LJ.DATA.SECTIONS){
    ok(ratio(s.ink, s.tint) >= 7, `Section ${s.roman} ink on tint ${ratio(s.ink, s.tint).toFixed(2)}`);
    ok(ratio(s.ink, "#FFFFFF") >= 7, `Section ${s.roman} ink on white`);
    const m = new RegExp(`\\.lj-sec-${s.n}\\{--ink:(#[0-9A-Fa-f]{6});--tint:(#[0-9A-Fa-f]{6})`).exec(printCss);
    ok(m && m[1].toUpperCase() === s.ink.toUpperCase() && m[2].toUpperCase() === s.tint.toUpperCase(), `Section ${s.roman} CSS matches the engine`);
  }
});
check("High Contrast Mode reaches journal pages", () => {
  ok(all.pages.every(p => /^<section class="lp-sheet /.test(p.html)), "every page is an .lp-sheet");
  ok(/#printRoot\.pure-bw \.lp-sheet,#printRoot\.pure-bw \.lp-sheet \*\{color:#000!important;background:#fff!important;border-color:#000!important/.test(lpCss), "pure black and white rule");
  ok(!/!important/.test(printCss), "journal styles never outrank it");
});

/* ---------- 6. The screen is wired into the builder ---------- */
check("the sidebar, route, home card and Settings reach the journal", () => {
  ok(/<a class="sb-link" href="#\/journal" data-route="journal">[\s\S]*?Cognitive Life Journal/.test(html), "sidebar link");
  ok(/"journal": renderJournal/.test(html) && /function renderJournal\(\)\{ LifeJournalUI\.render\(view\); \}/.test(html), "route");
  ok(/<a class="card" href="#\/journal">|tool\("#\/journal"/.test(html), "home card");
  ok(/LifeJournalUI\.clearSaved\(\)/.test(html), "Clear saved data includes the journal");
  const at = id => html.indexOf(`<script id="${id}">`), main = html.indexOf('<script>\n"use strict";');
  ok(at("lp-engine") < at("lj-engine") && at("lj-engine") < at("kit-ui") && at("kit-ui") < at("lp-ui") && at("lp-ui") < at("lj-ui") && at("lj-ui") < main, "script order");
  const page = fs.readFileSync(path.join(ROOT, "cognitive-journals.html"), "utf8");
  ok(/href="builder\.html#\/journal"/.test(page), "cognitive-journals.html opens the generator");
});
check("the screen offers the four sections and keeps the dignity-first prompt in view", () => {
  const ui = block("script", "lj-ui");
  ok(/role="tablist"/.test(ui) && /aria-selected/.test(ui), "section tabs");
  ok(/LJ\.TONE\.SYSTEM_PROMPT/.test(ui), "system prompt shown");
  for (const k of ["hometown", "birthSurname", "militaryBranch", "career"]) ok(new RegExp(`data-p="\\$\\{key\\}"|"${k}"`).test(ui), "onboarding field " + k);
  ok(!/fetch\(|XMLHttpRequest|navigator\.sendBeacon|new WebSocket/.test(ui + block("script", "lj-engine") + block("script", "kit-ui")), "no network calls");
});

/* ---------- report ---------- */
const total = passed + failures.length;
if (failures.length){
  console.error(`Life Journal checks: ${failures.length} of ${total} FAILED`);
  failures.forEach(f => console.error("  ✗ " + f));
  process.exit(1);
}
console.log(`Life Journal checks: all ${total} passed.`);
