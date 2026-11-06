/* Hands-free dictation for the journal, using the browser's own speech recognition, and only where it stays on this device.

   Most browsers send what is spoken to an online service. Dictation therefore starts only if the browser says it can recognize speech
   on the device (SpeechRecognition.available with processLocally), or if staff explicitly choose the online service and are told what that
   means. Spoken text is added to the note being written; the note's names and pets are then picked out offline by studio-core. */

const API = (w) => (w && (w.SpeechRecognition || w.webkitSpeechRecognition)) || null;
export async function support(win, allowCloud = false) {
  const w = win || (typeof window !== "undefined" ? window : null), SR = API(w), out = { recognition: !!SR, local: "unknown", canListen: false, cloud: false, reason: "" };
  if (!SR) { out.reason = "This browser has no speech recognition."; return out; }
  try { if (typeof SR.available === "function") { const a = await SR.available({ langs: ["en-US"], processLocally: true }); out.local = a === "available" || a === "readily" ? true : a === "downloadable" || a === "after-download" ? "downloadable" : false; } } catch (e) { out.local = "unknown"; }
  if (out.local === true) { out.canListen = true; out.reason = "Speech is recognized on this device."; }
  else { out.reason = out.local === "downloadable" ? "On-device recognition needs a one-time language download first." : "This browser cannot confirm that speech stays on this device, and most browsers send it to an online service."; if (allowCloud) { out.canListen = true; out.cloud = true; out.reason += " Online recognition was allowed, so what is said is sent to the browser's speech service."; } }
  return out;
}
export class Dictation {
  constructor(o = {}) { this.win = o.win || null; this.allowCloud = !!o.allowCloud; this.rec = null; this.onText = o.onText || (() => {}); this.onState = o.onState || (() => {}); }
  async start() {
    const caps = await support(this.win, this.allowCloud); if (!caps.canListen) { this.onState({ listening: false, reason: caps.reason }); return { ok: false, reason: caps.reason }; }
    const w = this.win || window, SR = API(w), rec = new SR(); rec.lang = "en-US"; rec.continuous = true; rec.interimResults = false; if (!caps.cloud) { try { rec.processLocally = true; } catch (e) { /* not settable */ } }
    rec.onresult = (e) => { for (let i = e.resultIndex || 0; i < e.results.length; i++) if (e.results[i].isFinal) this.onText(String(e.results[i][0].transcript).trim()); };
    rec.onerror = () => { this.rec = null; this.onState({ listening: false, reason: "Dictation stopped." }); }; rec.onend = () => { this.rec = null; this.onState({ listening: false, reason: "" }); };
    this.rec = rec; rec.start(); this.onState({ listening: true, cloud: caps.cloud, reason: caps.reason }); return { ok: true, cloud: caps.cloud };
  }
  stop() { try { if (this.rec) this.rec.stop(); } catch (e) { /* already stopped */ } this.rec = null; return true; }
}
