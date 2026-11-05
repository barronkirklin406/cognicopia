# Reference audit report

Scanned 52 HTML, 217 JavaScript and 3 CSS files under `cognicopia`. This scan is read-only: it changed no file.

**Health: RED: errors need fixing**

| | Count |
|---|---|
| Errors | 2 |
| Warnings | 42 |
| Notes | 116 |

## Errors (2)

Each of these breaks something a visitor can reach.

### missing file (2)

- `batch-scheduler.html:12` <link> points at "css/site.css", which does not exist
- `family-bridge.html:12` <link> points at "css/site.css", which does not exist

## Warnings (42)

Review each one: some are real, some are ids or notes built at run time that a text scan cannot see.

### dead id reference (28)

- `builder.html:6158` code looks up "#lpName", which no page or script creates
- `builder.html:6858` code looks up "#lj-name", which no page or script creates
- `builder.html:8719` code looks up "#clGoalPick", which no page or script creates
- `builder.html:8720` code looks up "#clTaskPick", which no page or script creates
- `builder.html:8721` code looks up "#clMatPick", which no page or script creates
- `builder.html:10715` code looks up "#fpNewWing", which no page or script creates
- `builder.html:10804` code looks up "#fpWingShown", which no page or script creates
- `builder.html:15481` code looks up "#encKeep", which no page or script creates
- `resources/accessibility/index.html:1472` code looks up "#resourcesDropdownBtn", which no page or script creates
- `resources/accessibility/index.html:1472` code looks up "#resourcesDropdownBtn", which no page or script creates; it checks for null before attaching a listener, so nothing breaks, but that handler never runs
- `resources/activity-feature-guide/index.html:946` code looks up "#resourcesDropdownBtn", which no page or script creates
- `resources/activity-feature-guide/index.html:946` code looks up "#resourcesDropdownBtn", which no page or script creates; it checks for null before attaching a listener, so nothing breaks, but that handler never runs
- `resources/caregiver-faq/index.html:1433` code looks up "#resourcesDropdownBtn", which no page or script creates
- `resources/caregiver-faq/index.html:1433` code looks up "#resourcesDropdownBtn", which no page or script creates; it checks for null before attaching a listener, so nothing breaks, but that handler never runs
- `resources/high-volume-facilities/index.html:1246` code looks up "#resourcesDropdownBtn", which no page or script creates
- `resources/high-volume-facilities/index.html:1246` code looks up "#resourcesDropdownBtn", which no page or script creates; it checks for null before attaching a listener, so nothing breaks, but that handler never runs
- `resources/platform-overview/index.html:919` code looks up "#resourcesDropdownBtn", which no page or script creates
- `resources/platform-overview/index.html:919` code looks up "#resourcesDropdownBtn", which no page or script creates; it checks for null before attaching a listener, so nothing breaks, but that handler never runs
- `resources/privacy-and-data/index.html:1171` code looks up "#resourcesDropdownBtn", which no page or script creates
- `resources/privacy-and-data/index.html:1171` code looks up "#resourcesDropdownBtn", which no page or script creates; it checks for null before attaching a listener, so nothing breaks, but that handler never runs
- `resources/publishing-excellence/index.html:1232` code looks up "#resourcesDropdownBtn", which no page or script creates
- `resources/publishing-excellence/index.html:1232` code looks up "#resourcesDropdownBtn", which no page or script creates; it checks for null before attaching a listener, so nothing breaks, but that handler never runs
- `resources/resource-catalog/index.html:2042` code looks up "#resourcesDropdownBtn", which no page or script creates
- `resources/resource-catalog/index.html:2042` code looks up "#resourcesDropdownBtn", which no page or script creates; it checks for null before attaching a listener, so nothing breaks, but that handler never runs
- `resources/security-questions/index.html:1160` code looks up "#resourcesDropdownBtn", which no page or script creates
- `resources/security-questions/index.html:1160` code looks up "#resourcesDropdownBtn", which no page or script creates; it checks for null before attaching a listener, so nothing breaks, but that handler never runs
- `resources/staff-guide/index.html:1302` code looks up "#resourcesDropdownBtn", which no page or script creates
- `resources/staff-guide/index.html:1302` code looks up "#resourcesDropdownBtn", which no page or script creates; it checks for null before attaching a listener, so nothing breaks, but that handler never runs

### in-page link (13)

- `builder.html:2780` href="#/" has nothing to land on (no id or name "/" in this page or any script)
- `builder.html:2797` href="#/coloring" has nothing to land on (no id or name "/coloring" in this page or any script)
- `builder.html:2798` href="#/planner" has nothing to land on (no id or name "/planner" in this page or any script)
- `builder.html:2799` href="#/journal" has nothing to land on (no id or name "/journal" in this page or any script)
- `builder.html:2800` href="#/reminiscence" has nothing to land on (no id or name "/reminiscence" in this page or any script)
- `builder.html:2816` href="#/facility" has nothing to land on (no id or name "/facility" in this page or any script)
- `builder.html:2817` href="#/shift" has nothing to land on (no id or name "/shift" in this page or any script)
- `builder.html:2818` href="#/roster" has nothing to land on (no id or name "/roster" in this page or any script)
- `builder.html:2819` href="#/clinical" has nothing to land on (no id or name "/clinical" in this page or any script)
- `builder.html:2820` href="#/heirloom" has nothing to land on (no id or name "/heirloom" in this page or any script)
- `builder.html:2821` href="#/planner-care-companion" has nothing to land on (no id or name "/planner-care-companion" in this page or any script)
- `builder.html:2822` href="#/settings" has nothing to land on (no id or name "/settings" in this page or any script)
- `builder.html:2828` href="#/academy" has nothing to land on (no id or name "/academy" in this page or any script)

### debug leftover (1)

- `server.js:34` console.log( … ) left in the code

## Notes (116)

Information only. A class used by a calculation can look unused here.

### unreferenced class (116)

- `activate.html:13` .navbar is styled but no page or script mentions it
- `activate.html:14` .nav-brand is styled but no page or script mentions it
- `activate.html:14` .nav-links is styled but no page or script mentions it
- `activate.html:16` .nav-logo is styled but no page or script mentions it
- `activate.html:22` .dropbtn is styled but no page or script mentions it
- `activate.html:30` .dropdown-content is styled but no page or script mentions it
- `activate.html:35` .dropdown-grid is styled but no page or script mentions it
- `activate.html:36` .dropdown-group is styled but no page or script mentions it
- `activate.html:37` .dropdown-header is styled but no page or script mentions it
- `activate.html:40` .dropdown-links-list is styled but no page or script mentions it
- `activate.html:45` .dropdown-link-bullet is styled but no page or script mentions it
- `activate.html:48` .dropdown-footer is styled but no page or script mentions it
- `activate.html:49` .dropdown-footer-label is styled but no page or script mentions it
- `batch-scheduler.html:20` .font-serif is styled but no page or script mentions it
- `builder.html:50` .sb-section is styled but no page or script mentions it
- `builder.html:276` .lvl-moderate is styled but no page or script mentions it
- `builder.html:277` .lvl-advanced is styled but no page or script mentions it
- `builder.html:445` .art-svg is styled but no page or script mentions it
- `builder.html:706` .lp-s-spring is styled but no page or script mentions it
- `builder.html:707` .lp-s-summer is styled but no page or script mentions it
- `builder.html:708` .lp-s-autumn is styled but no page or script mentions it
- `builder.html:709` .lp-s-winter is styled but no page or script mentions it
- `builder.html:716` .lp-cg is styled but no page or script mentions it
- `builder.html:725` .lp-res is styled but no page or script mentions it
- `builder.html:748` .lp-role-lines is styled but no page or script mentions it
- `builder.html:1164` .lp-tab-cg is styled but no page or script mentions it
- `builder.html:1166` .lp-aud-res is styled but no page or script mentions it
- `builder.html:1167` .lp-aud-cg is styled but no page or script mentions it
- `builder.html:1175` .lp-panel-res is styled but no page or script mentions it
- `builder.html:1176` .lp-panel-cg is styled but no page or script mentions it
- `builder.html:1240` .lp-thumb-left is styled but no page or script mentions it
- `builder.html:1241` .lp-thumb-right is styled but no page or script mentions it
- `builder.html:1259` .lp-scope-companion is styled but no page or script mentions it
- `builder.html:1350` .cs-skip is styled but no page or script mentions it
- `builder.html:1351` .cs-duplicate is styled but no page or script mentions it
- `builder.html:1397` .lj-sec-2 is styled but no page or script mentions it
- `builder.html:1541` .lj-tab-1 is styled but no page or script mentions it
- `builder.html:1542` .lj-tab-2 is styled but no page or script mentions it
- `builder.html:1543` .lj-tab-3 is styled but no page or script mentions it
- `builder.html:1544` .lj-tab-4 is styled but no page or script mentions it
- …and 76 more (run with --json for all of them)

## What this scan cannot prove

It reads text; it does not run the pages. A clean report does not show that every button works. Run `scripts/check-*-ui.mjs` and `scripts/audit-ux.mjs` for behaviour.
