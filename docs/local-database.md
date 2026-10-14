# The local database (CognicopiaLocalDB)

A private, offline database for resident profiles and the activity packets made for them. It lives in the browser's own IndexedDB on the computer where it was used. It makes no network request of any kind, and it has no server, account or cloud copy. The code is `src/services/localDb.ts`, built into `assets/services/localDb.js` (`CogniLocalDb`) by `npm run services`. It is checked by `scripts/check-localdb.mjs` (no browser) and `scripts/check-localdb-ui.mjs` (a real browser).

**Status:** the module is finished and tested, and it is not yet used by any page. The resident profiles the pages use today are still kept by the encrypted store under `cognicopia_resident_<id>` (see [privacy and storage](privacy-and-storage.md)). A page adopts the database by adding `<script src="assets/services/secureStore.js"></script>` and then `<script src="assets/services/localDb.js"></script>`, in that order.

## The two stores

| Store | Key | What a row holds |
|---|---|---|
| `residents` | `id` | `id`, `cognitiveTier` (`Mild`, `Moderate` or `Advanced`), `createdAt`, `updatedAt`, and the private details: `firstName`, `hometown`, `pastOccupation`, `hobbies`, `interests` (a list) |
| `generatedPackets` | `id` | `id`, `residentId`, `timestamp`, `selectedTemplates` (a list), and the private page content: `htmlContent` |

`generatedPackets` has two indexes, `byResident` and `byTimestamp`. The database is `CognicopiaLocalDB`, version 1.

## Sealed at rest

A first name, a hometown and a printed page are a person's life story, so they are not written to this database as plain text. When the encrypted store is open, each row keeps only what a lookup needs (the id, the care level, the times, the template list). The private details are sealed in the encrypted store with AES-256-GCM, under the names `cognicopia_localdb_resident_<id>` and `cognicopia_localdb_packet_<id>`. That means the optional passphrase and **Lock now** cover this data as well: while the store is locked, every call rejects with code `locked`.

Only a browser that cannot encrypt at all (no Web Crypto) falls back to plain rows, the same rule the encrypted store follows. Each row says `sealed: true` or `sealed: false`, and `info()` reports which.

## The functions

All are asynchronous. Each is documented in the source.

| Function | What it does |
|---|---|
| `saveResident(profileData)` | Adds a resident, or updates the one with the same `id`. Keeps `createdAt`. Returns the saved profile. |
| `getResident(residentId)` | One profile, or `null`. |
| `getAllResidents()` | Everyone, by first name. A profile whose sealed details will not open comes back with `unreadable: true` and empty details, so damage is seen and not hidden. |
| `savePacket(packetData)` | Keeps a packet for a saved resident. The time defaults to now. |
| `getPacketsForResident(residentId)` | That resident's packets, newest first. |
| `deleteResident(residentId)` | Removes the profile and every packet kept for them, including the sealed records. Returns how many packets went. |
| `deletePacket(packetId)` | Removes one packet (to free room). |
| `clearAll()` | Erases everything, for a page's "clear saved data". A page that adopts the database should call it there. |
| `info()` | `{ name, version, sealed, state }`. |

## What is accepted

Only these fields are ever stored. Anything else in what a form passes in is dropped, so nothing else can creep into the database.

- `firstName` is required, up to 80 characters. There is no last-name field. Do not put a last name, a birth date or a medical record number in any field.
- `cognitiveTier` is required: `Mild`, `Moderate` or `Advanced` (any capitals).
- `hometown` and `pastOccupation` are up to 120 characters, `hobbies` up to 500 (text, or a list that is joined with commas), and `interests` is a list of up to 50 short items with no repeats.
- Text has control characters and angle brackets removed.
- Ids are 1 to 64 letters, digits, dashes or underscores. When none is given, one is made.
- A packet needs a saved resident, page content as text (up to 5 million characters) and a list of template names. The content is stored as text and must never be put into a page without being cleaned first.

## Errors

Every call rejects with a `LocalDbError`. It has a plain-language `message` and a short `code`:

| Code | Meaning |
|---|---|
| `invalid` | what was given cannot be stored (the message says what to fix) |
| `not-found` | a packet was offered for a resident who is not saved |
| `locked` | the encrypted store is locked: unlock it with the passphrase |
| `quota` | the computer is out of room: delete older packets |
| `unavailable` | this browser has no IndexedDB, or blocks it (a private window, blocked site data), or another tab holds the database open |
| `failed` | anything else; the browser's own error is kept as `cause` |

## What it does not do

- It does not make the data impossible to read on a computer that someone can unlock. With no passphrase, the key is a device key kept in this browser, so the records are unreadable to anything that copies the storage files without the browser, but not to someone who can open this browser profile. A passphrase is the stronger setting.
- Clearing all of the site's data deletes it. There is no copy anywhere else, by design.
- It does not move data between computers. The locked `.cognicopia` handoff file is for that.
