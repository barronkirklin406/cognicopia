/* Academy scenario trees: short branching practice for care teams on behavioral distress in dementia care.

   A learner reads a situation and chooses what to do. Every choice is answered with a plain reason, and the story goes on, so a less helpful
   first move still ends in a repair. Each choice is worth 2 (the approach the training teaches), 1 (reasonable, but better done after another
   step) or 0 (likely to raise the distress). A scenario is passed at 75% or more of the points available on the path taken. Passing earns a
   completion certificate for that scenario; passing all of them earns a series certificate.

   The scenarios are made-up situations with no real person in them. They are in-service training, not clinical advice: a facility's own
   policies, each resident's care plan and the nurse's judgment come first, and a certificate is a training record, not accredited credit. */

export const SCHEMA = "cognicopia.academy.scenarios", VERSION = 1, STORE_KEY = "cognicopia_academy_scenarios", PASS = 0.75;
export const NOT_ACCREDITED = "In-service training record. This is not accredited continuing education: it counts toward a license or certification only where your facility's education program or an approving body accepts it.";

const c = (id, text, next, quality, feedback) => ({ id, text, next, quality, feedback });
const end = (text, record) => ({ end: true, text, record });

export const SCENARIOS = Object.freeze([
  { id: "dusk", title: "Restless in the late afternoon", minutes: 6, summary: "A resident who was calm all day starts pacing at dusk and tries the exit door.", start: "a1", nodes: {
    a1: { text: "At about 4:30 in the afternoon, a resident who has been calm all day begins pacing the hall, tries the exit door and says, “I have to collect the children from school.” They are getting louder. What do you do first?", choices: [
      c("a", "Walk alongside them, keep your voice low and say you can hear how much the children matter to them.", "a2", 2, "Joining the feeling, not arguing with the facts, lowers tension. The worry is real even when the reason for it is from long ago."),
      c("b", "Check for basic needs: the toilet, thirst, hunger, pain, a glare from the window, a noisy room.", "a2", 1, "Unmet needs are often behind distress, so this is worth doing. It works best after you have connected, because someone in distress cannot answer questions."),
      c("c", "Tell them the children are grown up and it is not a school day.", "a1x", 0, "Correcting someone who is frightened tends to make them feel unheard, and the news can land as if it were new."),
      c("d", "Guide them firmly back to their chair and ask them to sit down.", "a1x", 0, "Being steered against their will can feel threatening and often adds to the urge to leave.")] },
    a1x: { text: "They pull away and call out more loudly. Other residents are looking over. How do you repair this?", choices: [
      c("a", "Slow down, step back to give room, lower your voice and say, “I can see you are worried. I am here with you.”", "a2", 2, "A calm, unhurried presence is the repair. Room, a low voice and acknowledging the feeling show you are on their side."),
      c("b", "Explain again, more firmly, why they have to stay.", "a2", 0, "More explanation to someone who is overwhelmed adds noise. Their distress, not the facts, needs the answer.")] },
    a2: { text: "They slow down but still look toward the door. What next?", choices: [
      c("a", "Invite them into something purposeful and familiar: “Would you help me fold these towels while we wait?”", "a3", 2, "Simple, meaningful tasks give a person a role and a sense of being useful. It invites; it does not test."),
      c("b", "Offer a drink or a snack and sit with them.", "a3", 1, "Comfort and company help. Pair it with something to do or something to talk about."),
      c("c", "Ask, “Do you remember where you live now?”", "a2x", 0, "Quizzing someone who is distressed puts them on the spot and can deepen the confusion and embarrassment.")] },
    a2x: { text: "They look at you blankly, then upset. You realize the question did not help. What do you do?", choices: [
      c("a", "Apologize simply, then offer something to do together: “I am sorry. Would you like to help me with these towels?”", "a3", 2, "A short apology and a return to something calm and shared restores trust."),
      c("b", "Ask the question again in other words.", "a3", 0, "Asking again keeps the pressure on. Move from questions to doing something together.")] },
    a3: { text: "They are calmer. What could you change so tomorrow’s late afternoon goes more easily?", choices: [
      c("a", "Turn lamps on before dusk, lower the television, play familiar music and plan a calm task for that hour.", "a4", 2, "Light, noise and routine strongly affect the late afternoon. Planning ahead is better than reacting."),
      c("b", "Keep talking with them and see how it goes.", "a4", 1, "Company helps today. The next shift is helped more by changing the setting and the plan."),
      c("c", "Skip the other steps and ask for a medicine first.", "a4", 0, "Medicines are decisions for the nurse and the care team, usually after checks and non-drug approaches. Report what you saw and what helped.")] },
    a4: end("The resident is settled and folding towels. On the Shift board, record what helped (for example, “folding towels at 4:30 settled them”) so the next shift can offer it early. Tell the nurse about the change in the late afternoon so it can be looked into.", "Joined the feeling, met needs, offered a purposeful task, changed the setting and recorded what helped.") } },

  { id: "bath", title: "“No, get out!” at bath time", minutes: 6, summary: "A resident says no and pushes the door shut when it is time for a shower.", start: "b1", nodes: {
    b1: { text: "It is shower day. You knock and say good morning. The resident says, “No! Get out!” and pushes the bathroom door closed. What do you do?", choices: [
      c("a", "Step back, say, “I will give you a few minutes,” and come back with a calm hello and a different offer.", "b2", 2, "Backing off keeps the moment from becoming a struggle. A no is often about timing, privacy, cold, or feeling rushed."),
      c("b", "Explain that the shower is on the schedule and has to be done.", "b1x", 0, "A schedule is not a reason that matters to the person. Pressing on a no can lead to fear and distress."),
      c("c", "Say you will be quick and open the door.", "b1x", 0, "Entering against a clear no takes away their say over their own body.")] },
    b1x: { text: "They raise their voice and cover their body with their arms. What do you do now?", choices: [
      c("a", "Stop, apologize and say, “I am sorry. You do not have to do anything right now.” Step out and try again later.", "b2", 2, "Stopping right away respects their no and protects their dignity. You can try again."),
      c("b", "Ask a colleague to help hold them still.", "b2", 0, "Physical restraint is never a way to complete personal care. Stop and use another approach, and tell the nurse.")] },
    b2: { text: "When you return, they seem less upset. Before the shower, what do you think about?", choices: [
      c("a", "A warm room, a towel over the shoulders, a gentle offer, “Would you like a wash at the sink first, or the shower?” and the time of day they like best.", "b3", 2, "Warmth, privacy and choices put the person in charge. Fear of cold and of being exposed are common reasons for saying no."),
      c("b", "Making the bathroom ready quickly so it is over faster.", "b3", 1, "A quick job can help, but rushing is part of what frightens people. Offer choices as well."),
      c("c", "Tell them it will be good for them and they will feel better.", "b3", 0, "Persuading about what is good for them can sound like a command. Offer a choice they can say yes to.")] },
    b3: { text: "They say, “Not the shower. I will wash my face.” What do you do?", choices: [
      c("a", "Say yes: help with a face and hands wash at the sink, and let them do what they can themselves.", "b4", 2, "Saying yes to what they offer keeps their trust. A partial wash is better than none done by force, and the shower can wait for another day."),
      c("b", "Say that a wash at the sink is not enough and insist on the shower.", "b4", 0, "Insisting after they have found a way to say yes turns a good moment into a struggle."),
      c("c", "Do the wash for them quickly, without asking.", "b4", 1, "It gets the job done, but doing for someone what they can do themselves takes away dignity and skills they still have.")] },
    b4: end("The resident has washed with help and kept their dignity. Tell the next shift what worked (time of day, warm room, a sink wash first) and let the nurse know when a no keeps coming back, because pain, a skin problem or fear may be behind them.", "Respected the no, tried again later, offered choices and a partial wash, and shared what worked.") } },

  { id: "purse", title: "“Someone has taken my purse”", minutes: 5, summary: "A resident cannot find an item and believes it was stolen.", start: "p1", nodes: {
    p1: { text: "A resident is upset. “My purse is gone. Somebody took it. I want to know who!” They look at you suspiciously. What do you say?", choices: [
      c("a", "“That sounds worrying. Your purse matters to you. Let us look for it together.”", "p2", 2, "Acknowledging how important it is, and offering to help, puts you on their side. You do not have to agree that anyone took it."),
      c("b", "“Nobody took your purse. You always lose things.”", "p1x", 0, "Telling them they are wrong, or that they lose things, is hurtful and tends to make them more certain they are being accused."),
      c("c", "“I will check the cameras.”", "p1x", 0, "Going along with a theft story can feed worry and suspicion, and it is not a promise that can be kept.")] },
    p1x: { text: "They say you are against them too. How do you repair this?", choices: [
      c("a", "“I am sorry. I am on your side. Let us look for it together.”", "p2", 2, "A simple apology and an offer to help lowers the temperature."),
      c("b", "Walk away and let them calm down on their own.", "p2", 0, "Leaving someone alone with a fear can leave them more upset. Stay close and quiet.")] },
    p2: { text: "As you look, where do you start?", choices: [
      c("a", "The places they usually keep it: the bedside drawer, the closet shelf, a favourite chair, a coat pocket.", "p3", 2, "Misplaced things are often in a familiar hiding place. Looking together shows care and often finds the item."),
      c("b", "Search quickly through the whole room on your own while they wait in the hall.", "p3", 1, "It may find it, but searching without them can feel like being left out of their own belongings."),
      c("c", "Ask them to try to remember where they put it last.", "p3", 0, "Asking them to recall puts them on the spot and often adds distress.")] },
    p3: { text: "The purse is in the closet under a sweater. They take it and are relieved. What else helps?", choices: [
      c("a", "Say, “I am glad we found it,” and think about a second, similar purse or a regular habit of checking the usual spot together.", "p4", 2, "Looking ahead eases the next time. A duplicate or a routine check can prevent a repeat."),
      c("b", "Remind them not to put it away in odd places.", "p4", 0, "Gentle correction after a stressful moment sounds like blame. Plan around the habit instead."),
      c("c", "Let it go and say nothing more.", "p4", 1, "The moment is over, which is good. A small plan can help next time, and the team may want to know.")] },
    p4: end("The purse is found and trust is intact. Record on the Shift board what helped (looking together, the usual spots) and, if the missing-item worry keeps returning, tell the nurse and follow your facility’s policy for reports of missing belongings.", "Validated the worry, looked together in the usual places and made a plan for next time.") } },

  { id: "walter", title: "Asking for someone who has died", minutes: 6, summary: "A resident repeatedly asks where their late spouse is.", start: "w1", nodes: {
    w1: { text: "A resident asks you for the third time this morning, “Where is Walter? He should be here by now.” Their spouse died several years ago. First, what do you think about?", choices: [
      c("a", "What the care plan and the family say about how to respond, and what feeling is behind the question: missing him, worry, or wanting company.", "w2", 2, "Many families and facilities agree on an approach ahead of time. The feeling behind the question is what you can always answer."),
      c("b", "Tell them plainly that Walter has died.", "w1x", 0, "Giving the news as if it were new, again and again, can bring the grief back each time."),
      c("c", "Tell them he will be here soon.", "w1x", 0, "A promise that cannot be kept can lead to waiting and then disappointment, and it is not honest.")] },
    w1x: { text: "They become tearful, then upset, and ask again a few minutes later. What do you try now?", choices: [
      c("a", "Sit with them and say, “You are thinking about Walter. Tell me about him.”", "w2", 2, "Asking about the person turns the moment toward memory and connection, which the person can still enjoy."),
      c("b", "Change the subject quickly to the weather.", "w2", 1, "A distraction can help a moment pass, but a quick change can feel like being brushed off. Pair it with warmth.")] },
    w2: { text: "How do you respond to them now?", choices: [
      c("a", "“You miss him. What was he like?” Listen to the story and share the feeling with them.", "w3", 2, "Answering the feeling, and inviting a story, keeps them company without testing them or giving the news again."),
      c("b", "Ask, “Do you remember that he passed away?”", "w3", 0, "A question like that is a test, and it can feel unkind. Invite, never quiz."),
      c("c", "Say you will check on him and walk away.", "w3", 0, "It leaves them waiting. Stay with the feeling instead.")] },
    w3: { text: "They are telling you about a dance they went to with Walter. How do you keep this going?", choices: [
      c("a", "Offer a photo or a favourite song from that time, or invite them to share it with others at tea.", "w4", 2, "Familiar music and photos connect to the years that mean the most and bring comfort."),
      c("b", "Listen, then turn to another task when they pause.", "w4", 1, "A gentle close is fine. Offering a photo or a song gives them something to hold on to.")] },
    w4: end("They are comforted and have shared a happy memory. Tell the team what helped (the song, the photo, the story about the dance). If the question returns often or the distress is deep, tell the nurse and the family so the whole team answers in the same gentle way.", "Answered the feeling, invited the story, and offered music and a photograph.") } }
]);
export const scenarioOf = (id) => SCENARIOS.find((s) => s.id === id) || null;

/* ---- walking a scenario ---------------------------------------------------------------------------------------------------------------------- */
export const start = (id) => { const s = scenarioOf(id); if (!s) return null; return { scenario: id, node: s.start, steps: [], done: false }; };
/* Make a choice. Returns a new state and the reason for the choice, or null if the choice is not on this screen. */
export function choose(state, choiceId) {
  const s = state && scenarioOf(state.scenario), node = s && s.nodes[state.node]; if (!node || node.end || state.done) return null;
  const ch = node.choices.find((x) => x.id === choiceId); if (!ch) return null;
  const next = s.nodes[ch.next], steps = state.steps.concat([{ node: state.node, choice: ch.id, quality: ch.quality }]);
  return { state: { scenario: state.scenario, node: ch.next, steps, done: !!(next && next.end) }, feedback: ch.feedback, quality: ch.quality };
}
/* earned and possible points on the path taken; percent and whether it is a pass */
export function score(state) {
  const steps = (state && state.steps) || [], earned = steps.reduce((n, x) => n + x.quality, 0), possible = steps.length * 2, percent = possible ? earned / possible : 0;
  return { earned, possible, percent, passed: !!(state && state.done) && percent >= PASS, steps: steps.length };
}
/* Every path through a scenario, checked once: each choice leads somewhere, nothing loops, every path ends, and each screen has exactly one best choice. */
export function validate(s) {
  const issues = [], seen = new Set(), walk = (id, trail) => {
    const n = s.nodes[id]; if (!n) { issues.push(s.id + ": a choice leads to " + id + ", which does not exist"); return; } if (trail.includes(id)) { issues.push(s.id + ": the screen " + id + " loops back to itself"); return; } seen.add(id);
    if (n.end) return; if (!Array.isArray(n.choices) || n.choices.length < 2) issues.push(s.id + "/" + id + ": needs at least two choices"); else {
      if (n.choices.filter((x) => x.quality === 2).length !== 1) issues.push(s.id + "/" + id + ": needs exactly one best choice");
      n.choices.forEach((x) => { if (!x.feedback || x.feedback.length < 30) issues.push(s.id + "/" + id + "/" + x.id + ": needs a reason"); if (![0, 1, 2].includes(x.quality)) issues.push(s.id + "/" + id + "/" + x.id + ": quality must be 0, 1 or 2"); walk(x.next, trail.concat([id])); });
    }
  };
  walk(s.start, []); Object.keys(s.nodes).forEach((k) => { if (!seen.has(k)) issues.push(s.id + ": the screen " + k + " can never be reached"); }); return issues;
}
export const bestPath = (id) => { const s = scenarioOf(id); let st = start(id); while (st && !st.done) { const n = s.nodes[st.node], best = n.choices.find((x) => x.quality === 2); st = choose(st, best.id).state; } return st; };

/* ---- the record and the certificates --------------------------------------------------------------------------------------------------------- */
const clean = (v, max) => String(v == null ? "" : v).replace(/[\u0000-\u001F\u007F<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const B32 = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function certificateId(learner, scenarioId, at) {
  let a = hash(learner + "|" + scenarioId + "|" + at), b = hash(at + "|" + scenarioId + "|" + learner + "#"), s = "";
  for (let i = 0; i < 8; i++) { const v = i < 4 ? a : b; s += B32[v & 31]; if (i < 4) a = a >>> 5; else b = b >>> 5; } return "SC-" + s.slice(0, 4) + "-" + s.slice(4);
}
export const emptyRecord = () => ({ schema: SCHEMA, v: VERSION, results: [] });
export function normalize(raw) {
  const r = raw && typeof raw === "object" ? raw : {}, ok = (x) => x && typeof x === "object" && scenarioOf(x.scenario) && typeof x.at === "string" && !isNaN(Date.parse(x.at)) && clean(x.learner, 60);
  return { schema: SCHEMA, v: VERSION, results: (Array.isArray(r.results) ? r.results : []).filter(ok).slice(-500).map((x) => ({ id: clean(x.id, 16), learner: clean(x.learner, 60), role: clean(x.role, 40), scenario: x.scenario, at: new Date(x.at).toISOString(), percent: Math.max(0, Math.min(1, Number(x.percent) || 0)), steps: Math.max(0, Math.min(40, Math.round(Number(x.steps) || 0))), passed: !!x.passed, minutes: Math.max(1, Math.min(240, Math.round(Number(x.minutes) || 1))) })) };
}
export const read = (store) => { try { const t = store.getItem(STORE_KEY); return normalize(t ? JSON.parse(t) : null); } catch (e) { return emptyRecord(); } };
/* Record a finished scenario. Only a passed run earns a certificate id. Returns the stored result, or throws a plain message. */
export function complete(store, who, state, now = new Date()) {
  const name = clean(who && who.name, 60), sc = score(state); if (!name) throw new Error("Add your name first, so it can appear on the certificate."); if (!state || !state.done) throw new Error("Finish the scenario first.");
  const s = scenarioOf(state.scenario), at = now.toISOString(), rec = read(store);
  const res = { id: sc.passed ? certificateId(name, state.scenario, at) : "", learner: name, role: clean(who && who.role, 40), scenario: state.scenario, at, percent: sc.percent, steps: sc.steps, passed: sc.passed, minutes: s.minutes };
  rec.results.push(res); try { store.setItem(STORE_KEY, JSON.stringify(rec)); } catch (e) { throw new Error("The result could not be saved (storage is full or blocked)."); } return res;
}
/* Which scenarios a learner has passed, and whether all of them. */
export function passedBy(rec, name) { const n = clean(name, 60).toLowerCase(), done = new Set(); (rec.results || []).forEach((r) => { if (r.passed && r.learner.toLowerCase() === n) done.add(r.scenario); }); return { done: [...done], all: SCENARIOS.every((s) => done.has(s.id)) }; }
export const find = (rec, id) => (rec.results || []).find((r) => r.id && r.id === String(id || "").trim().toUpperCase()) || null;
export function seriesId(name, rec) {
  const p = (rec.results || []).filter((r) => r.passed && r.learner.toLowerCase() === clean(name, 60).toLowerCase()).map((r) => r.id).sort().join("|");
  let a = hash(p + "|series"), b = hash("series|" + p), s = ""; for (let i = 0; i < 6; i++) { const v = i < 3 ? a : b; s += B32[v & 31]; if (i < 3) a = a >>> 5; else b = b >>> 5; } return "SS-" + s.slice(0, 3) + "-" + s.slice(3);
}
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
const longDate = (iso) => new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
/* One US Letter page, black on white. result: a stored result; ctx: { facility }. */
export function certificatePage(result, ctx = {}) {
  const s = scenarioOf(result.scenario), pct = Math.round(result.percent * 100);
  return `<div class="sheet sc-cert"><div class="sc-frame"><p class="sc-kicker">Cognicopia Academy</p><h1>Certificate of Completion</h1><p>This certifies that</p><h2>${esc(result.learner)}</h2>${result.role ? `<p>${esc(result.role)}</p>` : ""}<p>completed the scenario practice</p><h3>${esc(s.title)}</h3>
    <p>${esc(s.summary)}</p><p>Choices matched the training approach ${pct}% of the time${ctx.facility ? ", at " + esc(ctx.facility) : ""}.</p>
    <div class="sc-cols"><div><b>Completed</b><br>${esc(longDate(result.at))}</div><div><b>Training time</b><br>${result.minutes} minutes</div><div><b>Certificate</b><br>${esc(result.id)}</div></div>
    <p class="sc-sign">Signature: ______________________________</p><p class="sc-note">${esc(NOT_ACCREDITED)}</p></div></div>`;
}
export function seriesPage(name, rec, ctx = {}) {
  const mine = SCENARIOS.map((s) => (rec.results || []).filter((r) => r.passed && r.scenario === s.id && r.learner.toLowerCase() === clean(name, 60).toLowerCase()).slice(-1)[0]), last = mine.map((m) => m && m.at).sort().slice(-1)[0] || new Date().toISOString();
  const mins = mine.reduce((n, m) => n + (m ? m.minutes : 0), 0);
  return `<div class="sheet sc-cert"><div class="sc-frame"><p class="sc-kicker">Cognicopia Academy</p><h1>Certificate of Completion</h1><p>This certifies that</p><h2>${esc(clean(name, 60))}</h2><p>completed all ${SCENARIOS.length} scenario practices in</p><h3>Responding to Distress with Dignity</h3>
    <ul class="sc-list">${SCENARIOS.map((s, i) => `<li>${esc(s.title)}${mine[i] ? " &mdash; " + esc(longDate(mine[i].at)) : ""}</li>`).join("")}</ul>${ctx.facility ? `<p>at ${esc(ctx.facility)}</p>` : ""}
    <div class="sc-cols"><div><b>Completed</b><br>${esc(longDate(last))}</div><div><b>Training time</b><br>${mins} minutes</div><div><b>Certificate</b><br>${esc(seriesId(name, rec))}</div></div>
    <p class="sc-sign">Signature: ______________________________</p><p class="sc-note">${esc(NOT_ACCREDITED)}</p></div></div>`;
}
