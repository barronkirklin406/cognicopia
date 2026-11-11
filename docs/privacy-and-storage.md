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
| The Shift board: handoff notes and staff tasks (residents by alias or room only, never meant to hold a name), the initials used on the board and how long to keep notes | `cognicopia_dailyops` | Encrypted. Notes and finished tasks older than the chosen 7, 14, 30 or 90 days are removed when the board opens; an open task is kept until it is done. A locked `.cognicopia` backup is the only copy that leaves the browser, and only when staff make it. See [daily-operations.md](daily-operations.md). |
| The Quality Standards Hub: the survey-readiness checklist (which items are ticked) and the facility's name for the printed cover sheet | `cognicopia_quality_audit` | Encrypted |
| Clinical & Caregiver Alignment: the objective chosen, which evidence items are ticked, the activity filters, and the community, wing, preparer and role for the printed sheets (never a resident's name) | `cognicopia_alignment_state` | Encrypted |
| The Research Center's board packet details: the community's name, who prepared it and their role, the meeting date, and the facility's counts, hours and hourly cost | `cg_rc_board` | Plain `localStorage`: nothing about a resident. The packet is made as a PDF on this computer, and **Clear these details** removes the copy. |
| The Research Center's reading settings (text size, line spacing, colors) | `cg_rc_reader` | Plain `localStorage`: nothing about a resident |
| Instant Soothe's memory of what it printed lately (so the next packet is new), and the last level and theme chosen | `cognicopia_soothe_history`, `cognicopia_soothe_last` | Plain `localStorage`: library ids and two option names only (for example `r079`, `m-fern`, `middle`, `nature`), never a name, a date or any text. Nothing about a resident. |
| The license: a signed license key (a business name, the plan and two dates, never a resident) and, after a card purchase, the Stripe checkout reference kept so the license can be renewed | `cognicopia_license_v2`, `cognicopia_license_ref` | Plain `localStorage`, on purpose. The key is signed, so hiding it protects nothing, and the answer to "is this computer licensed?" is needed at once on every page, even before a passphrase is typed. Every read checks the signature again, so editing the stored record unlocks nothing. |
| A second copy of the license key, so a restart, a blocked database or one lost copy does not ask for the key again (`js/license-persistence.js`, an ES module): the same signed key plus a hash of its signature, a date at most 365 days out (never past the day the key itself stops working) and a short hash of coarse device traits (platform, touch, processor count, language) | IndexedDB `cognicopia_store` (store `license`), and `localStorage` `cognicopia_store_license` as the backup. The tap-to-dismiss memory of the renewal notice is `cognicopia_store_notice_seen` | Plain, on purpose, for the same reason as the license above: the key is signed, so only the signature can grant access; the extra hashes catch damage and casual edits and are not secrets. The device hash is worked out and compared in the browser and is never sent anywhere. If either layer is blocked the other carries on; "Remove license from this computer" clears both. A business's name, never a resident |
| The agreement to the Terms of Service (`js/legal.js`, [terms-and-disclaimer.md](terms-and-disclaimer.md)) | `cognicopia_eula_accepted` | Plain `localStorage`: the word `true`, nothing about a resident |
| The invoice request form on the pricing page (`js/invoiceMaker.js`): a facility's business name, billing contact, accounts payable phone, address, PO number, license and building count, so a second request needs no retyping. "Clear the form" removes it | `cognicopia_invoice_request` | Plain `localStorage`: a business's details, never a resident. The PDF is made on the computer and nothing is sent |
| The earlier access code and the promo activation, layout choices, "no two sheets alike" counters | other names | Plain `localStorage`: nothing about a resident |
| The local database: resident profiles and the packets made for them (`src/services/localDb.ts`, [local-database.md](local-database.md)). Not yet used by a page | IndexedDB `CognicopiaLocalDB`, with the private details in `cognicopia_localdb_resident_<id>` and `cognicopia_localdb_packet_<id>` | Encrypted: a row keeps only the id, care level, times and template list |
| The free-packet count: one whole number, kept in three places so clearing one does not return the free packets (`src/services/trialLedger.ts`, `docs/trial-hardening.md`) | `cognicopia_gen_count`, an IndexedDB record `cg_trial`, and a Cache Storage entry `cg-trial-v1` | Plain: a number, nothing about a resident, no identifier, no cookie, nothing sent anywhere |

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

## Photos of a resident's people (November 10, 2026)

A person or pet in a resident's family list can have an optional photo. It is shrunk and turned gray in the browser and kept in the same encrypted store as the profile (`putBlob`, name `cognicopia_resident_photo_<resident>_<token>`); the profile keeps only the name. Nothing is sent anywhere, and nothing of it is in plain browser storage. Deleting the resident, or removing the photo, deletes it. The passphrase-locked station handoff file does not carry photos yet.

## The residents folder (November 11, 2026)

On the roster screen of the Packet Builder, "Keep residents in a folder on this computer" keeps every saved resident as a locked file in a folder the facility chooses, as well as in the browser (`js/residentFolder.js`). It is off until someone turns it on.

- **The files.** One resident to a file, `resident-<code>.cognicopia`, where the code comes from the resident's record number and never from their name. Each is the station handoff's locked file (AES-GCM, a key made from the passphrase with PBKDF2), so it also opens with the roster's "Receive a handoff". A note, `About these files.txt`, says what the files are. Photos stay in the browser and are not put in the folder.
- **When it reads and writes.** Opening the Packet Builder, a profile, the Activity Page Studio or Daily engagement reads every file that changed and takes the newer copy of each resident; a save (or a change on the roster) writes the residents that changed, and only those. A resident deleted here leaves the folder.
- **Several computers.** Point each at the same shared folder on the building's own network, with the same passphrase; each keeps the newer copy of a resident. A computer that still has a resident deleted on another one writes their file back: a missing file is never taken as a reason to delete a resident.
- **What is kept where.** The browser's permission to the folder (its handle) is in this site's IndexedDB; the passphrase and which file holds which resident are sealed in the encrypted store under `cognicopia_folder`, beside the residents themselves. "Stop using the folder" forgets both and leaves the files.
- **Honest limits, stated on the screen.** It needs Chrome or Microsoft Edge on a computer; other browsers say so and point to the handoff file. After the browser restarts it asks again before a page may use the folder ("Allow the folder again"). If the chosen folder is inside OneDrive, Dropbox, Google Drive or another online drive, that service copies the locked files to the internet: they leave the computer, still locked. "No resident data leaves the device" stays true for everyone who does not turn this on, and for a folder on the computer itself or the facility's own network.
- **Proof.** `scripts/check-resident-folder-ui.mjs` (in `npm run build`), with the browser's private file area standing in for a chosen folder. It runs in an ordinary browser profile on disk: in Playwright's usual private profile this Chromium stops when it reads a stored folder handle back.

## Aliases

With aliases on (Settings › Privacy & encryption), residents appear as "Resident 302-B" in the roster and every resident picker. Downloaded file names and print titles can use the alias too. The alias comes from, in order:

1. the one set on the profile;
2. "Resident" and the room or unit;
3. a short code made from the resident's ID.

A resident's own pages keep their name.

## One-click emergency activity

**Instant Soothe / Print** (the yellow button in the top bar, and Sundowning / Rapid De-escalation in the Packet Builder) opens a small dialog with two choices: the care level (mild / early, moderate / mid, acute / late) and a theme (nature and gardens, classic home and heritage, music and crafts, or a surprise mix). One press then makes a fresh one-to-three page calming packet and prints it from a hidden stage on the same page. With no resident chosen the packet is general and needs no profile; with one chosen it uses their level, the name on the page, the years they were young, and the topics to steer around. The packet is drawn on this computer from the library built into the page (`docs/soothing-packet-engine.md`); nothing is fetched and nothing is sent. Only library ids and the last two choices are remembered (`cognicopia_soothe_history`, `cognicopia_soothe_last`, above). Staff editing a resident profile can still choose a prepared activity: when that resident is active, the dialog offers **Print their saved calming page instead**, which opens the Packet Builder directly and prints that one page through the normal print dialog without adding to or replacing the saved packet queue. If the choice is empty, no longer available, or invalid, it uses fine-motor line tracing. Printing still follows the normal free-packet allowance and browser-print rules.

## Station handoffs (`.cognicopia`)

The Resident roster's **Back up this roster, or hand it off to another station** writes every saved resident into one file, locked with a passphrase chosen for that file. It uses the same format as the packet tool's locked backups, so either one opens the other's files.

On the receiving computer, **Receive a handoff** adds new residents. For a resident both computers already have, it keeps whichever copy was updated most recently.

Say the passphrase in person or by phone. Never send it in the same message as the file.

The Facility Portal's **Back up or move the portal** writes the portal (wings, groups, team, audit trail and calendars) into a file of the same locked kind. See [the portal's notes](facility-portal.md#backing-up-or-moving-the-portal).

The Shift board's **Back up, or move to another station** does the same for its notes and tasks (kind `dailyops`). Opening such a file on another station adds what that board is missing and never removes anything. See [daily-operations.md](daily-operations.md#moving-a-board-to-another-station).

## Importing a census spreadsheet

**Import Profiles (Restore)** on the packet tool also reads a census spreadsheet exported from an EHR. It needs one column for the name: Preferred Name, First Name, Resident Name or Full Name.
- **Names:** a name written "Smith, Margaret A." becomes "Margaret".
- **Birth dates:** a Date of Birth or DOB column gives the birth year. These forms are read: 03/14/1938, 1938-03-14, 14 Mar 1938 and 3/14/38 (two-digit years are read as the 1900s).
- **Rooms:** Room, Room/Bed or Bed fills the unit.
- **Other columns** are ignored.

Every row is rebuilt field by field against the profile schema and sealed in the encrypted store. The spreadsheet itself is never copied anywhere.

## The facility platform (separate from everything above)

A separate service for facilities is built in `platform/`, with sign-in for staff, a database in the cloud and subscriptions through Stripe. It keeps minimal data on a server: facility names; each facility's subscription status and its Stripe customer and subscription ids; staff email addresses and their roles (admin or staff); invitations to join (only a hash of each link's secret, and an email address if the admin chose to tie it to one); the shared activity library; and activity calendars that plan groups. Card details are entered on Stripe's own pages and never reach Cognicopia's servers; Stripe also holds the facility's name and the billing contact's email. The platform is built never to store resident data: no resident names, profiles, health details or notes. Everything above in this page, the resident profiles and the encrypted store, stays on the computer where it was typed. [The platform's architecture notes](saas-platform-architecture.md) explain how this is enforced and where it cannot be.

## The one page that contacts the internet

Everything above is offline. The single exception is `activate.html`, which turns a **card purchase** into a license key: Stripe sends the buyer to it with a checkout reference in the address (it starts with `cs_`), and the page sends that reference, and nothing else, to the license service (`platform/`, `POST /api/licenses/redeem`), which asks Stripe whether it was paid and answers with a signed key. No resident detail, no stored data and no cookie is part of that request. The key is then checked on the computer. Every other page, including the three tools, makes no network request, and `npm run build` fails if one does (`scripts/check-license.mjs` and `scripts/check-license-ui.mjs` both prove it). A key typed in, pasted, or carried in the address (`?license_key=` or `#license_key=`, removed from the address after it is read) never leaves the computer, and neither does a promo code or the earlier access code. See [stripe-setup-guide.md](stripe-setup-guide.md).

## What this is not

Cognicopia supports a facility's HIPAA privacy practices: nothing is transmitted, nothing is stored in a cloud, and what is saved is encrypted on the device. It does not make a facility HIPAA compliant, and the site does not claim to. A facility's own program still decides who may use which computer, how printed pages with names are handled, and when a shared computer is cleared (Settings › Clear saved data).

## Zero-telemetry statement, names in exports and wings

Settings carries a live statement that Cognicopia has no telemetry and counts the requests the page has made to other websites (it should read 0). Every export offers a names choice (aliases by default, remove personal details, or keep names), and a wing can be chosen so a roster never mixes with another's. The audit of every storage handler, and how it is proved, is in [facility-operations.md](facility-operations.md).

## Moving residents between computers (the station handoff)

There is no account and no cloud copy, so a resident saved on one computer is not on another. To move residents, use **Resident Roster, then "Back up this roster, or hand it off to another station"** in the Packet Builder. It makes one locked file (`.cognicopia`): AES-256-GCM, with a key drawn from a passphrase the person chooses (PBKDF2, SHA-256, 600,000 rounds). Nothing can be read without the passphrase, which should be told to the other station in person or by phone, never in the same message as the file. On the other computer, "Receive a handoff" opens it with the passphrase and adds the residents to that computer's own sealed store.

- **Names are kept by default** (since November 8, 2026). The file is locked, and a resident should arrive whole: name, room, hometown, notes. Before that the default was to swap names for aliases, which made a backup that could not restore a resident properly. Choosing aliases or "no personal details" is still offered for a file that is safer to share, and the screen says plainly that the residents opened from such a file will not get their real names or details back.
- **Opening a file twice is safe.** Nobody is added twice, and a copy changed later on the receiving computer is kept, not overwritten (the newer one wins).
- **A wrong or missing passphrase** is refused, as is a file that is not a Cognicopia roster.
- Proved with two separate browsers, as two real computers would be: `scripts/check-roster-handoff-ui.mjs` (in `npm run build`). It checks that no name, place or note can be read in the file, that every resident arrives intact, and that nothing leaves the page.
