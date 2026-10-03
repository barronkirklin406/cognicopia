# Facility Portal

The Facility Portal is an Activity Director's view of the whole community, wing by wing. Its screen is in the Packet Builder (`#/facility`). It opens from the sidebar (**Facility › Facility Portal**), from its card on the Packet Builder home page, or with the **Facility view** switch in the top bar on screens wider than 560 px. The switch turned off returns to the screen you came from.

`src/services/facilityPlanner.ts` (built to `assets/services/facilityPlanner.js`, global `CogniFacility`) holds the model and does the scheduling. The screen draws it and saves it. Neither sends anything anywhere.

## Roles

**Viewing as**, in the portal's header, switches between the people on the team:

| Role | Sees | Can change |
|---|---|---|
| Activity Director | Every wing, and **Team & audit** | Everything: wings, groups, calendars, the team |
| Wing Coordinator | Their wings | Their wings' groups, calendars and session times |
| Care Staff | Their wings | Nothing; they see the calendar and print |

Roles are views on this computer, not logins. Anyone who can open Cognicopia on the computer can switch between them, and the screen says so. Every change goes into an audit trail with who made it. The trail keeps the last 300 changes and downloads as a CSV.

## Overview

- **Stat tiles:** wings, residents in groups, sessions scheduled this month (of those the session times plan for), wings in balance, and sessions to review.
- **Wing cards:** each wing's groups and tiers, how full its month is, and a small per-pillar chart. Each card has an **Auto-populate** button while the month has gaps.
- **Acuity mix:** groups and residents by tier.
- **Recent changes.**

The first time the portal opens it holds an example community: Memory Care West and Assisted Living East, with four groups. The director can **Keep it** or **Start empty**.

## Wings, groups and acuity tiers

A wing (or floor) has resident groups, session times and a session length.

| | Limit |
|---|---|
| Wings | 24 |
| Groups in a wing | 12 |
| Residents in a group | 1 to 60 |
| Sessions a day | Up to 4 on weekdays and 4 on weekends, between 6:00 AM and 9:00 PM |
| Session length | 15 to 120 minutes |
| Team | 50 people |

Each group has one of four acuity tiers:

| Tier | Name | Prints at | For | Approach |
|---|---|---|---|---|
| 1 | Mild Support | Early stage | Residents who work mostly on their own, with light cues | Full-detail pages: multi-step puzzles, open questions, finer lines |
| 2 | Moderate Engagement | Moderate stage | Residents who join in best with a guide beside them | Guided pages: fewer, larger elements, one step at a time |
| 3 | Advanced Sensory | Advanced stage | Residents who connect most through music, movement and touch | Sensory first: sing-alongs, seated movement, tracing, single-focus pictures |
| 4 | Universal Group | Moderate stage | Mixed-ability groups a facilitator leads together | Group programs everyone can join |

A group can be linked to saved resident profiles. Their profile tiers are shown to help set the group's tier. The names stay on the screen: packets, calendars and files carry the group's name only.

## Recommendations for a tier

Choosing a tier updates the six-pillar activity generator underneath at once. The pillars and the Packet Builder categories behind them are:

| Pillar | Category |
|---|---|
| Coloring | Cognicopia Coloring |
| Numbers | Number & Math |
| Words | Word & Language |
| Letters | Letter & Alphabet |
| Movement | Exercise & Movement |
| Music | Music, Rhythm & Sound |

Each of the Packet Builder's 24 activities lists the tiers it is calibrated for, and the tiers it suits best. Every pillar shows what suits the chosen tier, best fits first:
- Tier 4 puts group programs ahead.
- Tier 3 puts sensory activities ahead.

The rest are set aside under **Not calibrated for Tier N**. Every tier has at least one activity in every pillar.

- **Add to packet** adds the activity to the packet queue at the tier's level.
- **Open in generator** opens the activity's category. There, a banner names the group and tier, and calibrated activities come first, marked **Recommended for Tier N**. The activity opens with the tier's level already chosen. Coloring opens the Cognicopia Coloring library at the group's support tier. **Show everything** returns the usual order.
- **Time of day pacing** reorders the suggestions without changing the group's acuity calibration: choose **10:00 AM · Higher engagement** to lead with movement, numbers and letters, or **5:00 PM · Gentle & soothing** to lead with coloring, music and words. Within each pillar, the activity order also favors less sensory/longer tasks in the morning and more sensory/shorter tasks later. **All times** keeps the usual tier-first order.

## The month calendar

**Auto-populate {month}** fills every day of the month for every group in one click, or for one group if one is chosen:

- **Balanced.** In every group, each pillar is within one session of the others.
- **Calibrated.** Every activity suits its group's tier.
- **Varied.** The same pillar never comes twice in a group's day. An activity is not used again within a week when another in the pillar fits, and the one rested longest comes first.
- **Suited to the time of day.** The day's pillars are chosen for balance first, then arranged so energizing ones (Movement, Numbers, Letters) come earlier and calming ones (Music, Coloring, Words) later: a gentle hand against late-day restlessness. In a November month with four groups, the last session of the day was a calming pillar 76% of the time with two sessions a day, 94% with three and 100% with four.
- **Respectful of staff.** Locked sessions stay exactly where they are, and other groups are untouched when one group is filled.

Each fill is a fresh arrangement of the unlocked sessions; **Undo** puts the previous one back.

**Moving sessions**
- **Drag** a session to another day. Dropped on its group's session at the same time, the two trade places.
- **With a keyboard,** focus a session, press **Space**, choose a day with the arrow keys (a week at a time with Up and Down), and press **Space** or **Enter**. **Escape** cancels.
- Moved sessions are locked, so filling the month again keeps them there. Every move can be undone.

**Editing.** Select a session to change its activity, day, time, note or lock. **+** on a day adds one.
- An edit that would put a group in two places at once is refused with a message naming the other session.
- A new session suggests the pillar that group has had least that month.

**After a tier change,** sessions whose activity no longer suits the group are marked. **Recalibrate** swaps each unlocked one for an activity in the same pillar that does suit it, keeping days, times, pillars and balance. Locked sessions are left for staff to open.

**Layout.** The calendar is a month grid, or a day-by-day list. The list is used on narrow screens, and at any width on request. In the grid, a day showing all groups lists four sessions, then **+N more** opens the whole day.

## Printing and files

**A week of packets, in one click**
- For each chosen group: a cover sheet (the tier and its approach, the group's notes, the week's sessions with times, and lines for facilitator notes), then every session's activity page at the tier's level, dated for its session.
- A cover runs onto more pages when the week is long.
- **One master each** prints one copy of each page; **One per resident** prints one for everyone in the group.
- Above 120 pages the portal asks first. Above 600 it refuses, and suggests master copies or fewer groups.
- Each print uses one free packet, like every other print.

**The month's calendar:** a page for each group. It splits over two or more pages when the days are too full to read.

**Spreadsheet (CSV)**
- RFC 4180, UTF-8, one row per session.
- A text cell that a spreadsheet would read as a formula (starting with `=`, `+`, `-`, `@`, a tab or a return) is stored with an apostrophe in front.

**Calendar (.ics)**
- RFC 5545, for Outlook, Google Calendar or Apple Calendar.
- Times are the facility's own clock (floating local time), text is escaped, and lines are folded at 75 octets.

## Where it is kept

The portal is sealed in the encrypted store like resident profiles (see [Privacy and storage](privacy-and-storage.md)):
- the community (wings, groups, team, audit trail) under `cognicopia_facility`;
- each wing's month under `cognicopia_facility_sched_<wing>_<YYYY-MM>`.

**Team & audit › Remove the portal from this computer** removes all of it. Resident profiles are not touched.

## Design

The portal has its own palette:
- deep green cards (`#23382b`) with tan borders (`#b5a48b`);
- dark green dividers (`#2e4a38`, decorative only);
- white text;
- a pale turquoise header bar (`#e6f4f1`) with dark ink (`#10251c`).

| Contrast | Ratio |
|---|---|
| White on a card | 12.6:1 |
| Tan on a card | 5.2:1 |
| Ink on the header | 14.3:1 |

Each pillar has a color, always shown beside its icon and name on a chip surface (`#172a1f`), where every pillar color is at least 3:1. The balance bars are one hue (tan) with the numbers written beside them, and a table view by group. Transitions are short and switch off with the system's reduced-motion setting.

## Checks

**`npm test`** (`scripts/check-services.mjs`) covers:
- the tiers and their print levels;
- a recommendation in every pillar at every tier, calibrated and best first;
- the fill: balance, no repeated pillar in a day, calibration, variety, time of day, locked sessions kept, one group at a time, the same seed giving the same month;
- moves and swaps, edits and clashes;
- recalibration keeping every day, time and pillar;
- plans read back from storage;
- the week's packets and page counts;
- CSV and iCalendar;
- roles;
- limits;
- 1,488 sessions (12 groups, 4 a day, a 31-day month) filled in well under a second.

**Chromium runs** checked:
- **Interactions:** drag and drop, keyboard moves, the editor and its clash message, **Undo**, the role views, recommendations into the packet and the generator, the **Facility view** switch, a week's print (page counts match the summary), and the CSV and iCalendar files.
- **Stress test:** 12 wings of 12 groups, 60-character names (some unbroken), four sessions a day and long notes, at 360, 390, 640, 768, 1024, 1280, 1440 and 1920 px. The page never scrolls sideways, and nothing reaches past its box except by design (ellipses and scrolling tables). In every printed week packet and month calendar, nothing runs past the page.
- **Real PDFs:** Letter pages, Atkinson Hyperlegible embedded, and no resident name on any page, even for a group with a linked resident.
