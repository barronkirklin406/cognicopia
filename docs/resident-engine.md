# One resident across the tools: the daily record, the suggested tier and the staff companion

**Status: first version.** The logic is `src/services/residentTracker.ts` (built to `assets/services/residentTracker.js`, global `CogniTracker`) and `src/services/staffCompanion.ts` (global `CogniStaffCompanion`). The screens are the `resident-ui` script in `builder.html`. Checks: `scripts/check-resident-engine.mjs` (logic, in `npm test`) and `scripts/check-resident-engine-ui.mjs` (a real browser, in `npm run build`).

## The resident we are working with

A saved resident profile can be chosen once, in the strip above every Packet Builder screen ("Working with"), in the Roster, or by saving or opening a profile on `profile.html`. That choice is kept for the life of the browser tab only (`sessionStorage`, key `cgb_active_resident`); the Roster deliberately never remembers a resident on disk. Every tool then opens on them:

- the Life Planner and the Life Journal fill in their details; a form already holding someone else offers a **Fill it in** button instead of overwriting;
- Session Notes, the Memory Digest, Reminiscence Cards, the Roster and the Packet Builder's form (name and era) follow the choice each time it changes;
- Quick Print on `index.html` opens on the same resident.

## The daily record (Roster)

For the chosen resident the Roster shows a panel with:

- **Stage (GDS 1 to 7).** Entered by staff, in the resident's record. Stage 1 to 4 reads as Tier 1, 5 as Tier 2, 6 and 7 as Tier 3.
- **Today's parts of the day** (morning, afternoon, evening): open, ready, done or skipped.
- **A log**: the activity, the area it exercised, how they took part (the same four ways as the Shift board), a mood (the Shift board's nine) and a few words. A note that names the resident is refused, with the reason. Activity records made on the Shift board (by alias) land in the log too. Printing a packet notes it in the record.

It is kept in the encrypted store, one record per resident, `cognicopia_track_<id>`. It keeps at most 400 entries and 200 packets, for 90 days. It never leaves the browser.

## The suggested tier

The Roster shows a **suggested support tier**, starting from the stage (or the profile's tier) and moving at most one step: toward more support when four or more recent sessions were mostly unsettled or only watched, toward more detail when five or more were fully engaged with none flagged. It says why, and says it never changes anything by itself. The profile changes only when staff press **Use Tier N** and confirm. It is a prompt for a person's judgment, not an assessment.

## The staff companion

**Print the staff companion** (in the packet drawer) prints pages apart from the resident's own: a cover and session overview (the alias, never the name), facilitation cues for the support tier, validation and errorless-learning steps, a page for when they become unsettled, and notes for each page of the packet. The resident's own pages carry only a first name and no clinical words: while **Keep staff lines off the resident's pages** is on (Settings, the default), the therapy and stage line, the clinical tip, the answers and the sensory prompt are left off the printed sheet and listed on the notes page instead.

**Known limit:** Quick Print PDFs on `index.html` have their own clinical foot lines; they are not yet moved to the staff companion.

## Menu and addresses

The top bar and the drawer carry two headings, **Resident tools** and **Staff & family portal**, over the same six hubs. The planner's care companion has its own address, `builder.html#/planner-care-companion`.
