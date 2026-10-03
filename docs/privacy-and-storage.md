# Privacy and storage

Cognicopia has no server, account or cloud copy. Everything staff type stays in the browser on the computer where it was typed. This page covers how that data is kept, what protects it, and how it moves between computers.

## What is kept, and where

| Kept | Storage name | How |
|---|---|---|
| Resident profiles | `cognicopia_resident_<id>` | Encrypted |
| The profile form in progress | `cognicopia_profile_draft` | Encrypted |
| The packet form in progress | `cognicopia_packet_draft` | Encrypted |
| The Packet Builder's queue, planner and journal forms, and settings (which can hold a default resident name) | `cgb_queue`, `cgb_planner`, `cgb_journal`, `cgb_settings` | Encrypted |
| Session notes, digest entries, reminiscence responses | `cognicopia_clinical_*`, `cognicopia_heirloom_*`, `cognicopia_remin_*` | Encrypted |
| Tablet staff mood-before/mood-after notes | `cognicopia_engagement_<resident-id>` | Encrypted; up to 100 recent session records per resident |
| Photos of finished pages (Memory Digest & Book) | `cognicopia_heirloom_photo_*` | Encrypted, in a separate photo store that is read only when a page needs a photo. A browser that cannot encrypt refuses photos rather than keeping them in plain storage. |
| The Facility Portal: wings, groups (and any residents linked to them), the team, the audit trail, and each wing's month calendar | `cognicopia_facility`, `cognicopia_facility_sched_<wing>_<month>` | Encrypted. Packets, calendars and files from the portal carry group names only. |
| The Academy: learners (staff names and roles), their lesson progress, knowledge-check scores, completions and certificate IDs, and the certificate approval statement | `cognicopia_academy` | Encrypted. Guides, toolkits and certificates are made as PDFs on this computer. |
| The Research Center's board packet details: the community's name, who prepared it and their role, the meeting date, and the facility's counts, hours and hourly cost | `cg_rc_board` | Plain `localStorage`: nothing about a resident. The packet is made as a PDF on this computer, and **Clear these details** removes the copy. |
| The Research Center's reading settings (text size, line spacing, colors) | `cg_rc_reader` | Plain `localStorage`: nothing about a resident |
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

## Station handoffs (`.cognicopia`)

The Resident roster's **Hand off to another station** writes every saved resident into one file, locked with a passphrase chosen for that file. It uses the same format as the packet tool's locked backups, so either one opens the other's files.

On the receiving computer, **Receive a handoff** adds new residents. For a resident both computers already have, it keeps whichever copy was updated most recently.

Say the passphrase in person or by phone. Never send it in the same message as the file.

## What this is not

Cognicopia supports a facility's HIPAA privacy practices: nothing is transmitted, nothing is stored in a cloud, and what is saved is encrypted on the device. It does not make a facility HIPAA compliant, and the site does not claim to. A facility's own program still decides who may use which computer, how printed pages with names are handled, and when a shared computer is cleared (Settings › Clear saved data).
