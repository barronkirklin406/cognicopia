# Clinical & Caregiver Alignment

`resources/clinical-alignment/index.html` is a four-tab console for Activity Directors, Certified Therapeutic Recreation Specialists (CTRS), occupational therapists and Directors of Nursing. It is one static page; everything runs in the browser and nothing is fetched.

| Tab | What it holds |
| --- | --- |
| Tripartite Clinical Framework | The three pillars (cognitive, motor, affective), the dignity standard, and the stage rules every page keeps (type 14, 18 and 24 pt; lines 2.25, 3 and 4.5 pt). Each pillar says what the evidence supports and links to the Research Center brief |
| CMS Regulatory Crosswalk & Survey Engine (Tool A) | Four objectives (life history cues, sundowning, fine-motor tremor, person-centered choice). Each shows the rule text, what it means in plain words, what a surveyor looks for, the Cognicopia module, four evidence items to tick, and what stays with the team. Prints a one-page Surveyor Evidence Sheet |
| Ergonomic & Vision Calibration Simulator (Tool B) | A sample page (a kitchen radio) drawn in points, with a 0.75 pt or 2.5 pt line, 12, 18 or 24 pt type, standard or pure black contrast, and a simulated tremor. Shows the contrast ratio and how much of a simulated pen path stays on the line. Prints a comparison handout at actual size |
| Surveyor Evidence Packet Generator (Tool C) | The Clinical Activity Selector Matrix (13 activity categories, filtered by stage and goal) and a three-page packet: a care plan summary, the regulatory crosswalk with the evidence ticked in Tab 2, and the matrix as filtered |

## What it says, and what it does not

- The rule text for Tag F679 (42 CFR §483.24(c)(1)), Tag F744 (§483.40(b)(3)) and Tag F550 (§483.10(a)(1)) is quoted word for word from the Research Center's Regulatory Crosswalk, which was checked against the Electronic Code of Federal Regulations on September 30, 2026. The check fails the build if the page's quotation and the Research Center's differ. MDS Sections F and Q are described, not quoted. Everything else (the plain words, the audit rationale, the modules, the evidence lists) is Cognicopia's own guidance.
- It is not a survey finding, a certification, a prediction of a survey outcome or legal advice. No agency has endorsed Cognicopia. The evidence list is a prompt for the team's own binder, and every MDS item is coded by the clinician.
- The pillars describe how the pages are designed, not a diagnosis, a treatment or a promise of a result. The evidence notes follow the Research Center: a Cochrane review of 22 trials found a very small benefit of reminiscence for cognition and no harms, so reminiscence is offered as engagement, not treatment; no trial is known that tested line weight for tremor, so the simulator is an illustration and says so.
- A printed line is a visual boundary, not a physical barrier. The page says this wherever it describes the 2.5 pt line.

## The simulator

The sample page is drawn at 1:1 in points, so a stroke of 2.5 is 2.5 pt. The simulated tremor is two fixed sine waves (no random number), so a setting always draws the same path. A pen tip of 3 pt is "on the line" while it is within half the line's width plus half the tip of the line's centre. The page shows the share of the path that stays on the line for 0.75 pt and 2.5 pt together. The default tremor is 3 pt (about 1 mm); the slider runs to 6 pt. It is a geometric illustration, not a measurement of any person.

The contrast ratio is the WCAG relative-luminance formula: pure black on white is 21:1; the "faded copy" setting is #767676 on white, the 4.5:1 minimum.

## The status badge

The badge reads "100% Client-Side / Clinical Validation Active" and is computed each time the page opens, not fixed. "100% Client-Side" turns to "Network use detected" if the page's script made any request or loaded a file from another site. "Clinical Validation Active" means the page loaded the rulebook the print engine reads (`src/engine/ClinicalMatrix.js`) and: every stage entry in the activity matrix matches the rulebook, the six type and line floors match, and the sample text passes the dignity filter. The details panel under the banner lists each check and the encrypted store's state, including an AES-256-GCM round trip. The check sees only this page's own code, not the browser's or an extension's traffic.

## Storage

The chosen objective, the evidence ticks, the filters, and the community, wing, preparer and role for the printed sheets are kept under `cognicopia_alignment_state`, a name the encrypted store seals (see `privacy-and-storage.md`). The page asks for no resident name; the care plan summary has write-in lines for the resident's initials or room. With a passphrase set and locked, the page shows an Unlock button. Without the encrypted store it falls back to `localStorage`.

## Print

Every sheet is US Letter with a 0.65 in binding gutter and 0.5 in margins, in pure black on white, with rules of 2 pt or more and staff text of 10 pt or more. A sheet prints edge to edge so it can keep its own gutter; printing the page itself (Ctrl+P) prints the open tab with the same gutter, and hides the sidebar, tabs and controls. Each printed page has a body that must fit and a bottom block (the note and "Page X of Y") that always sits at the foot.

## Checks

`node scripts/check-clinical-alignment.mjs` (part of `npm test` and `npm run build`) checks the tabs against the ARIA pattern, that nothing is loaded from another site, that every stage entry and floor on the page agrees with the rulebook and the sample text passes its dignity filter, that the rule text is the Research Center's, the simulator's arithmetic (a heavier line is never worse; contrast ratios), the print rules, 7:1 contrast on the colour pairs, and that the page makes none of the claims the product cannot back. Whether each printed page fits its sheet was measured in a browser with the longest cover details and every filter.
