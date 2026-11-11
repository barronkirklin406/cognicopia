/* =====================================================================
   QUICK RESIDENT LOOKUP (builder.html, every screen)
   Ctrl+K (or Cmd+K), or "/" when no field has the keyboard, or the "Search" and "Find a resident" buttons, open the
   site's one search (js/wayfinding.js) over the tools, the guides and the residents saved on this computer: by name,
   alias or unit number. Choosing a resident makes them the active resident, the one every tool opens filled in for,
   and says so. On the Shift board, which keeps residents by alias only, the search shows aliases and never names,
   and the alias is copied so it can be pasted into a note. With aliases switched on in Settings it shows aliases too.

   This file lends the search what only the Packet Builder knows: its saved profiles (BookUI.savedProfiles), its
   aliases, its own chooser (ActiveResident.set, kept for this tab only, never on the disk) and its toast. It stores
   nothing. Nothing is sent anywhere.
   @global QuickLookup
   ===================================================================== */
const QuickLookup = (function () {
  "use strict";
  const W = window.CogniWayfinding;
  if (!W) return { open() {}, close() {} };
  const onShift = () => /^#\/shift(\b|\/|\?|$)/.test(location.hash);
  W.host({
    residents: () => { try { return BookUI.savedProfiles(); } catch (e) { return []; } },
    aliasOf: p => (typeof cgAlias === "function" ? cgAlias(p) : "Resident"),
    aliasOnly: () => onShift() ? "The Shift board shows aliases only." : (typeof settings !== "undefined" && settings.aliasScreen ? "Aliases are switched on in Settings." : ""),
    copyAlias: onShift,
    setActive: id => { try { ActiveResident.set(id); } catch (e) { /* the chosen resident simply is not remembered */ } },
    toast: msg => toast(msg),
    slash: true, tabOnly: true, ownBar: true
  });
  return { open: from => W.openCommand(from), close: () => W.closeCommand() };
})();
