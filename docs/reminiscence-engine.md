# Reminiscence engine

`src/services/reminiscenceEngine.ts` (built to `assets/services/reminiscenceEngine.js`, global `CogniReminiscence`) turns one resident's profile into reminiscence cards. The Packet Builder shows them at `#/reminiscence`.

## What a card carries

For the resident:

- a topic;
- a Cognicopia Coloring picture at their tier;
- one invitation in large type (tier 3: a short comment that needs no recall).

For the caregiver:

- **three conversation starters.** Two come from the topic. The third names something from the resident's own time and place.
- **one era-accurate song.** Their own favorite comes first.
- **one tactile prompt**, with a safety note.
- **up to three references** from their own years and place: brands, tools, radio and television.

## Who the resident is

| Profile field | Used for |
|---|---|
| `tier2_enrichment.birthYear` (or `age`) | The *reminiscence bump*: roughly ages 10 to 30, the years people recall most readily. Songs and references favor it, and anything outside their lifetime is dropped. |
| `tier2_enrichment.region` (new, optional) | Midwest, Great Plains, Northeast, New England, South, Appalachia, Texas and the Southwest, Mountain West, Pacific Coast, Canada, another country. When it is empty, the region comes from the hometown ("Minot, North Dakota" or "Dayton, OH"), and so does the state. |
| `tier2_enrichment.hometown.environment` | The setting, combined with the region: "Rural Midwest", "Urban Northeast". |
| `tier1_core.primaryVocation` (new) | Mechanic, Teacher, Military, Culinary, Nursing and 13 more. It follows the occupation (saved with `auto: true`) unless staff choose another. |
| `tier2_enrichment.music` | Their favorite song, genres and artists. |
| `tier1_core.topHobbies` | Hobby cards: fishing, gardening, sports, dancing, pets. |
| `tier1_core.topicsToAvoid` | Any topic, song, reference or picture tagged with one of these is never used. |
| `tier2_enrichment.military.talkingAboutIt` | Service cards appear only when this is "welcome" or "gentle". If the vocation is Military and this is unanswered, service cards are allowed. |

## Accuracy

Each reference carries the years it was current. References can also be limited to a region (for example, the Grand Ole Opry on WSM for the South and Appalachia) or to states (for example, the Horn & Hardart Automat for New York and Pennsylvania). Someone who grew up abroad hears only references marked as familiar everywhere.

Every entry was chosen for being well documented. When in doubt, an entry was left out.

## Wording

Starters invite: "Tell me about…", "What was … like?", "Who taught you…?". They never test memory ("Do you remember…", "What year…", "Can you name…"), and they never use pet names. `toneProblems()` checks this. `npm test` runs it over every line in the knowledge base and over 228 generated decks.

## Checks (`npm test`, `scripts/check-services.mjs`)

- **Knowledge base:** pictures exist in the Cognicopia Coloring library, years and state codes are valid, and each topic has enough starters and tier-3 lines.
- **Decks (228, across every vocation, tier, setting and avoid list):**
  - three different starters on every card;
  - no card or song twice;
  - a card about their own work;
  - nothing avoided;
  - no service card without a welcome;
  - references only from their lifetime and their own region or state;
  - the favorite song first and only once.
- **Behavior:** a deck repeats for the same seed, and one takes under 1 ms.
