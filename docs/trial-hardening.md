# Hardening the 25 free packets

The problem: the free-packet count was one browser setting, so clearing it, or typing a smaller number into the developer tools, gave the free packets back. The constraints: no resident data may leave the browser, the tools must work offline, and nothing may look like surveillance. This page compares the options, says what was built, shows how it works, and lists the edge cases. The code is `src/services/trialLedger.ts`, checked by `scripts/check-trial.mjs` (no browser) and `scripts/check-trial-ui.mjs` (a real one).

## The honest starting point

A page that runs on the visitor's own computer and never contacts a server cannot make a limit that a determined person cannot beat. The code is readable and the storage is theirs to edit. Every option below is a trade between how hard the limit is to beat, how much it costs honest users, and what it does to the privacy promise. The right strength for a trial of 25 packets sold to facilities is one that stops accidents and casual edits and costs honest users nothing.

Two facts about this product make that acceptable:

- **Resetting the count costs the person their own work.** The only complete reset is clearing all of the site's data, or using another browser or a private window. That deletes the saved residents, the roster, the Shift board and the Academy progress held in the same browser. A facility that has set up residents will not do it to win back 25 packets.
- **The buyer is a facility.** An Activity Director's building pays $39 a month. The trial exists to let them see a real packet, not to be an obstacle course. A hard wall that sometimes locks out an honest person (a browser update, a new computer, a clean-up) costs more trust than the leakage costs revenue.

## Options compared

| | How it works | Stops clearing one setting | Stops clearing everything | Privacy | Offline | Verdict |
|---|---|---|---|---|---|---|
| **A. Redundant local ledger** (built) | The same whole number kept in three places in the browser; the largest is trusted; lower or missing copies are repaired | Yes | No | Nothing leaves; no identifier | Fully | **Chosen** |
| **B. Browser fingerprint hash** | Hash of screen, fonts, canvas, language and so on, kept (locally or on a server) to recognise a returning visitor | Yes (and survives clearing, if a server remembers it) | Only with a server | Poor: this is the technique of commercial tracking, and a facility's IT staff will flag it. On a shared facility computer many people share one fingerprint, so honest users are blocked | Needs a server to mean anything | Rejected |
| **C. Server-issued trial token / blind token** | The license service issues a signed trial token (blind-signed so it cannot be linked to the person); the server limits tokens per network address | Yes | Mostly (a new token needs a new address) | Better than B, but the address is still a signal, and a building's staff share one address, so honest facilities are refused | Needs a connection at first use, and a server call that breaks "the tools make no network request" | Rejected for now |
| **D. Free trial key by email** | The person asks for a free key; the license service emails a signed key limited to 25 uses | Not by itself: the use count is still local, so it adds friction and an email address but no new protection | No | An email is collected | Needs the connection once | Rejected: it costs conversion and adds nothing against the real problem |
| **E. Count on the printed sheet** | Each PDF carries a number; the person is asked to keep them | No | No | Fine | Fully | Not a limit |

What would truly anchor a count is a server that remembers something about the visitor. Every version of that either breaks "no network request from the tools" (a rule this project keeps, with one stated exception for activation) or collects a signal that undermines the privacy reputation. So the project does not do it, and says so.

## What was built (option A)

The count is kept in three places, and the largest valid number wins:

1. the page's own storage, under the key the pages have always used (`cognicopia_gen_count`), so nobody's current count resets when this ships;
2. a small IndexedDB record (database `cg_trial`);
3. a Cache Storage entry whose web address ends in the number (cache `cg-trial-v1`). It is deliberately not named `cognicopia-`, because `sw.js` deletes every cache with that prefix whenever the site updates.

Rules:

- A number is a whole number of one to six digits. Anything else is ignored, never punished.
- The count only goes up. Each read takes the largest of the page's storage and the highest number this page has already seen, and puts a lower stored number back.
- Each packet writes to all three, one write at a time per copy. A copy is only ever raised, never lowered, so a page that has not yet read the others cannot overwrite a higher number.
- On every page load the other two copies are read; the largest is adopted and any missing or lower copy is rebuilt. The packet counter on screen is refreshed if the count rose.
- An empty ledger writes nothing. If every copy is gone the count is zero. This is the stated limit, tested on purpose.
- Damaged storage does not lock anyone out: junk everywhere reads as nothing used.
- While any tab of the site is open, clearing the data under it does not reset the count, because that tab restores what it has seen.
- The browser is asked once, after the first packet, to keep the site's data when space runs short (`navigator.storage.persist()`), which makes an automatic clean-up much less likely. It is asked once, not on every packet, because one browser shows a prompt.
- A paid license ends the limit. The count is not erased by a license, so a lapsed license does not hand the free packets back.

What it never does: read a fingerprint signal, set a cookie (cookies travel to the server with every request), generate an identifier, or make a network request. `check-trial.mjs` fails the build if the source mentions any of them.

## How it works: the core, in short

```ts
// the largest valid number wins; a copy that is missing or behind is repaired
function merge(readings, floor) {
  let n = floor;
  for (const r of readings) if (r.n !== null && r.n > n) n = r.n;
  const repair = readings.filter(r => r.n === null || r.n < n).map(r => r.source);
  return { n, repair };
}

function count() {                       // synchronous: the gate calls this
  const p = parseCount(page.get()) ?? 0;
  const n = Math.max(p, floor); floor = n;
  if (p < n) page.set(String(n));        // a lowered number is put back
  return n;
}

function record() {                      // one packet used
  const n = count() + 1; floor = n;
  page.set(String(n));
  for (const m of mirrors) queue(m, () => m.raiseTo(n));   // never lowers a copy
  keepSafe();                            // asks the browser once to keep the data
  return n;
}

async function reconcile() {             // on every page load
  const readings = [{ source: "page", n: parseCount(page.get()) }];
  for (const m of mirrors) readings.push({ source: m.name, n: await m.read().catch(() => null) });
  const { n, repair } = merge(readings, floor);
  if (n > 0) repairCopies(n, repair);    // an empty ledger writes nothing
  return n;
}
```

The gate in both tools reads `genCount()`, which now asks the ledger. If the service could not load for any reason, the pages fall back to the old single setting, so the packet tools never depend on it.

## Edge cases

| Situation | What happens |
|---|---|
| Offline | Everything is local and the ledger script is in the offline cache. Nothing is needed from the network. |
| Cleared "cookies and cached files" only | The page setting and IndexedDB usually survive; either one restores the rest. |
| Cleared "cookies and other site data" for the site | All three copies go: a new count begins. The person also loses their saved residents and settings, and sees that straight away. |
| Browser update, or the browser cleaning up on its own | Much less likely once the browser has agreed to keep the data. If one copy goes, the others restore it. |
| A private or incognito window | A new, empty window starts a new count, and closes without keeping it. The ledger does not try to detect private windows: that detection is itself a tracking technique. |
| A browser that blocks storage | Counting works for that page's lifetime and starts again next time. Nothing breaks. |
| A new computer or a new browser | A new count. A paid license key, activated on each computer, removes the limit. This is the intended path for a facility with several computers. |
| Someone types a smaller number | Put back at once. A larger number only hurts the person who typed it. |
| Damaged or unreadable storage | Treated as nothing used. Honest people are never locked out by corruption. |
| Two tabs | One count. Each tab restores the highest number it has seen. |
| Upgrading to a paid license | The gate opens on a valid license key and stays open until the paid-through date plus the grace days. Nothing needs migrating: the free count simply stops mattering, and is kept so a lapsed license does not reset it. |
| Moving to another computer on purpose | `absorb(n)` raises a count to at least a number from a backup or another computer and never lowers it. It is built and tested, and not yet connected to the backup file, because the better path for a facility is a license key. |

## What was deliberately not built

- A server-side usage counter, a fingerprint, a blind-token service or a free-trial-by-email key, for the reasons in the table above.
- A watermark on trial packets. A resident cannot understand "SAMPLE"; a Director will not hand a stamped page to a person with dementia. See the note beside `WATERMARK_DEMOS` in `index.html`.
- Detection of private windows or of clearing, with a message to the person. A page that watches for it is surveillance by another name.

## If the leak ever matters

Measure first: the pilot and sample pages and the number of activations will show whether trial resets are real or imagined. If they are real, the next step that keeps the privacy promise is a free trial key tied to an email address on the activation page, which already contacts the license service once. That adds friction and an email, so it is a business decision, not a security one.
