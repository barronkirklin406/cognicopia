# Daily Operations: the Shift board

**Status: a first version, built to be shown to Activity Directors and changed by what they say.** It is decision D3 in [blueprint-decisions.md](blueprint-decisions.md). Where it lives: the Packet Builder, `builder.html#/shift`, in the Facility hub of the sidebar and as a card on the Packet Builder's home page. The logic is `src/services/dailyOps.ts` (built to `assets/services/dailyOps.js`, global `CogniDailyOps`); the screen is the `DailyOpsUI` script in `builder.html`.

## What it is, and what it is not

A shared computer on a unit carries a small board: notes for the next shift, tasks for the team, and a one-page handoff sheet to print. It stays on that computer, encrypted, and residents appear on it only as aliases.

It is **not** a chart, not a medical record, not a messaging system and not synced. Two stations do not see each other's boards unless someone moves a locked file between them. It does not replace the facility's own charting or incident reporting, and the screen does not say that it does.

## The three jobs

1. **Pass something on.** A note has a kind (Keep an eye on, Pass along, What worked), the day, shift and time, who it is about (an alias, a room or a group, or no one in particular), the words, and the initials of whoever wrote it.
2. **Give a task.** What needs doing, who it is about, for which initials (or anyone on shift), which shift (or any time) and which day. A task is ticked done with the initials and time. A task still open when the day ends is carried forward to the next day and shown there until it is done.
3. **Print the handoff.** One US Letter sheet for a day and shift (or the whole day): the notes in three groups, every open task with a box to tick by hand, the tasks finished on the shift, and a few ruled lines for anything added by hand.

## What a person does

1. Open **Facility, Shift board**. Choose your initials (one tap on the buttons, or type them once). Initials are forgotten after 15 minutes without use, so the next person starts fresh.
2. Choose the day and shift. It opens on today, all shifts. A night shift belongs to the day it began, so a note written at 2 am on Tuesday is on Monday's night shift.
3. Write a note or give a task. Before a note is saved, the board checks it for a resident's name. If it finds one it says which, and offers the resident's alias instead (**Use the alias**) or saving it as written (**Keep as written and save**). It warns; it does not refuse.
4. Tick tasks done. Edit or delete a note or task (a deleted one can be brought back with **Undo** for a few seconds). Someone other than the author who edits a note is named on it.
5. **Print handoff sheet.** It counts as one print against the free allowance, like every other printed page.

## What is kept

One record, `cognicopia_dailyops`, sealed in the encrypted store (AES-256-GCM, the same store as resident profiles; see [privacy-and-storage.md](privacy-and-storage.md)). It is not in plain `localStorage`, and the check proves the words of a note cannot be read in what is stored.

| Field | What | Limit |
|---|---|---|
| `notes[]` | id, day, shift, time, kind, about (an alias or room), text, written by, edited by, created and updated times | 500 characters of text; 2,000 notes |
| `tasks[]` | id, day, shift or any time, what, about, for (initials), added by, edited by, done, done at, done by, created and updated times | 200 characters; 1,000 tasks |
| `staff[]` | initials used on this board, for the quick-pick buttons and the "For" list | 4 characters each; 24 |
| `keepDays` | how long notes are kept | 7, 14 (to begin with), 30 or 90 days |

**Retention.** Whenever the board opens or changes, notes and finished tasks older than `keepDays` are removed. A finished task counts from the day it was finished, so a task done today is not removed because it was set for last month. **An open task is never removed**; someone marks it done or deletes it. Changing the setting to something shorter says how many notes and tasks it would remove and asks first.

**Aliases.** The picker offers each saved resident's alias (the one on the profile, else "Resident" and the room, else a short code), once each. An alias that is itself a resident's name is not offered, and the screen says so. A person can also type a room or group ("Maple 2").

## Names: what the check can and cannot catch

The check compares a note to the preferred names on the saved resident profiles on this computer, as whole words, ignoring case and accents. "Mr. Olsen" and "Olsen" both find Mr. Olsen. Two residents who share a name are replaced by "a resident", never guessed between. A title followed by a capitalised word ("Mrs. Alvarez", "Dr. Lee") is flagged even when no profile has it, since a visitor's or a clinician's name is as private. It checks 300 residents in a few milliseconds.

It **cannot** catch a nickname that is on no profile, a surname written without a title, a name that is also an ordinary word and was kept on purpose, a name in a language it has no profile for, or anything about a person that is not a name (a distinctive story). It is a net under careful staff, not a substitute for them. The screen says "Use aliases, not names" above the forms for that reason, and printed sheets are handled under the facility's own practices, as every printed page with details is.

## Wording tips

A short list of labels that describe a person by a judgment ("refused", "combative", "wanderer", "non-compliant", "demanding" and "attention-seeking", "feeder") gets a quiet suggestion beneath the note, such as "Declined" or "said no to" for "refused". A tip never blocks a save and nothing is changed for the writer. The list is deliberately short: it is easier to trust a few suggestions than many. Activity Directors should say which to keep, drop or add.

## The handoff sheet

US Letter, pure black on white, 0.75 in binding gutter on the left and 0.5 in margins, set in Atkinson Hyperlegible (12 pt text, 11 pt lead and initials, 16 pt title). A typical day is one page; a heavy day (44 notes and 18 open tasks in the test) takes about five. Rows are laid out from the print face's real character widths, so a line of capitals, which holds a third fewer characters, is planned for. The page then checks its own layout in the browser and, if anything would be cut off, lays the pages out again with more room. In the check, nothing was cut off for prose, capitals, wide letters or clinical shorthand.

## Moving a board to another station

**Back up, or move to another station** (Back up, keep and clear) writes a locked `.cognicopia` file of kind `dailyops` with a passphrase chosen for the file (at least 10 characters; PBKDF2-SHA-256, 600,000 rounds, AES-GCM). Opening a file on another station **adds what that board is missing and never removes anything**. For a note or task both boards have, the one changed last wins, except that a finished task stays finished. Opening the same file twice adds nothing twice. Say the passphrase in person or by phone; never send it with the file.

## What is measured

Where this is proved, and by what. Timings are from a cloud sandbox, not a facility PC.

| Claim | Proved by |
|---|---|
| The record is sealed; no note's words are in plain storage or readable in the stored bytes | `scripts/check-shift-ui.mjs` (real browser) |
| Adding, editing, deleting and undoing; tasks done and reopened; open tasks carried to the next day | `scripts/check-shift-ui.mjs` |
| A resident's name is caught and offered back as the alias; the board never refuses | `scripts/check-shift-ui.mjs`, `scripts/check-services.mjs` (the `dailyOps` group) |
| Retention runs when the board opens and keeps open tasks | `scripts/check-shift-ui.mjs`, `scripts/check-services.mjs` |
| The keyboard alone is enough: initials, kind of note (arrow keys), Enter to add a task, Space to tick one done | `scripts/check-shift-ui.mjs` |
| Initials lapse after 15 minutes without use (a fake clock moves 16 minutes on) | `scripts/check-shift-ui.mjs` |
| Two tabs on one board: a change made in one is never written over by the other, even while the other is being typed in | `scripts/check-shift-ui.mjs` |
| The sheet is one Letter page, with nothing cut off, in four kinds of text, and is laid out again with more room if the type is wider than expected | `scripts/check-shift-ui.mjs`. The printed PDF was also read back with PyMuPDF by hand: text inside the 0.75 in gutter and 0.5 in margins, Atkinson Hyperlegible embedded |
| A locked backup round-trips; a wrong passphrase is refused; the same file twice adds nothing | `scripts/check-shift-ui.mjs` |
| With a passphrase set and the store locked, the board is not shown until the unlock | `scripts/check-shift-ui.mjs` |
| Every control is at least 52 px (the screen, its states, a phone, and the unlock prompt) and no text is below WCAG AA by day or in Night Shift | `scripts/audit-ux.mjs`, `scripts/check-shift-ui.mjs` |

`npm run build` runs all of these where Playwright is installed, and `npm test` runs the service's own logic (the `dailyOps` group of `scripts/check-services.mjs`).

## Limits to say honestly

- **One computer at a time.** No sync. A second station needs a locked file moved by hand. (Two browser tabs on one computer are safe: every change is made on the board as it is stored, so neither tab writes over the other.)
- **Initials are not a sign-in.** Anyone at the computer can choose any initials. They say who wrote a note; they do not prove it. Roles and permissions are not built.
- **Anyone who can unlock the store can read the board.** With the default device key, anyone who can open this browser on this computer can. Add a passphrase (Settings, Privacy and encryption) for a shared computer.
- **A deleted note leaves no trace.** There is no audit trail on the board (the Facility Portal has one for its own changes).
- **Not a record of care.** It supports handoff conversation. It does not satisfy any documentation rule, and the product does not say it does.
- **Shift names are Day, Evening and Night** with fixed default hours (about 7 am to 3 pm, 3 pm to 11 pm, 11 pm to 7 am). A facility on 12-hour shifts uses Day and Night.

## Questions for three to five Activity Directors

These decide what is built next. Watch someone use it before asking.

1. Is "Keep an eye on, Pass along, What worked" the right set? What do you actually tell the next shift?
2. Do tasks belong here, or in the Facility Portal's calendar?
3. What shift names and hours do you use? Do you need more than three?
4. Would you use the printed sheet as it is, or would you want it to look like something your facility already prints?
5. Do two or more computers need to share a board? If yes, see below.

## What comes next (not built)

- **Syncing between stations.** Decision D3 keeps it out of this version. Anything that stores notes on a server needs a vendor that signs a business associate agreement, and it breaks the zero-PHI promise of `platform/`. It is a separate decision, to be made after the Activity Directors answer question 5.
- **Roles** (who may delete, who may print), **shift hours a facility sets**, and a **trace of deletions** are candidates, in the order the Activity Directors ask for them.

## Files

| File | Role |
|---|---|
| `src/services/dailyOps.ts` | The logic: records, retention, merge, name check, wording tips, the handoff sheet. No network, no storage of its own |
| `assets/services/dailyOps.js` | Built from it by `npm run services`; never edited by hand |
| `builder.html` (`ops-ui`, `shf-style`) | The screen and the sheet's print styles |
| `src/services/secureStore.ts` | Lists `cognicopia_dailyops` as a sealed name |
| `scripts/check-services.mjs` (`dailyOps` group) | The service's logic and its wiring |
| `scripts/check-shift-ui.mjs` | The screen and the storage, in a real browser |
