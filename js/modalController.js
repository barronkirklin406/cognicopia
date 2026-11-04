/* =====================================================================
   Cognicopia modal controller (browser, offline, no dependencies).

   Makes a native <dialog> that the page opens with showModal() behave the
   same everywhere, so a window can never leave the page stuck:

     Escape        closes it (and is ignored while text is being composed)
     backdrop      a click that starts AND ends outside the window closes it;
                   a drag that begins inside the window and ends on the
                   backdrop (selecting text) does not. Both first ask the
                   window with a cancelable "cancel" event, the same one the
                   browser sends, so a window that refuses to close while it
                   is busy (event.preventDefault()) still can
     close button  any element inside marked data-modal-close
     keyboard      Tab and Shift+Tab stay inside the window
     scrolling     the page behind does not scroll while a window is open.
                   This is a class on <html> (cg-modal-open) worked out from
                   whether any bound window is open, never a counter that
                   can drift, so it is released on every way a window can
                   close: Escape, the close button, dialog.close() from the
                   page's own code, a window removed from the page, and a page
                   restored from the back-forward cache
     focus         goes back to what had it before the window opened, unless
                   another window is open by then (the "Edit" button closes
                   one window and opens another in the same moment)

   The page keeps calling dialog.showModal() and dialog.close() as it does
   now; bind() only watches. Nothing here uses the network or storage.

   Use:
     CognicopiaModal.bind(document.getElementById("myDialog"));
     CognicopiaModal.bind(dialog, { backdropClose: false, onClose: fn });
     CognicopiaModal.bindAll("dialog[data-cg-modal]");
     CognicopiaModal.open(dialog);  CognicopiaModal.close(dialog);

   Needs HTMLDialogElement.showModal (every current browser). Where it is
   missing, bind() returns null and the page is left as it was.
   ===================================================================== */
(function (root) {
  "use strict";
  if (root.CognicopiaModal) return;
  var doc = root.document;
  if (!doc) return;

  var LOCK_CLASS = "cg-modal-open";
  var FOCUSABLE = 'a[href],button,input:not([type="hidden"]),select,textarea,summary,[tabindex]';
  var instances = [];

  function supported(dialog) {
    return !!dialog && dialog.nodeType === 1 && dialog.tagName === "DIALOG" && typeof dialog.showModal === "function";
  }
  function anyOpen() {
    for (var i = 0; i < instances.length; i++) if (instances[i].dialog.open) return true;
    return false;
  }
  /* The class follows the windows, so it cannot be left on after they are gone. */
  function syncLock() {
    for (var i = instances.length - 1; i >= 0; i--) if (!instances[i].dialog.isConnected) instances[i].destroy();
    doc.documentElement.classList.toggle(LOCK_CLASS, anyOpen());
  }
  function visibleFocusables(dialog) {
    var all = dialog.querySelectorAll(FOCUSABLE), out = [], i, el;
    for (i = 0; i < all.length; i++) {
      el = all[i];
      if (el.disabled || el.hidden || el.getAttribute("tabindex") === "-1" || el.closest("[inert]")) continue;
      if (el.tagName === "INPUT" && el.type === "radio" && !el.checked && dialog.querySelector('input[type="radio"][name="' + el.name + '"]:checked')) continue;
      if (el.getClientRects().length === 0) continue;
      out.push(el);
    }
    return out;
  }
  /* Ask first, as the browser does: a "cancel" listener may refuse. */
  function requestClose(dialog) {
    var ev = null;
    try { ev = new root.Event("cancel", { cancelable: true }); } catch (e) { ev = null; }
    if (ev && !dialog.dispatchEvent(ev)) return false;
    safeClose(dialog);
    return true;
  }
  function safeClose(dialog) {
    try { if (dialog.open) dialog.close(); } catch (e) { try { dialog.removeAttribute("open"); } catch (e2) {} }
    syncLock();
  }

  function bind(dialog, options) {
    if (!supported(dialog)) return null;
    for (var k = 0; k < instances.length; k++) if (instances[k].dialog === dialog) return instances[k];
    var opts = options || {};
    var backdropClose = opts.backdropClose !== false;
    var closeSelector = opts.closeSelector || "[data-modal-close]";
    var opener = null, pressedOnBackdrop = false, observer = null, originalShow = dialog.showModal;

    if (!dialog.hasAttribute("tabindex")) dialog.setAttribute("tabindex", "-1");   // so focus has somewhere to rest if nothing inside can take it

    function onBackdrop(e) {
      if (e.target !== dialog) return false;
      var r = dialog.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    }
    function onPointerDown(e) { pressedOnBackdrop = onBackdrop(e); }
    function onClick(e) {
      var closer = e.target.closest && e.target.closest(closeSelector);
      if (closer && dialog.contains(closer)) { safeClose(dialog); return; }
      if (backdropClose && pressedOnBackdrop && onBackdrop(e)) requestClose(dialog);
      pressedOnBackdrop = false;
    }
    function onKeyDown(e) {
      if (e.defaultPrevented || e.isComposing) return;
      if (e.key === "Escape" || e.key === "Esc") { e.preventDefault(); requestClose(dialog); return; }
      if (e.key !== "Tab") return;
      var list = visibleFocusables(dialog);
      if (!list.length) { e.preventDefault(); dialog.focus(); return; }
      var first = list[0], last = list[list.length - 1], active = doc.activeElement;
      if (e.shiftKey && (active === first || active === dialog || !dialog.contains(active))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (active === last || !dialog.contains(active))) { e.preventDefault(); first.focus(); }
    }
    function onClose() {
      syncLock();
      var back = opener; opener = null;
      if (typeof opts.onClose === "function") { try { opts.onClose(dialog); } catch (e) {} }
      if (back && back.isConnected && !anyOpen() && typeof back.focus === "function") { try { back.focus({ preventScroll: true }); } catch (e) {} }
    }

    /* the page's own dialog.showModal() calls go through here, to note what had focus and lock the page at once */
    dialog.showModal = function () {
      opener = doc.activeElement && doc.activeElement !== doc.body ? doc.activeElement : null;
      var result = originalShow.apply(dialog, arguments);
      syncLock();
      if (typeof opts.onOpen === "function") { try { opts.onOpen(dialog); } catch (e) {} }
      return result;
    };

    dialog.addEventListener("pointerdown", onPointerDown);
    dialog.addEventListener("click", onClick);
    dialog.addEventListener("keydown", onKeyDown);
    dialog.addEventListener("close", onClose);
    if (typeof root.MutationObserver === "function") {   // catches an open that did not go through showModal()
      observer = new root.MutationObserver(syncLock);
      observer.observe(dialog, { attributes: true, attributeFilter: ["open"] });
    }

    var instance = {
      dialog: dialog,
      destroy: function () {
        dialog.removeEventListener("pointerdown", onPointerDown);
        dialog.removeEventListener("click", onClick);
        dialog.removeEventListener("keydown", onKeyDown);
        dialog.removeEventListener("close", onClose);
        if (observer) observer.disconnect();
        dialog.showModal = originalShow;
        var at = instances.indexOf(instance);
        if (at >= 0) instances.splice(at, 1);
        doc.documentElement.classList.toggle(LOCK_CLASS, anyOpen());
      }
    };
    instances.push(instance);
    syncLock();
    return instance;
  }

  function bindAll(selector) {
    var found = doc.querySelectorAll(selector || "dialog[data-cg-modal]"), out = [], i, one;
    for (i = 0; i < found.length; i++) { one = bind(found[i]); if (one) out.push(one); }
    return out;
  }
  function open(dialog) {
    if (!supported(dialog)) return false;
    bind(dialog);
    try { if (!dialog.open) dialog.showModal(); return true; } catch (e) { return false; }
  }
  function close(dialog) { if (dialog) safeClose(dialog); }

  /* a page restored from the back-forward cache keeps its DOM; make sure the lock matches what is open */
  if (root.addEventListener) root.addEventListener("pageshow", syncLock);

  root.CognicopiaModal = Object.freeze({ bind: bind, bindAll: bindAll, open: open, close: close, isLocked: anyOpen });
})(typeof globalThis !== "undefined" ? globalThis : this);
