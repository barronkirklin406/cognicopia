#!/usr/bin/env node
/* =====================================================================
   12-Month Life Planner checks.  Run: npm test
   Loads the planner engine straight out of builder.html (the lp-engine
   block) and checks the rules the planner promises:
     - dignity-first tone guardrails, on every page and on AI copy
     - personalization reaches the pages; avoided topics and care-only
       dates never reach the memory book
     - the resident / caregiver audience split and the three print scopes
     - two-page spread parity (left = visual, right = writing lines)
     - print standards: 0.75 in inner gutter, 14 pt text and 16 pt bold
       heading floors, writing lines at least 0.4 in apart
     - season colors readable at WCAG AAA (7:1)
     - user text is escaped
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
const LP = sandbox.window.LifePlanner;
const css = block("style", "lp-css");

let passed = 0;
const failures = [];
function check(name, fn){
  try { const r = fn(); if (r === false) throw new Error("returned false"); passed++; }
  catch (e){ failures.push(name + ": " + e.message); }
}
function eq(a, b, what){ if (a !== b) throw new Error(`${what || "value"}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }
function ok(v, what){ if (!v) throw new Error(what || "expected true"); }

const EX = LP.EXAMPLE_PROFILE;
const OPTS = { year: 2027, startMonth: 0 };
const text = pages => pages.map(p => LP.textRuns(p.body).join(" ")).join("\n");
const SCOPES = ["memory", "companion", "binder"];

/* A worst-case profile: every field at its length and count limit. */
const long = (s, n) => (s + " ").repeat(20).slice(0, n);
const MAX = {
  name: long("Maximiliana", 30), fullName: long("Maximiliana Wilhelmina", 50), birthYear: 1931, hometown: long("Wawatosa-on-the-Mississippi", 40),
  profession: long("Mechanical engineer and railroad signal maintainer", 50),
  songs: Array.from({ length: 12 }, (_, i) => long("When the moon hits your eye " + i, 60)),
  genres: Array.from({ length: 6 }, (_, i) => long("Western swing " + i, 40)), hobbies: Array.from({ length: 8 }, (_, i) => long("Restoring furniture " + i, 40)),
  scents: Array.from({ length: 8 }, (_, i) => long("Pine boughs " + i, 45)), textures: Array.from({ length: 8 }, (_, i) => long("Worn leather " + i, 45)),
  foods: Array.from({ length: 10 }, (_, i) => long("Cardamom rolls " + i, 50)), meals: Array.from({ length: 10 }, (_, i) => long("Swedish meatballs " + i, 50)),
  family: ["great-grandchild", "grandchild", "other-family", "daughter", "son", "pet-other", "spouse", "sibling", "friend", "neighbor", "partner", "other"]
    .map((rel, i) => ({ name: long("Bartholomew " + i, 30), rel, passed: i === 6 })),
  milestones: Array.from({ length: 8 }, (_, i) => ({ year: 1940 + i * 5, text: long("Moved across the country to start a new job " + i, 70) })),
  dates: Array.from({ length: 16 }, (_, i) => ({ label: long("Birthday party celebration " + i, 40), month: i % 12 + 1, day: 28, year: 1950, audience: i === 15 ? "caregiver" : "resident" })),
  avoid: LP.DATA.AVOID_TOPICS.map(t => t[0]), facility: long("Wawatosa Memorial Memory Care", 60)
};
const PROFILES = { example: EX, empty: {}, max: MAX };

/* ---------- 1. Tone guardrails ---------- */
const audit = (s, audience) => LP.TONE.audit(s, { audience });
check("the built-in content library passes the dignity-first audit", () => {
  const bad = LP.libraryStrings().filter(s => audit(s, "resident").length);
  eq(bad.length, 0, "library strings breaking a rule: " + bad.join(" | "));
});
for (const [pname, prof] of Object.entries(PROFILES)) for (const copies of [1, 4]) {
  check(`every printed line passes the audit (${pname} profile, ${copies} log set${copies > 1 ? "s" : ""})`, () => {
    const v = LP.auditPages(LP.build(prof, Object.assign({ copies }, OPTS), "binder").pages);
    eq(v.length, 0, "violations " + JSON.stringify(v.slice(0, 3)));
  });
}
const MUST_FLAG = {
  "baby-talk": ["Time to fill your tummy", "Yummy lunch today", "Let's go potty", "Night-night, see you soon", "Oopsie, let me help"],
  "pet-name": ["Good morning, sweetie", "Here you go, honey.", "Thank you, dear.", "Hello young lady", "Nice work, kiddo"],
  "patronizing-we": ["How are we feeling today?", "Are we ready for our bath?", "Let's get you cleaned up", "Did we eat our lunch?"],
  "praise": ["Good job!", "Good girl", "You did it", "I'm so proud of you", "Earn a gold star"],
  "preschool": ["It's circle time", "Snack time at 3", "After nap time", "Arts and crafts hour", "Story time with Ruth"],
  "quizzing": ["Do you remember your wedding?", "Try to remember her name", "You already told me that", "No, that's wrong"],
  "labels": ["She suffers from dementia", "The elderly residents", "Enjoy your golden years", "He is a wanderer", "A senile old man"],
  "sing-song": ["Yay! Music time", "Woo-hoo, cake", "Hooray for Friday"],
  "exclaim": ["What a lovely day!! Truly!"],
  "emoji": ["Lovely day \u{1F60A}"],
  "medical-claim": ["This activity slows dementia", "Clinically proven to help", "Reverses memory loss"],
  "clinical-leak": ["Dementia care starts here", "Ask the care team", "Medication at noon"]
};
for (const [rule, lines] of Object.entries(MUST_FLAG)) check(`the audit catches ${rule}`, () => {
  lines.forEach(s => ok(audit(s, "resident").some(h => h.rule === rule), `"${s}" was not flagged as ${rule}`));
});
check("the audit does not flag plain, respectful adult language", () => {
  const clean = ["Dear Margaret,", "Honey-glazed ham with carrots", "Retired after 41 years in the classroom", "Tell me about your daughter, Anna.",
    "What was harvest time like around Duluth?", "A warm cup of tea and a good book", "She played piano at the Good Shepherd church",
    "Which holiday song brings back the strongest feelings?", "Tea with honey and lemon", "Gardening and fresh air", "Remembering Walter with love"];
  clean.forEach(s => eq(audit(s, "resident").map(h => h.rule).join(), "", `"${s}"`));
});
check("caregiver pages may use care words that resident pages may not", () => {
  eq(audit("Share updates with the care team.", "caregiver").length, 0);
  ok(audit("Share updates with the care team.", "resident").length > 0);
});
check("the system prompt forbids infantilizing, patronizing and quizzing language", () => {
  const p = LP.TONE.SYSTEM_PROMPT;
  ["DIGNITY FIRST", "Infantilizing", "Pet names", "patronizing \"we\"", "Do you remember", "Never invent", "Return only the JSON"].forEach(k => ok(p.indexOf(k) >= 0, "missing: " + k));
  ok(LP.TONE.RULES.length >= 12, "at least 12 audit rules");
});
check("AI copy: failing lines are dropped, clean lines are kept", () => {
  const r = LP.acceptAiCopy({ months: [
    { index: 0, blurb: "A calm month for warm quilts and familiar music.", prompts: ["Tell me about a winter coat you loved.", "Do you remember your first snow day?", "Yay! Snow time!!"],
      sense: { music: "Nat King Cole", scent: "Sweetie, smell the cinnamon", texture: "A wool blanket", food: "Yummy soup" } },
    { index: 99, blurb: "ignored" }, { index: "3", blurb: 42, prompts: "not a list" }] });
  const m0 = r.copy.months[0];
  eq(m0.prompts.length, 1, "kept prompts"); eq(m0.prompts[0], "Tell me about a winter coat you loved.");
  eq(m0.sense.scent, undefined, "patronizing scent dropped"); eq(m0.sense.food, undefined, "baby-talk food dropped");
  eq(m0.sense.music, "Nat King Cole"); eq(r.copy.months[99], undefined, "out-of-range month ignored");
  ok(r.rejected.length >= 4, "rejected lines are reported");
});
check("AI copy that passed the audit reaches the month page, and only there", () => {
  const ai = LP.acceptAiCopy({ months: [{ index: 0, blurb: "Frosted windows, warm soup and old friends.", prompts: ["Tell me about sledding on your street."] }] }).copy;
  const res = LP.build(EX, Object.assign({ aiCopy: ai }, OPTS), "memory"), jan = res.pages.filter(p => p.title === "January");
  ok(text(jan).indexOf("Frosted windows, warm soup and old friends.") >= 0, "AI blurb printed");
  ok(text(jan).indexOf("Tell me about sledding on your street.") >= 0, "AI prompt printed");
});
check("the AI request never contains the resident's name", () => {
  const r = LP.buildAiRequest(Object.assign({}, EX, { foods: ["Margaret’s own apple pie"] }), OPTS), all = r.system + r.user;
  ok(!/Margaret|Hansen|Ellen/.test(all), "name leaked into the request");
  ok(r.user.indexOf("Duluth") >= 0, "other facts are included");
  eq(r.system, LP.TONE.SYSTEM_PROMPT, "system prompt");
});
check("the wording check advises on typed text without blocking the build", () => {
  const p = Object.assign({}, EX, { songs: ["Sweetie Pie song time"], hobbies: ["Circle time games"] });
  ok(LP.checkProfile(p).length >= 2, "advice given");
  ok(LP.build(p, OPTS, "memory").count === 32, "still builds");
});

/* ---------- 2. Personalization ---------- */
const mem = LP.build(EX, OPTS, "memory"), memText = text(mem.pages);
check("the resident's details are woven into the memory book", () => {
  ["Margaret’s Life Planner", "Margaret Ellen Hansen", "Duluth, Minnesota", "Elementary school teacher", "1938", "“Moon River”",
    "Began teaching second grade at Lincoln School", "Tell me about your daughter, Anna.", "Anna’s birthday (turns 63)", "Wedding anniversary (66th)",
    "Lavender", "A soft wool shawl", "Her mother’s apple pie", "As an elementary school teacher"].forEach(s => ok(memText.indexOf(s) >= 0, "missing: " + s));
});
check("all twelve monthly modules are present, January Winter Warmth to December Holiday Glow", () => {
  const themes = LP.DATA.MONTH_THEMES.map(m => m.theme);
  eq(themes[0], "Winter Warmth"); eq(themes[11], "Holiday Glow"); eq(new Set(themes).size, 12, "distinct themes");
  themes.forEach(t => ok(memText.indexOf(t) >= 0, "missing theme " + t));
});
check("people who have passed away are never prompted or listed as current in the memory book", () => {
  ok(!/Tell me about [^.]*Walter/.test(memText), "Walter prompted");
  ok(!/Tell me about your spouse/.test(memText), "a passed spouse was prompted");
  const story = mem.pages.filter(p => p.spreadId === "story" && p.role === "visual")[0];
  const people = (/<ul class="lp-people">([\s\S]*?)<\/ul>/.exec(story.body) || [])[1] || "";
  ok(people.indexOf("Anna") >= 0, "living people listed");
  ok(people.indexOf("Walter") < 0, "a person who has passed away is listed among current people");
});
check("care-team-only dates never print in the memory book", () => {
  ok(memText.indexOf("memorial") < 0, "memorial date leaked into the memory book");
  ok(text(LP.build(EX, OPTS, "companion").pages).indexOf("Walter’s memorial day") >= 0, "memorial date missing from the companion");
});
check("topics to avoid remove their prompts", () => {
  const o = Object.assign({ promptCount: 4 }, OPTS), topics = ["swim or cool off", "thunderstorm", "hymn"];
  const book = avoid => text(LP.build({ name: "Ruth", avoid }, o, "memory").pages);
  const all = book([]), some = book(["water", "storms", "religion"]);
  topics.forEach(s => ok(all.indexOf(s) >= 0, "control prompt missing: " + s));
  topics.forEach(s => ok(some.indexOf(s) < 0, "avoided topic printed: " + s));
  ok(some.indexOf("road trip") >= 0, "the next prompt takes the freed place");
  ok(book(["water", "storms", "religion", "driving"]).indexOf("road trip") < 0, "avoided topic printed: road trip");
});
check("every month keeps a seasonal prompt, even for a detailed profile", () => {
  mem.pages.filter(p => p.tab === 2 && p.role === "visual").forEach(pg => {
    const theme = LP.DATA.MONTH_THEMES.filter(m => m.name === pg.title)[0];
    ok(theme, "month page " + pg.title);
    const asks = (/<ol class="lp-asks">([\s\S]*?)<\/ol>/.exec(pg.body) || [])[1] || "";
    ok(!/^(?:<li>(?:This month:|Tell me about your |Tell me about [A-Z]\w+, your |\d{4}: |As an? )[^<]*<\/li>)+$/.test(asks), pg.title + " has only personal prompts");
  });
});
check("an empty profile still builds complete, respectful pages", () => {
  const r = LP.build({}, OPTS, "binder");
  eq(r.count, 47); ok(text(r.pages).indexOf("Your Life Planner") >= 0, "generic title"); ok(text(r.pages).indexOf("undefined") < 0 && text(r.pages).indexOf("null") < 0, "no blanks leaked");
});
check("user text is escaped, never injected as markup", () => {
  const evil = "<img src=x onerror=alert(1)><script>alert(1)</script>";
  const r = LP.build({ name: evil, hometown: evil, songs: [evil], family: [{ name: evil, rel: "son" }], dates: [{ label: evil, month: 1, day: 1 }] }, OPTS, "binder");
  r.pages.forEach(p => ok(p.html.indexOf("<img") < 0 && p.html.indexOf("<script") < 0, "unescaped markup on page " + p.no));
});
check("builds are deterministic", () => eq(LP.build(EX, OPTS, "binder").pages.map(p => p.html).join(""), LP.build(EX, OPTS, "binder").pages.map(p => p.html).join("")));

/* ---------- 3. Audience split and print scopes ---------- */
for (const copies of [1, 4, 12]) check(`print scopes split the audiences cleanly (${copies} log set${copies > 1 ? "s" : ""})`, () => {
  const o = Object.assign({ copies }, OPTS), c = LP.countPages(o);
  const m = LP.build(EX, o, "memory"), cg = LP.build(EX, o, "companion"), b = LP.build(EX, o, "binder");
  eq(m.count, c.memory, "memory count"); eq(cg.count, c.companion, "companion count"); eq(b.count, c.binder, "binder count");
  eq(b.count, m.count + cg.count, "binder = memory + companion");
  ok(m.pages.every(p => p.audience === "resident" && p.tab <= 2), "memory book holds only resident pages");
  ok(cg.pages.every(p => p.audience === "caregiver" && p.tab >= 3), "companion holds only caregiver pages");
  ok(cg.pages.every(p => /Confidential/.test(p.html)), "every caregiver page says Confidential");
  ok(m.pages.every(p => !/Caregiver Companion|Confidential/.test(p.html)), "no caregiver furniture in the memory book");
});
check("the resident memory book has no clinical language", () => {
  mem.pages.forEach(p => LP.textRuns(p.body).forEach(t => eq(audit(t, "resident").filter(h => h.rule === "clinical-leak").length, 0, `page ${p.no}: "${t}"`)));
});
check("all four tabs are covered", () => {
  const tabs = new Set(LP.build(EX, OPTS, "binder").pages.map(p => p.tab));
  [1, 2, 3, 4].forEach(t => ok(tabs.has(t), "tab " + t));
});

/* ---------- 4. Two-page spread logic and gutters ---------- */
for (const scope of SCOPES) for (const binding of ["book", "binder"]) for (const copies of [1, 12]) {
  check(`spreads: left pages even and visual, right pages odd with writing lines (${scope}, ${binding}, ${copies})`, () => {
    const r = LP.build(MAX, Object.assign({ binding, copies }, OPTS), scope);
    eq(r.pages.filter(p => p.filler).length, 0, "filler pages");
    r.pages.forEach((p, i) => eq(p.no, i + 1, "page numbering"));
    r.spreads.forEach(sp => {
      if (sp.left != null && sp.right != null){
        const L = r.pages[sp.left], R = r.pages[sp.right];
        eq(L.no % 2, 0, sp.id + " left page even"); eq(R.no, L.no + 1, sp.id + " right page follows");
        eq(L.role, "visual", sp.id + " left role"); eq(R.role, "lines", sp.id + " right role");
      }
    });
    r.pages.forEach(p => {
      const recto = binding === "binder" || p.no % 2 === 1;
      ok(p.html.indexOf(recto ? "lp-recto" : "lp-verso") >= 0, `page ${p.no} gutter side (${recto ? "recto" : "verso"})`);
    });
  });
}
check("the inner gutter is 0.75 in and mirrors correctly", () => {
  eq(LP.STANDARDS.GUTTER_IN, 0.75);
  ok(/\.lp-sheet\{[^}]*--gut:\.75in/.test(css), "--gut:.75in");
  ok(/\.lp-sheet\.lp-recto\{padding-left:var\(--gut\)\}/.test(css), "recto gutter on the left");
  ok(/\.lp-sheet\.lp-verso\{padding-right:var\(--gut\)\}/.test(css), "verso gutter on the right");
  ok(/\.lp-sheet\{[^}]*width:8\.5in; height:11in/.test(css), "US Letter sheet");
});

/* ---------- 5. Type floors, line pitch, color ---------- */
const printCss = css.split("/* ---------- 12-Month Life Planner screen")[0];
check("no printed text is set below 14 pt", () => {
  const sizes = [...printCss.matchAll(/font(?:-size)?:\s*(?:\d+\s+)?([\d.]+)pt/g)].map(m => +m[1]);
  ok(sizes.length > 40, "font sizes found"); eq(Math.min(...sizes) >= LP.STANDARDS.MIN_TEXT_PT, true, "min " + Math.min(...sizes));
});
check("headings are 16 pt or larger, and bold", () => {
  const heads = ["lp-h1", "lp-h2", "lp-h3", "lp-mtitle", "lp-mtheme", "lp-cover-h"];
  heads.forEach(h => {
    const rules = [...printCss.matchAll(new RegExp(`\\.${h}(?![\\w-])[^{]*\\{([^}]*)\\}`, "g"))].map(m => m[1]);
    ok(rules.length, "rules for ." + h);
    rules.forEach(r => { const m = /font-size:([\d.]+)pt/.exec(r); if (m) ok(+m[1] >= LP.STANDARDS.MIN_HEAD_PT, `.${h} at ${m[1]}pt`); });
  });
  ok(/\.lp-h1\{[^}]*font-weight:700/.test(printCss) && /\.lp-h2\{[^}]*font-weight:700/.test(printCss) && /\.lp-h3\{[^}]*font-weight:700/.test(printCss), "bold headings");
});
check("writing lines are at least 0.4 in apart, table rows at least 0.4 in tall", () => {
  const rule = /\.lp-rule\{height:([\d.]+)in/.exec(printCss);
  ok(rule && +rule[1] >= LP.STANDARDS.MIN_RULE_IN, "ruled line pitch " + (rule && rule[1]));
  [...printCss.matchAll(/\.lp-tbl[^{]*\b(?:td|th)[^{]*\{[^}]*height:([\d.]+)in/g)].forEach(m => ok(+m[1] >= .4, "table row " + m[1] + "in"));
  const wheelMin = /\.lp-wheel-box\{[^}]*min-height:([\d.]+)in/.exec(printCss);
  const svgSizes = [...LP.build(MAX, OPTS, "memory").pages[1].html.matchAll(/font-size="([\d.]+)"/g)].map(m => +m[1]);
  ok(wheelMin && Math.min(...svgSizes) / 560 * +wheelMin[1] * 72 >= 14, "year wheel labels stay at 14 pt or more at the smallest wheel size");
});
check("season colors are fixed and readable at WCAG AAA (7:1)", () => {
  const S = LP.DATA.SEASONS;
  eq([S.spring.color, S.summer.color, S.autumn.color, S.winter.color].join(), "Green,Yellow,Orange,Blue");
  const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4)); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  for (const k of Object.keys(S)){
    ok(ratio(S[k].ink, S[k].tint) >= 7, `${k} ink on tint ${ratio(S[k].ink, S[k].tint).toFixed(2)}`);
    ok(ratio(S[k].ink, "#FFFFFF") >= 7, `${k} ink on white`);
    const m = new RegExp(`\\.lp-s-${k}\\{--ink:(#[0-9A-Fa-f]{6});--tint:(#[0-9A-Fa-f]{6})`).exec(printCss);
    ok(m && m[1].toUpperCase() === S[k].ink.toUpperCase() && m[2].toUpperCase() === S[k].tint.toUpperCase(), `${k} CSS matches the engine`);
  }
  for (let m = 0; m < 12; m++) eq(LP.DATA.SEASONS[LP.DATA.seasonOfMonth(m)].key, ["winter", "winter", "spring", "spring", "spring", "summer", "summer", "summer", "autumn", "autumn", "autumn", "winter"][m], "month " + m);
});
check("High Contrast Mode forces pure black and white, pseudo-elements included", () => {
  ok(/#printRoot\.pure-bw \.lp-sheet,#printRoot\.pure-bw \.lp-sheet \*\{color:#000!important;background:#fff!important;border-color:#000!important/.test(printCss), "base rule");
  ok(/#printRoot\.pure-bw \.lp-sheet \*::before,#printRoot\.pure-bw \.lp-sheet \*::after\{[^}]*border-color:#000!important/.test(printCss), "pseudo-elements");
  ok(/\[fill\]\[data-bw="white"\]:not\(\[fill="none"\]\)\{fill:#fff!important\}/.test(printCss), "white shapes stay white");
});

/* ---------- report ---------- */
const total = passed + failures.length;
if (failures.length){
  console.error(`Life Planner checks: ${failures.length} of ${total} FAILED`);
  failures.forEach(f => console.error("  ✗ " + f));
  process.exit(1);
}
console.log(`Life Planner checks: all ${total} passed.`);
