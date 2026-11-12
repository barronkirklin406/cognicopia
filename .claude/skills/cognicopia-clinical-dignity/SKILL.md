---
name: cognicopia-clinical-dignity
description: "Use whenever editing resident profiles, era tables, prompt generators, stage rules, staff tips, or marketing copy for Cognicopia: exact birth-year era facts, honest thin-data fallbacks, late-stage pages, hand-under-hand, trauma-informed, faith and pronoun rules, and the claims the product may not make."
---

# Cognicopia clinical fit, accuracy and claims guard

Cognicopia's printed pages are only as good as their facts and their fit. The playbook found content a family member would notice (ration books in a 1954 childhood, Protestant hymns for a Catholic resident, a man called "her") and pages that claim more than the product can back. Each rule below is a defect that was found in a packet; each has a test or a check to add. Tone first: write every resident-facing line as for an adult relative. Invite; never test.

## Era facts come from the exact birth year

- **Never key childhood or youth facts by birth decade.** The packet tool did, so everyone born 1940 to 1949 got "ration books" (a resident born in 1946 was told "Around 1954, age 8: ration books"; US rationing ended in June 1947).
- Compute the formative window from the exact `birthYear`: **`birthYear + 7` to `birthYear + 28`**. An event belongs on a page only if its year falls in the window (and, for a childhood fact, only if the resident was old enough to meet it). One source for every page: the reminiscence engine already works in year ranges; make it the single source and retire decade tables.
- **Boomers (born 1946 to 1964)** are now entering memory care: their formative years run from the 1960s to the 1980s. Content for the 1960s to 1980s (music, television, cars, fashion, events) must exist and be accurate.
- **Korsakoff profiles are not fixed at 1940 to 1960.** Alcohol-related brain damage, Korsakoff syndrome included, is usually diagnosed at about 40 to 60, so the formative years run from the 1970s to the 2000s. Compute from birth year; never hardcode a Korsakoff era.
- Beyond the US Midwest: era content assumes a US, English-speaking, Christian upbringing. Use the profile's first language for a few prompts, and regional packs (Upper Midwest, South, Northeast, farm, city) only when the profile says so.
- **Note for engineers:** the reminiscence engine (`assets/services/reminiscenceEngine.js`) and the pages built on it today use a "bump" of ages 10 to 30, and the packet tool's era table was decade-keyed when the playbook measured it. This skill's window (`birthYear + 7` to `+ 28`) is the owner's rule: reconcile all of them to it, in one change, with the checks updated.

## Honest thin-data fallback

- When a resident profile has **fewer than 3 personal facts**, never print headings such as "Topics inspired by your life & passions" or "Chosen for you" above generic words (CHERISH, FAMILY, HEART, HOME, LOVE). Use neutral headings ("Words to find", "Things to talk about").
- On the staff companion sheet print: **"Ask the family about work, hometown, and one joy to personalize future packets."**
- A word search never holds only generic words: life words first, generic words last. Vary first lines across residents and months ("Cherished memories with ___" for every resident is the defect). No repeats across months: use the per-resident record of what was printed.
- Show staff how well each resident is known ("3 of 8 facts") and the next best question to ask. Use every field the form asks for (first car, first job) on some page, or remove the field.

## Stage-appropriate pages and technique

- **Late stage (GDS 6 to 7): no word searches, no writing lines, no historical trivia questions.** One item per page, built on touch, sorting, music, a familiar job's motions, or holding a photo. (The playbook found a late-stage packet that still asked "What did people around you say when the Peace Corps began?")
- A page with one right answer (Finish the Thought, Match the Coins, the clock page) is for the early stage and is labeled for staff as a choice page, not a test; a closed-answer page does not print an answer key on the resident's sheet.
- **Hand-under-hand, never hand-over-hand.** Every staff tip, page and Academy line says hand-under-hand (the gentler Positive Approach to Care method the Academy teaches). A tip never contradicts its page: "Do not ask questions or test memory" is never printed above a page of questions.
- Tips refer to a page **by its title**, never by a hardcoded number ("hesitates on Page 3" printed on page 10 of 62 is the defect).

## Trauma, faith, pronouns, food

- **Never default `#pronoun` to she/her.** Leave it blank and use the first name until staff choose. A page never says "her" or "his" for a resident whose pronoun is blank.
- **Match hymns and sayings to the selected faith** (Catholic, Protestant, Jewish, Muslim), and to **secular/none when the field is blank**: a blank profile prints no hymns. Let diet and faith steer food words ("Bacon - Eggs" in matching pairs does not suit every resident).
- **Military service prompts** ("Where did the Army send you?") print **only when staff explicitly check "Military service is a welcome topic"** (trauma-informed care, F699: nursing homes have had to provide it since November 28, 2019). Born 1946 with Army service is likely the Vietnam era; the default is silence.
- Bingo and puzzle words keep their spaces and capitals ("TV dinner", "CB radio", "the Twins", "drive-in"); a squashed "Tvdinner", "Cbradio" or "Thetwins" is a defect.
- A prompt opens a story rather than repeating the title: "What color would you have picked for a '57 Bel Air?", not "Let's talk about a '57 Chevy Bel Air."

## Regulatory and wellness claims: never make these

Never print, on any page, in any copy, email or Academy lesson:

- "immediate, objective proof ... for state surveys under CMS Tag F679" (say "supports documentation"; a worksheet supports a record, a surveyor looks at assessments, care plans, observation and interviews; F679 is a nursing-home rule, and assisted living is licensed by each state)
- "counteract tremors" and "tremor-absorbing boundaries"
- "Fine Motor Rehabilitation"
- "Testing Anxiety Elimination"
- **"CST Suite"** or any use of "CST" for a Cognicopia page or suite: Cognitive Stimulation Therapy is a specific 14-session group program for mild to moderate dementia, not a single packet
- **"Snoezelen"** (a registered-trademark sign of Rompa): say "multi-sensory"
- "HIPAA compliant", "CMS compliant", "ensures compliance", "proves", "survey-proof" (compliance belongs to a facility's program; say "supports a facility's HIPAA privacy practices" and "No resident data leaves the device")
- RN, PT or SLP reviewer badges or initials without a **named, real reviewer** and the date they last reviewed the stage rules; a customer quote, case study or testimonial that is not real; a self-score styled as proof ("Clinical readiness 100/100": call it a print check)
- a time saved, a percentage or a result that `scripts/audit-ux.mjs` or a logged pilot has not measured

Add each phrase to `scripts/check-claims.mjs` (it scans pages, tool scripts and built services; guidance files like this one may quote what they forbid) so the build refuses it. Medical-device wording is a legal question: ask a regulatory lawyer to read the claims once, as the playbook says.

## Verify

Generate packets for invented residents and **read the PDFs back** (PyMuPDF): one born 1946 (no ration books), one Catholic and one with blank faith, one man with a blank pronoun, one census-only resident with fewer than 3 facts, one at GDS 6 to 7, one marked military-welcome and one not. Test data uses made-up people only. A change to wording, era data or stage rules is not finished until `npm run build` passes and those packets read as an adult relative would want.
