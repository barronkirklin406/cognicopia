# Era banks: what the owner should look over

The packet tool's hybrid pages ("Trace and Talk" and the other five layouts) draw from `assets/services/eraBanks.js`.
Each entry is a name, a title or a short line with the years it belongs to. They are references, as a library would list
them. Nothing in the file is a song's words except public-domain lines (first published in 1930 or earlier), which
`scripts/check-public-domain.mjs` checks.

## Please look these over before release

1. **Slogans.** Each is short and marked `review` in the file. If you would rather not print any of them, delete the
   `slogan` rows and `npm test` still passes (the check asks for at least 20, so change the number in
   `scripts/check-variety.mjs` in the same commit, with the reason).
2. **Dates.** Every entry carries a year or a span. They were written from general knowledge, not looked up one by one, so
   skim the movie, television, song and milestone rows for a year that looks wrong. A wrong year makes an item turn up for the
   wrong birth years.
3. **Names.** Titles of films, shows, songs and the names of performers and characters are references only. Add or remove
   any you like; the check will tell you if an entry breaks a safety rule (loss or violence words, quiz words) or has no
   year.

## How a person's years are used

A resident with a birth year sees only entries whose years touch born + 7 to born + 28. A guest style with no birth year
mixes the decades it names (for example the 1940s and 1950s). Old public-domain songs are not dated to a person, since
anyone may know them.

## Known gaps

- The Packet Builder's own pages, Instant Soothe's pages and the landing page's example tabs do not use these banks yet.
- The first pages of the 1920s and 1980s have fewer entries than the 1940s to 1960s.
