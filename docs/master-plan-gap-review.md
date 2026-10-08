# The "Master Architect" plan, checked against the site (October 2026)

The owner pasted a plan from another assistant (Gemini). It covered five things:
- a site audit;
- five example packets;
- a roadmap: a PWA, IndexedDB, a PDF web worker, a four-tab rewrite of `index.html` with `styles.css` and `js/*.js`, Instant Soothe, CSV roster import, CMS logs and a preset manager;
- a hand-off prompt for Claude Code;
- 48–60 px touch targets.

The owner chose to keep the existing files and build only what was actually missing. Each item was checked against the code before anything was built.

## Already on the site

| Plan item | Where it is |
|---|---|
| PWA with an offline service worker | `sw.js` (fresh-first with an offline copy of every tool and its scripts), `manifest.webmanifest`, icons |
| IndexedDB vault for profiles and photos, AES-256 backups | `assets/services/secureStore.js`: an AES-GCM encrypted store kept in IndexedDB, locked `.cognicopia` backups and station handoffs |
| Roster with search, stage indicators and one-click printing | Packet Builder › Roster: search by name or unit, tier filters, three templates, two audiences, print |
| Profile builder in steps | `profile.html`: the Resident Activity Profile, with sections and exclusions ("topics to avoid") |
| Activity builder with a live preview and page ordering | Packet Builder: a configuration panel with a live preview, and the packet drawer with move up and down |
| Facility hub | Packet Builder › Facility Portal: wings, groups by acuity tier, month calendars, week packets, CSV and calendar exports, roles and an audit trail |
| "Discovery Mode" packet for an unknown background | The packet tool's guest presets (classic, educator, farmer, homemaker, veteran) need no profile |
| Birth-year reminiscence packet | The packet tool: era content from the birth year, the hometown and the work |
| Sensory and tactile worksheets for the late stage | Late-stage condition packet, calm mode, the Packet Builder's tracing pages and its sensory prompts for staff |
| Stage-scaled word search, hymn and song lines, a crossword from personal words | The packet tool: Personalized Word Search, Finish the Line (public-domain hymns and songs), "Fit the words in" built from the resident's own words |
| Family-facing digest | Packet Builder › Heirloom (monthly digest), and the family form |
| Activity documentation for surveys | Engagement Notes (built around CMS tag F679: individualized engagement and response), the participation log on condition packets, and the Engagement and Response Log in the life planner's binder |

## Built now

| Plan item | What changed |
|---|---|
| Instant Soothe without a profile | It used to be disabled until a resident was chosen. It now always works: with no resident it prints the general two-page calming packet (a slow tracing path and a familiar song); with a resident it prints their own page as before. |
| CSV roster import from an EHR | **Import Profiles (Restore)** reads a census export: First Name or "Last, First" names, Date of Birth (several formats), and Room or Bed. See [privacy-and-storage.md](privacy-and-storage.md#importing-a-census-spreadsheet). |
| Multi-facility preset manager | The Facility Portal had no backup. **Back up or move the portal** now writes the whole portal (wings, groups, team, calendars, audit trail) to a locked `.cognicopia` file and restores it. That covers a lost browser and a sister community. See [facility-portal.md](facility-portal.md#backing-up-or-moving-the-portal). |
| 48–60 px touch targets | Every control on the three tools is now at least 44 px tall, the WCAG 2.2 enhanced target size. That covers sidebar links, the menu button, segmented controls, chips, small portal buttons, the condition cards and disclosure rows. The only exceptions are links inside sentences. The overflow check passes at 320–1920 px. |

## Not built, and why

| Plan item | Reason |
|---|---|
| Rewriting `index.html` as four tabs with new `styles.css`, `js/app.js`, `js/db.js` and `js/generators.js` | The four workspaces already exist as separate, tested tools: the roster, the profile, the Packet Builder and the Facility Portal. A rewrite would duplicate them and risk every packet the tool makes today. |
| A PDF web worker | A packet PDF builds in about 0.3 s. Batch printing goes through the browser's own print pipeline. There is no main-thread stall to solve. |
| "CMS-compliant MDS 3.0 Section F log" | Section F is a preferences interview, not an attendance log. The site does not claim compliance with any regulation. The documentation pages listed above support F679 and leave the MDS to the facility's own process. |
| A facility logo upload | Pages carry the facility name. A logo is a reasonable later addition, but it is not needed for any workflow. |
