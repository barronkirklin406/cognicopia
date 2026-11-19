/* In-page questions and notices, in place of the browser's own pop-ups (CogniDialog).

   The browser's alert and confirm windows are blocked inside some embedded browsers and after "prevent this page from creating more dialogs":
   they then answer "no" without showing anything, and the button looks dead. They also look nothing like the rest of the site and cannot be read
   at the size the site is set to. These are real <dialog> windows: the focus moves in, Escape answers no, the Cancel button has the focus (so a
   stray Enter never confirms), every button is at least 52 px, and it works offline.

     CogniDialog.confirm({ title, body, yes, no })   returns a Promise that is true for the yes button and false for the no button or Escape
     CogniDialog.notice(message | { title, body, ok })   returns a Promise that is resolved when the person presses the button
   A message may hold line breaks. If the browser cannot show a dialog the answer to a question is no and a notice is written to the console. */
(function (root) {
  "use strict";
  var doc = root.document;
  var CSS = ".cg-dlg{box-sizing:border-box;width:min(30rem,calc(100vw - 32px));max-height:calc(100vh - 32px);overflow:auto;padding:24px;border:3px solid currentColor;border-radius:16px;background:Canvas;color:CanvasText;font:inherit}" +
    ".cg-dlg::backdrop{background:rgba(7,11,19,.72)}.cg-dlg h2{margin:0 0 8px;font-size:1.35rem;line-height:1.25}" +
    ".cg-dlg p{margin:0 0 18px;line-height:1.5;white-space:pre-line}" +
    ".cg-dlg-row{display:flex;flex-wrap:wrap;gap:12px;justify-content:flex-end;margin:0}" +
    ".cg-dlg button{min-height:var(--tap,var(--cg-tap,52px));min-width:var(--tap,var(--cg-tap,52px));padding:8px 20px;border:2px solid currentColor;border-radius:10px;background:Canvas;color:CanvasText;font-family:inherit;font-size:1rem;font-weight:700;line-height:1.2;cursor:pointer}" +
    ".cg-dlg button.cg-dlg-yes{background:CanvasText;color:Canvas}" +
    ".cg-dlg button:focus-visible{outline:3px solid #86c9a7;outline-offset:2px;box-shadow:0 0 0 6px #141e19}";
  var seq = 0;
  function style() {
    if (!doc || doc.getElementById("cgDlgStyle")) return;
    var st = doc.createElement("style"); st.id = "cgDlgStyle"; st.textContent = CSS; (doc.head || doc.documentElement).appendChild(st);
  }
  function supported() { return !!doc && typeof root.HTMLDialogElement !== "undefined" && typeof root.HTMLDialogElement.prototype.showModal === "function"; }
  function open(o, question) {
    return new Promise(function (resolve) {
      try {
        if (!supported()) { if (root.console) root.console.warn("[Cognicopia] " + (o.title ? o.title + ": " : "") + (o.body || "")); resolve(false); return; }
        style();
        var id = "cgDlg" + (++seq), d = doc.createElement("dialog"), h = doc.createElement("h2"), b = doc.createElement("p"), f = doc.createElement("form"),
            yes = doc.createElement("button"), no = question ? doc.createElement("button") : null;
        d.className = "cg-dlg"; d.setAttribute("aria-labelledby", id + "T"); d.setAttribute("aria-describedby", id + "B");
        if (!question) d.setAttribute("role", "alertdialog");
        h.id = id + "T"; h.textContent = o.title; b.id = id + "B"; b.textContent = o.body;
        f.method = "dialog"; f.className = "cg-dlg-row";
        if (no) { no.type = "submit"; no.value = "no"; no.textContent = o.no || "Cancel"; no.autofocus = true; f.appendChild(no); }
        yes.type = "submit"; yes.value = "yes"; yes.className = "cg-dlg-yes"; yes.textContent = o.yes || (question ? "Continue" : "OK");
        if (!question) yes.autofocus = true;
        f.appendChild(yes); d.appendChild(h); d.appendChild(b); d.appendChild(f);
        var opener = doc.activeElement;
        d.addEventListener("close", function () {
          var ok = d.returnValue === "yes";
          if (d.parentNode) d.parentNode.removeChild(d);
          if (opener && opener.focus && doc.contains(opener)) { try { opener.focus(); } catch (e) { /* the control is gone */ } }
          resolve(question ? ok : undefined);
        }, { once: true });
        doc.body.appendChild(d); d.showModal();
        (no || yes).focus();
      } catch (err) { if (root.console) root.console.error("[Cognicopia] the dialog failed:", err); resolve(question ? false : undefined); }
    });
  }
  root.CogniDialog = {
    confirm: function (o) { o = o || {}; return open({ title: o.title || "Are you sure?", body: o.body || "", yes: o.yes, no: o.no }, true); },
    /* a question that is only a sentence: the sentence is the body, with a plain title and buttons */
    ask: function (message) { return root.CogniDialog.confirm({ title: "Please confirm", body: String(message || ""), yes: "Yes, go on", no: "Cancel" }); },
    notice: function (m) { var o = typeof m === "string" ? { body: m } : (m || {}); return open({ title: o.title || "Something to know", body: o.body || "", yes: o.ok }, false); }
  };
})(typeof window !== "undefined" ? window : this);
