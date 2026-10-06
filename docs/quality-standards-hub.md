# Quality Standards Hub

`resources/quality-standards/index.html` is a four-tab console for Directors of Nursing, Activity Directors and administrators. It is one static file; everything runs in the browser and nothing is fetched.

| Tab | What it holds |
| --- | --- |
| Governance & Clinical Pillars | The three pillars (clinical, operational, governance) and a table of what a dated Cognicopia sheet contributes to CMS Tag F679 (42 CFR §483.24(c)), MDS 3.0 Sections F and Q, care planning (F656) and a facility's privacy practices, with what stays with the team |
| State Survey Audit Engine (Tool A) | Six survey-readiness indicators, a live Audit Readiness Score, and a printable one-page Survey Readiness Summary for the binder |
| Copier Calibration & Margin Test (Tool B) | A one-page US Letter test sheet (drawn in points): the 0.65 in gutter, the 0.75 in Cognicopia gutter and the 0.5 in margins, line weights 0.5 to 3.0 pt, fine line pairs, a black patch with reverse type, text samples, two rulers |
| Institutional Procurement & W-9 (Tool C) | A Net-30 purchase-order estimate ($129.99 per facility unit per year), a printable Vendor Information Sheet and W-9 request, and a live security check |

## What it says, and what it does not

- The score is a **self-assessment** of how many of the six indicators the team has evidence for. The printed summary says so. It is not a survey finding, a certification or legal advice, and no agency has endorsed Cognicopia.
- The regulations are paraphrased to explain how sheets are used. Section F of the MDS records activity preferences; Section Q records participation in assessment and goal setting. Both are coded by the clinician.
- The vendor sheet shows only what the site already says (Net 30, check or bank transfer, a W-9 with each invoice). It carries no taxpayer number or street address.
- The hub's own sheets keep a 0.65 in left gutter and 0.5 in margins. Cognicopia's activity pages keep a 0.75 in gutter, which is more than the 0.65 in the calibration sheet tests.

## The header badge and the live check

The badge is computed, not fixed. "100% Offline" turns to "Network use detected" if the page's own script has made any request (fetch, XMLHttpRequest, beacon, WebSocket, EventSource) or loaded a file from another site. "Local Encryption Active" appears only when the encrypted store (`assets/services/secureStore.js`) is present and a Web Crypto AES-256-GCM round trip passes. The check sees only this page's own code, not the browser's or an extension's traffic, and says so.

## Storage

The checklist and the cover-sheet details are kept under `cognicopia_quality_audit`, a name the encrypted store seals (see `docs/privacy-and-storage.md`). With a passphrase set and locked, the tab shows an Unlock button. Without the encrypted store the page falls back to `localStorage` and says so in the live check.

## Checks

`node scripts/check-quality-hub.mjs` (part of `npm test` and `npm run build`) checks the tabs against the ARIA pattern, that nothing is loaded from another site, the six indicators, the storage name, the print rules, the price against the one in the tools, 7:1 contrast on the colour pairs, and that the page makes none of the claims the product cannot back.
