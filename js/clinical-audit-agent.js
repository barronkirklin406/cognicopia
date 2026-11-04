/* =====================================================================
   Clinical audit agent (ES module, offline-first, no dependencies).

   Fills the "audit" stage of the agent pipeline: every activity is read before
   it reaches a preview or a printer.

   Dignity. Adult relatives are written for, so baby talk and pet names
   ("honey", "sweetie", "good girl") are removed and childish words are replaced
   by adult ones.

   Errorless learning. A resident is invited, never tested and never corrected:
     - "Do you remember...", "Can you name...", "quiz", "test" become
       invitations ("Tell me about...", "conversation");
     - words that imply a wrong answer, a clock or a score ("wrong", "try again",
       "hurry", "timed") are replaced with "take your time" language or flagged;
     - a question that demands a fact ("What year...", "Who was...") is turned
       into an open invitation;
     - a choice needs two or more options and no "correct" one.

   Safety and claims. The three-step staff protocol and the validation safety
   notice must be present (a missing notice is added); resident print type is at
   least 18 pt; wording that promises a medical result ("cure", "treats",
   "clinically proven", "HIPAA compliant") blocks the sheet, and "ensures" becomes
   "supports".

   Result: status "pass" (nothing to change), "fixed" (everything found was
   repaired, listed in fixes) or "blocked" (something remains that a person must
   decide, listed in problems). A blocked sheet is still returned, so staff can see
   what to change, but a preview must not offer to print it.

   Use:
     import { ClinicalAuditAgent, auditAsset, auditText } from "./clinical-audit-agent.js";
     orchestrator.use(new ClinicalAuditAgent());
   ===================================================================== */
import { CognicopiaAgent, dignityProblems, validateAsset } from "./agent-orchestrator.js";

export const MIN_PT = 18;
export const SAFETY_NOTICE = "Affirm the resident's lived reality; never debate historical facts.";

/* [rule, pattern, replacement]. Applied in order; each is a plain adult-wording repair. */
const REWRITES = [
  ["elderspeak", /,\s*(honey|sweetie|dearie|dear|sweetheart|sugar|hon)\b(?=[,.!?]|\s|$)/gi, ""],
  ["elderspeak", /\b(honey|sweetie|dearie|sweetheart)\b[,!.]?\s*/gi, ""],
  ["elderspeak", /\bgood (girl|boy)\b[,!.]?\s*/gi, ""],
  ["elderspeak", /\bour (little )?(friend|resident)s?\b/gi, "the resident"],
  ["childish word", /\btummy\b/gi, "stomach"], ["childish word", /\bpotty\b/gi, "restroom"], ["childish word", /\byummy\b/gi, "tasty"], ["childish word", /\bboo-?boo\b/gi, "sore spot"], ["childish word", /\bnight-?night\b/gi, "good night"],
  ["recall question", /\bdo you remember (when |the time |how )?([^?.!]{3,80})\?/gi, (m, a, b) => "Tell me about " + (a ? (a.trim() === "how" ? "how " : "the time ") : "") + b.trim() + "."],
  ["recall question", /\bdo you remember\b/gi, "Tell me about"],
  ["recall question", /\bremember when\b/gi, "Tell me about the time"],
  ["recall question", /\bcan you (?:name|recall|tell me the name of)\s+([^?.!]{2,80})\?/gi, (m, b) => "Tell me about " + b.trim() + "."],
  ["quiz word", /\bquiz(zes)?\b/gi, "conversation"], ["quiz word", /\btest(s|ed|ing)?\b/gi, "activity"],
  ["failure word", /\btry again\b/gi, "take your time"], ["failure word", /\bhurry( up)?\b/gi, "take your time"], ["failure word", /\bcorrect answers?\b/gi, "answer"], ["failure word", /\b(right or wrong)\b/gi, "your choice"],
  ["failure word", /\b(timed|against the clock)\b/gi, "at your own pace"], ["failure word", /\bscore[sd]?\b/gi, "enjoyment"],
  ["overclaim", /\bensures?\b/gi, "supports"], ["overclaim", /\bguarantee[sd]?\b/gi, "supports"]
];
/* Things a person must decide: text is left as written and the sheet is blocked. */
const BLOCKERS = [
  ["medical promise", /\b(cures?|heals?|treats?|reverses?|prevents? (dementia|alzheimer)|clinically proven|proven to (improve|slow|stop))\b/i],
  ["compliance claim", /\bhipaa[- ]compliant\b/i],
  ["wrong-answer wording", /\b(wrong|incorrect|mistake|failed?|failure)\b/i],
  ["asks for a fact", /\b(what year|which year|what date|how old (are|were) you|what is today'?s date)\b/i]
];
const FACT_PROMPT = /^(what year|which year|when did|who was|who were|what was the name|where did the)\b/i;

/* Repair one string. Returns { text, fixes[], problems[] }. */
export function auditText(input) {
  let text = String(input == null ? "" : input), fixes = [];
  for (const [rule, re, rep] of REWRITES) {
    const before = text; text = text.replace(re, rep);
    if (text !== before) fixes.push({ rule });
  }
  text = text.replace(/\s{2,}/g, " ").replace(/\s+([,.!?])/g, "$1").replace(/^[,.\s]+/, "").trim();
  const problems = BLOCKERS.filter(([, re]) => re.test(text)).map(([rule]) => rule);
  dignityProblems(text).forEach((p) => problems.push(p));
  return { text, fixes, problems: [...new Set(problems)] };
}

/* Audit one activity (the shape validateAsset describes). The input is not changed; the cleaned copy is returned. */
export function auditAsset(asset) {
  const fixes = [], problems = [];
  const copy = JSON.parse(JSON.stringify(asset || {}));
  const structural = validateAsset(copy);
  const walk = (node, path) => {
    if (typeof node === "string") { const r = auditText(node); r.fixes.forEach((f) => fixes.push({ ...f, where: path })); r.problems.forEach((p) => problems.push({ rule: p, where: path })); return r.text; }
    if (Array.isArray(node)) return node.map((v, i) => walk(v, path + "[" + i + "]"));
    if (node && typeof node === "object") { const o = {}; for (const k of Object.keys(node)) o[k] = /^(id|type|kind|fontPt|order|sense|label|spec|grid|cells|safetyNotice)$/.test(k) ? node[k] : walk(node[k], path ? path + "." + k : k); return o; }
    return node;
  };
  /* a prompt that demands a fact is turned into an open invitation first, so it is repaired rather than reported */
  const blocks0 = copy.pages && copy.pages.resident && copy.pages.resident.blocks;
  (Array.isArray(blocks0) ? blocks0 : []).forEach((b, i) => {
    if (b && b.type === "prompts" && Array.isArray(b.items)) b.items = b.items.map((it, j) => { if (FACT_PROMPT.test(String(it).trim()) || /\b(what year|which year|what date)\b/i.test(String(it))) { fixes.push({ rule: "asks for a fact", where: `pages.resident.blocks[${i}].items[${j}]` }); return "Tell me what comes to mind."; } return it; });
  });
  if (copy.title) copy.title = walk(copy.title, "title");
  if (copy.theme) copy.theme = walk(copy.theme, "theme");
  if (copy.pages) copy.pages = walk(copy.pages, "pages");

  const res = copy.pages && copy.pages.resident;
  if (res) {
    if (!(res.fontPt >= MIN_PT)) { fixes.push({ rule: "print size", where: "pages.resident.fontPt" }); res.fontPt = MIN_PT; }
    (res.blocks || []).forEach((b, i) => {
      if (b.type === "choices") {
        const items = Array.isArray(b.items) ? b.items : [];
        if (!items.length || items.some((c) => !c || !c.a || !c.b)) problems.push({ rule: "a choice needs two options", where: `pages.resident.blocks[${i}]` });
        if (items.some((c) => c && ("correct" in c || "answer" in c))) problems.push({ rule: "a choice marks a right answer", where: `pages.resident.blocks[${i}]` });
      }
    });
  }
  const cg = copy.pages && copy.pages.caregiver;
  if (cg && !cg.safetyNotice) { cg.safetyNotice = SAFETY_NOTICE; fixes.push({ rule: "safety notice added", where: "pages.caregiver.safetyNotice" }); }
  else if (cg && cg.safetyNotice !== SAFETY_NOTICE && !/lived reality/i.test(cg.safetyNotice)) { problems.push({ rule: "the validation safety notice was changed", where: "pages.caregiver.safetyNotice" }); }
  structural.forEach((s) => { if (!/safety notice/.test(s) || !(cg && cg.safetyNotice)) problems.push({ rule: s, where: "asset" }); });

  const status = problems.length ? "blocked" : fixes.length ? "fixed" : "pass";
  return { status, asset: copy, fixes, problems };
}

export class ClinicalAuditAgent extends CognicopiaAgent {
  constructor(o = {}) {
    super({ name: "ClinicalAuditAgent", stage: "audit", role: "Clinical validation and dignity guard", goal: "Make sure nothing reaches a resident that tests, corrects, rushes, talks down to them or promises a medical result.", capabilities: ["dignity", "errorless-learning", "claims"], ...o });
  }
  async handle(ctx) {
    if (!ctx.asset) { ctx.audit = { status: "blocked", problems: [{ rule: "there was nothing to audit", where: "asset" }], fixes: [] }; return ctx; }
    const r = auditAsset(ctx.asset);
    ctx.asset = r.asset;
    ctx.audit = { status: r.status, fixes: r.fixes, problems: r.problems, by: this.name };
    return ctx;
  }
}
export default ClinicalAuditAgent;
