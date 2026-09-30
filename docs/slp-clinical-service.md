# SLP clinical service and Session Notes

`src/services/slpClinicalService.ts` (built to `assets/services/slpClinicalService.js`, global `CogniClinical`) is for speech-language pathologists and therapy staff who use Cognicopia materials in skilled sessions. Its screen is **Session Notes** in the Packet Builder (`#/clinical`).

## Staging to tiers

A clinician records the resident's stage from the clinical record: Reisberg's Global Deterioration Scale (GDS, 1982), Functional Assessment Staging (FAST, 1988), or both. Cognicopia then suggests a support tier:

| Tier | GDS | FAST | Pages |
|---|---|---|---|
| 1 · Full detail | 3–4 | 3–4 | Multi-step tasks, open questions, fine lines |
| 2 · Guided | 5 | 5 | Fewer, larger elements, one step at a time, bold lines |
| 3 · Simplified | 6 | 6a–6e | One focal subject, extra-bold lines, comments and either/or choices |

Beyond that range:

- **GDS 1–2 or FAST 1–2:** the suggestion is Tier 1, with a note that standard materials may suit better.
- **GDS 7 or FAST 7a–7f:** marked as past what printed pages serve well, pointing to one-to-one sensory, music and touch-based engagement.
- **GDS and FAST disagree:** the tier with more support is suggested, and the difference is flagged for the clinician.

Cognicopia never infers a stage from activity results. The suggestion changes a resident's profile only when staff press **Set the profile to Tier N** and confirm.

## Session notes (SOAP)

Each session records:

- date, minutes, and individual or group;
- discipline, provider and credentials;
- goals addressed and the Cognicopia materials used;
- S, O (measures: task, trials, correct, cue level, note), A and P;
- procedure codes with units, and a co-signature.

The log is sealed in the encrypted store under `cognicopia_clinical_<resident id>` (see `docs/privacy-and-storage.md`).

**Every word on a note is what staff recorded.** The service only does three things:

- it arranges the entries;
- it works out the arithmetic of the numbers entered (4 of 5 trials becomes 80%);
- it prints an empty section as *Not recorded*, in a box to write in by hand.

It never writes a finding, an assessment or a plan.

Notes print on US Letter with the 0.75 in binding gutter. A long note continues onto following pages ("continued" headings, "Page 2 of 3"), and the signature lines always fall on the last page. The page estimate is tested in Chromium on 180 generated pages: none overflows.

The **Full Administrative Binder** (Resident roster) ends with a clinical summary and the notes from the last 30 days. The **Resident-Facing Book** never includes them.

## Procedure-code reference and checks

The reference gives short, plain-language summaries of the codes therapy staff ask about most. These summaries are not the AMA's CPT descriptors.

| Code | Summary | Checks |
|---|---|---|
| 97129 | Cognitive function intervention, direct one-on-one, first 15 minutes | Timed: minutes required; warns in a group session |
| 97130 | Each additional 15 minutes | Add-on: only with 97129 |
| 92507 | Speech, language, voice, communication or auditory processing treatment, individual | Untimed: one per session; group sessions use 92508 |
| 92508 | The same, group | Warns on an individual session |
| 96125 | Standardized cognitive performance testing, per hour | Name the instrument in O |
| 97124 | **Massage** (therapeutic procedure) | **Stops:** not a cognitive code; points to 97129/97130 or 92507 |

The notes also check:

- that the date is present;
- that minutes are recorded when a timed code is used;
- that timed units match the recorded minutes (arithmetic only);
- that a note does not go out with S, O, A and P all empty.

The treating clinician chooses codes under current CPT and payer rules. This is a reference, not billing advice.

## Tests

`npm test` (in `scripts/check-services.mjs`) covers:

- every GDS and FAST stage mapped to its tier, stage 7, disagreements, and missing stages;
- each code check;
- cleaning and bounds;
- that S, A and P print exactly as typed, and that O is only the recorded numbers and their arithmetic;
- page numbering, signature placement and continuation;
- HTML escaping of everything typed.
