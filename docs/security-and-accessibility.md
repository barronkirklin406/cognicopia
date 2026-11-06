# Security and accessibility

One screen, `builder.html#/safety` (Facility, Security & Accessibility), and the modules behind it. Everything is offline.

| Part | Module | Check |
|---|---|---|
| Color-blind palettes, OpenDyslexic, six micro-tiers and the rapid tier worksheet | `js/access-kit.js` | `scripts/check-access-kit.mjs` |
| Idle sanitizer and the access log | `js/idle-sanitizer.js`, `js/sha256.js`, `js/sessionTimeout.js` | `scripts/check-idle-sanitizer.mjs` |
| Daily backup reminder and differential backups | `js/backup-diff.js` | `scripts/check-backup-diff.mjs` |
| Optional device lock for the license | `js/license-persistence.js` | `scripts/check-license-persistence.mjs` |
| The screen | `js/safety-ui.js` | `scripts/check-safety-ui.mjs` |

## Palettes and fonts

Deuteranopia, protanopia and tritanopia each have four category fills (the conversation deck's Hometown, Career, Music and Family) and a pair of message colors. A palette is accepted only if, when that kind of color vision is simulated (Machado, Oliveira and Fernandes 2009, full severity), every pair of fills stays at least 25 apart in CIE76 delta E (about 20 is clearly different), black text on each fill is 7:1 or better, and the message colors are 7:1 on the page color. Color is never the only signal: tags carry a shape and messages carry a mark.

OpenDyslexic (SIL Open Font License, `fonts/OpenDyslexic-*.woff2` and `fonts/OFL-OpenDyslexic.txt`) was saved from the `@fontsource/opendyslexic` package when the site was built; the site loads it from its own `/fonts` folder and contacts nothing. It is an option for the screen, and a separate option for printed pages because it is wider.

## Micro-tiers and the rapid tier worksheet

Each of the three support tiers is split in two: 1a, 1b, 2a, 2b, 3a, 3b. A micro-tier sets the print values the print engine already reads from a profile (type scale and line weight), plus an item share, a number of choices and a number of cues that pages can use. The rapid tier worksheet is eight things staff may already have seen in the resident's ordinary days, each marked Not seen, Sometimes or Usually (0, 1, 2). The total from 0 to 16 maps to one micro-tier. It never asks the resident to do anything, it is not an assessment, and the person who knows the resident best chooses the tier. It prints as one Letter page and the screen can apply the choice to a saved profile.

## Idle sanitizer and the access log

After the 15 minutes of inactivity that `js/sessionTimeout.js` watches, and before it locks the saved residents and reloads, `js/idle-sanitizer.js` writes an `idle-wipe` entry, tears down the open tool screens, clears every typed field, the staged print pages, the selection and the focus, and releases every object URL the page made. A browser cannot zero its own memory; the reload that follows is what drops the rest. Saved data is never touched.

The access log (`cognicopia_access_log`) records the kind of thing done and when: session started, saved residents locked or unlocked, a failed unlock, a resident opened (by a short code), pages printed (a page count), backups, restores and exports, the daily reminder, a device lock change. It holds no names, no health details and nothing anyone typed. Each entry carries the SHA-256 of the entry before it, so an edited, removed or reordered entry shows when the log is verified. That catches mistakes and casual edits; it cannot stop someone who can run code in the browser from rewriting the whole chain, and the screen says so. It can be downloaded as a CSV and started again (the new log continues from the last hash).

## Backups

A backup is a locked file (`CogniSecureStore.sealFile`, passphrase of at least 10 characters). The first is full; after that a **differential** backup holds only the records that changed since the last backup, and the keys that were removed. Merging a backup adds what is new, keeps what is the same, joins lists of entries by id or month with the newer entry winning, joins Shift boards with the board's own merge, takes a newer profile only when it really is newer, and removes a record only when this computer's copy is exactly what the other computer removed. Every conflict is reported by the kind of record and a short code, never by name. The index of what changed holds hashes, not records, and is sealed with them.

The reminder asks at most once a day, only when something has changed and no backup was made that day; it can be paused for a week or turned off. A bar at the foot of the window offers Back up now, Remind me tomorrow and Pause for a week.

Studio tracking, the journal, the seasonal plan and therapy goals are now kept in the sealed store with the resident profiles. An earlier version kept them in plain browser storage; opening the sealed store moves any such records across.

## Device lock

Off by default. When it is on, a saved license key copied from another computer's browser is not restored on this one, and the copy is not erased, so "Use this key on this computer" can move it. It compares a short SHA-256 tag of coarse traits (platform, touch, processor count, language, color depth) that never leaves the browser. It is a soft lock, not a security boundary: anyone holding the key text can still paste it, and a browser update or a new tablet can change the tag.
