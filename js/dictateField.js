/* =====================================================================
   A "Speak" button beside a text box (any field marked data-dictate): the resident profile's notes and the Shift board's
   note. It uses js/dictation.js, so it listens only where the browser confirms that speech is recognized on this device;
   everywhere else, once pressed, the button is greyed out and says why (the owner's choice: on-device only, never online).

   The browser is asked whether it can listen on the device only when staff press the button, never when the page opens:
   in some browsers that question itself can stop the page (Chromium without a speech service closes it), and a page that
   opens must always open. What is said is added to the end of the box and the box is told it changed, so its counter, and on the Shift board the
   check for residents' names, see dictated words exactly as typed ones. Nothing is stored here and nothing is sent.
   Checked by scripts/check-help-dictation-ui.mjs.
   ===================================================================== */
import { support, Dictation } from "./dictation.js";

let caps = null;
const capsNow = () => caps || (caps = support(window, false));
let seq = 0;

function wire(field) {
  if (!field || field.dataset.dictateReady) return;
  field.dataset.dictateReady = "1";
  const id = "dc" + (++seq), row = document.createElement("div");
  row.className = "dc-row";
  row.innerHTML = `<button type="button" class="dc-btn" id="${id}" aria-pressed="false" aria-describedby="${id}Why"><span aria-hidden="true">\u{1F3A4}</span> <span class="dc-lab">Speak instead of typing</span></button><span class="dc-why" id="${id}Why" role="status">Listens only if this browser can recognize speech on this device; nothing is sent online.</span>`;
  field.insertAdjacentElement("afterend", row);
  const btn = row.querySelector("button"), lab = row.querySelector(".dc-lab"), why = row.querySelector(".dc-why");
  let dict = null;
  const add = (t) => { if (!t) return; field.value = (field.value ? field.value.replace(/\s+$/, "") + " " : "") + t; if (field.maxLength > 0 && field.value.length > field.maxLength) field.value = field.value.slice(0, field.maxLength); field.dispatchEvent(new Event("input", { bubbles: true })); };
  const state = (s) => { const on = !!(s && s.listening); btn.setAttribute("aria-pressed", String(on)); lab.textContent = on ? "Stop listening" : "Speak instead of typing"; why.textContent = on ? "Listening, on this device. Speak, then press Stop listening." : (s && s.reason) || "Speech is recognized on this device."; };
  btn.addEventListener("click", async () => {
    if (dict && btn.getAttribute("aria-pressed") === "true") { dict.stop(); state({ listening: false }); return; }
    why.textContent = "Checking whether this browser can listen on this device…";
    const c = await capsNow();
    if (!c.canListen) { btn.disabled = true; why.textContent = c.reason + " Typing works as always."; return; }
    dict = new Dictation({ onText: add, onState: state });
    const r = await dict.start(); if (!r.ok) { btn.disabled = true; why.textContent = r.reason + " Typing works as always."; }
  });
}
function scan(rootEl) { (rootEl || document).querySelectorAll("[data-dictate]").forEach(wire); }
scan();
/* the Packet Builder draws its screens after the page has loaded: a box that appears later gets its button too */
new MutationObserver((list) => { for (const m of list) for (const n of m.addedNodes) if (n.nodeType === 1) { if (n.matches && n.matches("[data-dictate]")) wire(n); else if (n.querySelector && n.querySelector("[data-dictate]")) scan(n); } })
  .observe(document.body, { childList: true, subtree: true });
window.CogniDictateField = Object.freeze({ scan, wire, reset: () => { caps = null; } });
