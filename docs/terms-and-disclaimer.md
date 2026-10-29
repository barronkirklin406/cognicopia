# Terms of Service and the non-medical disclaimer

Cognicopia is an educational and cognitive enrichment activity tool. It is not a medical device, and it gives no diagnosis, treatment or medical advice. The owner's wording is in one place, `js/legal.js`, and is repeated word for word on `terms.html`. `scripts/check-terms.mjs` compares them letter for letter.

## What a person sees

- **The first visit.** On the packet tool, the Packet Builder and Resident Profiles a bar at the foot of the window shows the disclaimer and an "I agree" button. Choosing it saves `cognicopia_eula_accepted` = `true` in this browser only, and the bar does not come back on this computer. It never prints, and it is not shown on `terms.html`.
- **The tablet activities do not show it.** They are for residents; staff agree on the packet tool or the Packet Builder, and the agreement is kept for the whole site on that computer.
- **The footer.** "Terms of Service & Disclaimer" is in the shared footer of every page that has one, in the packet tool's footer and at the foot of the Packet Builder's menu.
- **`terms.html`.** The full text, a short plain-words list and a button that clears the saved agreement so the bar shows again.

## The line on every printed page

"Cognicopia Enrichment Activity — For Cognitive Engagement Only. Not Medical Advice." is printed small, in black, centered in the bottom margin about 0.3 in above the paper's edge.

- **PDF files.** `assets/vendor/jspdf-atkinson.js` (the one place every PDF is made; `index.html` carries a copy, and the build proves the two match) stamps the line on every page when the file is saved or output. A maker that is not an activity, such as an invoice, sets `doc.__noLegal = true`.
- **Printed sheets.** The Packet Builder's `#printRoot .sheet` and the packet tool's `#qpPrintRoot .qp-sheet` carry the same line in their print style.

The line is 8 pt, smaller than the 12 pt staff floor used inside the page, because there is no room for a second 12 pt line inside the 0.5 in margin; it sits where printers still reach (about 0.3 in) and clear of the page's own foot.

## What this is not

This is a plain statement of purpose, not legal advice. Have your attorney read `terms.html` before the first facility signs anything.
