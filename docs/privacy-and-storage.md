# Privacy and storage

Cognicopia has no server, account or cloud copy. Everything staff type stays in the browser on the computer where it was typed. This page covers how that data is kept, what protects it, and how it moves between computers.

## What is kept, and where

| Kept | Storage name | How |
|---|---|---|
| Resident profiles (including the optional one-click emergency activity choice) | `cognicopia_resident_<id>` | Encrypted |
| The profile form in progress | `cognicopia_profile_draft` | Encrypted |
| The packet form in progress | `cognicopia_packet_draft` | Encrypted |
| The Packet Builder's queue, planner and journal forms, and settings (which can hold a default resident name) | `cgb_queue`, `cgb_planner`, `cgb_journal`, `cgb_settings` | Encrypted |
| Session notes, digest entries, reminiscence responses | `cognicopia_clinical_*`, `cognicopia_heirloom_*`, `cognicopia_remin_*` | Encrypted |
| Tablet staff mood-before/mood-after notes | `cognicopia_engagement_<resident-id>` | Encrypted; up to 100 recent session records per resident |
| Photos of finished pages (Memory Digest & Book) | `cognicopia_heirloom_photo_*` | Encrypted, in a separate photo store that is read only when a page needs a photo. A browser that cannot encrypt refuses photos rather than keeping them in plain storage. |
| The Facility Portal: wings, groups (and any residents linked to them), the team, the audit trail, and each wing's month calendar | `cognicopia_facility`, `cognicopia_facility_sched_<wing>_<month>` | Encrypted. Packets, calendars and files from the portal carry group names only. |
| The Academy: learners (staff names and roles), their lesson progress, knowledge-check scores, completions and certificate IDs, and the certificate approval statement | `cognicopia_academy` | Encrypted. Guides, toolkits and certificates are made as PDFs on this computer. |
| The Quality Standards Hub: the survey-readiness checklist (which items are ticked) and the facility's name for the printed cover sheet | `cognicopia_quality_audit` | Encrypted |
| Clinical & Caregiver Alignment: the objective chosen, which evidence items are ticked, the activity filters, and the community, wing, preparer and role for the printed sheets (never a resident's name) | `cognicopia_alignment_state` | Encrypted |
| The Research Center's board packet details: the community's name, who prepared it and their role, the meeting date, and the facility's counts, hours and hourly cost | `cg_rc_board` | Plain `localStorage`: nothing about a resident. The packet is made as a PDF on this computer, and **Clear these details** removes the copy. |
| The Research Center's reading settings (text size, line spacing, colors) | `cg_rc_reader` | Plain `localStorage`: nothing about a resident |
| Instant Soothe's memory of what it printed lately (so the next packet is new), and the last level and theme chosen | `cognicopia_soothe_history`, `cognicopia_soothe_last` | Plain `localStorage`: library ids and two option names only (for example `r079`, `m-fern`, `middle`, `nature`), never a name, a date or any text. Nothing about a resident. |
| License, free-packet count, layout choices, "no two sheets alike" counters | other names | Plain `localStorage`: nothing about a resident |

The sheet counters used to be stored under names built from a resident's name, birth year and hometown. They are now stored under a hash of those details, and the old names are moved the next time the packet tool opens.

## The encrypted store (`src/services/secureStore.ts`)

- **Cipher.** Each record is sealed with AES-256-GCM (Web Crypto). Every write uses a fresh 96-bit IV, and the record's own name is the additional authenticated data, so a changed record, or one moved to another name, will not open.
- **Where.** Records live in IndexedDB (`cognicopia-secure`), not in `localStorage`. Plain copies left over from before are sealed the first time a page opens, then removed.
- **Device key (the default).** The key is a non-extractable `CryptoKey`: page scripts can use it but cannot read it. This browser keeps it, so the records are unreadable to anything that copies the storage files without this browser profile. Anyone who can open this browser on this computer can still open them.
- **Passphrase (optional, Packet Builder › Settings › Privacy & encryption).**
  - The data key is then kept only wrapped, under a key derived from the passphrase (PBKDF2-SHA-256, 600,000 rounds).
  - After an unlock, staff choose how long this computer stays unlocked: 15 minutes, 1 hour, a shift, or this page only. Each save extends the time.
  - **Lock now** forgets the key everywhere on this computer, and open pages reload so no names stay on screen.
  - A forgotten passphrase cannot be recovered, by anyone.
- **Without encryption.** If a browser has no IndexedDB or Web Crypto, the store says so in Settings and uses plain `localStorage`, so the tools keep working.
- **Speed.** 300 sealed residents open in under 30 ms (measured by `npm test` and in Chromium).

## Aliases

With aliases on (Settings › Privacy & encryption), residents appear as "Resident 302-B" in the roster and every resident picker. Downloaded file names and print titles can use the alias too. The alias comes from, in order:

1. the one set on the profile;
2. "Resident" and the room or unit;
3. a short code made from the resident's ID.

A resident's own pages keep their name.

## One-click emergency activity

**Instant Soothe / Print** (the yellow button in the top bar, and Sundowning / Rapid De-escalation in the Packet Builder) opens a small dialog with two choices: the care level (mild / early, moderate / mid, acute / late) and a theme (nature and gardens, classic home and heritage, music and crafts, or a surprise mix). One press then makes a fresh one-to-three page calming packet and prints it from a hidden stage on the same page. With no resident chosen the packet is general and needs no profile; with one chosen it uses their level, the name on the page, the years they were young, and the topics to steer around. The packet is drawn on this computer from the library built into the page (`docs/soothing-packet-engine.md`); nothing is fetched and nothing is sent. Only library ids and the last two choices are remembered (`cognicopia_soothe_history`, `cognicopia_soothe_last`, above). Staff editing a resident profile can still choose a prepared activity: when that resident is active, the dialog offers **Print their saved calming page instead**, which opens the Packet Builder directly and prints that one page through the normal print dialog without adding to or replacing the saved packet queue. If the choice is empty, no longer available, or invalid, it uses fine-motor line tracing. Printing still follows the normal free-packet allowance and browser-print rules.

## Station handoffs (`.cognicopia`)

The Resident roster's **Hand off to another station** writes every saved resident into one file, locked with a passphrase chosen for that file. It uses the same format as the packet tool's locked backups, so either one opens the other's files.

On the receiving computer, **Receive a handoff** adds new residents. For a resident both computers already have, it keeps whichever copy was updated most recently.

Say the passphrase in person or by phone. Never send it in the same message as the file.

The Facility Portal's **Back up or move the portal** writes the portal (wings, groups, team, audit trail and calendars) into a file of the same locked kind. See [the portal's notes](facility-portal.md#backing-up-or-moving-the-portal).

## Importing a census spreadsheet

**Import Profiles (Restore)** on the packet tool also reads a census spreadsheet exported from an EHR. It needs one column for the name: Preferred Name, First Name, Resident Name or Full Name.
- **Names:** a name written "Smith, Margaret A." becomes "Margaret".
- **Birth dates:** a Date of Birth or DOB column gives the birth year. These forms are read: 03/14/1938, 1938-03-14, 14 Mar 1938 and 3/14/38 (two-digit years are read as the 1900s).
- **Rooms:** Room, Room/Bed or Bed fills the unit.
- **Other columns** are ignored.

Every row is rebuilt field by field against the profile schema and sealed in the encrypted store. The spreadsheet itself is never copied anywhere.

## The facility platform (in development)

A separate service for facilities is being built in `platform/`, with accounts for staff and a database in the cloud. It keeps minimal data on a server: facility names, subscription status, staff email addresses, the shared activity library, and activity calendars that plan groups. It is built never to store resident data: no resident names, profiles, health details or notes. Everything above in this page, the resident profiles and the encrypted store, stays on the computer where it was typed. [The platform's architecture notes](saas-platform-architecture.md) explain how this is enforced and where it cannot be.

## What this is not

Cognicopia supports a facility's HIPAA privacy practices: nothing is transmitted, nothing is stored in a cloud, and what is saved is encrypted on the device. It does not make a facility HIPAA compliant, and the site does not claim to. A facility's own program still decides who may use which computer, how printed pages with names are handled, and when a shared computer is cleared (Settings › Clear saved data).
