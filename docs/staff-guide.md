# Staff Guide and Feature Tour

`resources/staff-guide/index.html`, listed under Resources (the Resource and Clinical Hub, the Resources panel on every page). It is for Activity Directors, memory care coordinators and caregiver staff.

## What it holds

- **Four practice screens** in one tabbed tour (`js/staffGuide.js`): choose a level and a year of birth, make the month, use the tablet, ask for a purchase-order invoice. Each is a small stand-in for the real screen with the real button words ("Make the packet", "Download Month (All Residents)", "Generate Bundle PDF", "Finish for me", "Make my invoice (PDF)"). They make nothing, save nothing and send nothing. Each steps forward and back.
- **Benefits** and a **staff FAQ**, in plain words. The privacy line is "no resident data leaves the device" and "supports your facility's HIPAA privacy practices", never a claim of compliance.
- **A one-page Quick-Start sheet** (the "Print 1-Page Breakroom Quick-Start Guide (PDF)" button): a PDF made on the visitor's computer with the PDF library the site already carries. Pure black on white, US Letter, 0.75 in margins, type no smaller than 11.5 pt.

## Rules it keeps

- The era a resident's memories page draws on is the years they were 15 to 25, from their year of birth, the same rule as the packet tool. The era datasets for music, film, television and slang are a separate piece of work; this guide describes only what the tools do today.
- The one time it gives, about a third of a second for one resident's packet, is the measured one in `docs/ux-baseline.md`. A time for a whole month has not been measured, so none is given.
- Line icons, no emoji. Every control is 52 px. No request leaves the page.

## Checks

`scripts/check-staff-guide.mjs` (in `npm run build`, a real browser): the era rule, the four tabs by click and arrow keys, every practice screen, the FAQ, the PDF read back with PyMuPDF (one Letter page, inside the margins, no line over another, pure black), the wording rules, 52 px controls, white-on-dark text at 7:1 or better, no sideways scrolling on a phone, and nothing leaving the page.

To add or change a step, edit the page and `js/staffGuide.js` (the sheet's words are `SHEET` there). To move it in the nav, edit its `MODULES` entry in `scripts/site-nav.mjs` and run `npm run nav`.
