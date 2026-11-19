# Reference audit report

Scanned 54 HTML, 371 JavaScript and 3 CSS files under `cognicopia`. This scan is read-only: it changed no file.

**Health: AMBER: no errors, warnings to review**

| | Count |
|---|---|
| Errors | 0 |
| Warnings | 50 |
| Notes | 143 |

## Errors (0)

Each of these breaks something a visitor can reach.

None.

## Warnings (50)

Review each one: some are real, some are ids or notes built at run time that a text scan cannot see.

### dead id reference (29)

- `builder.html:6454` code looks up "#lpName", which no page or script creates
- `builder.html:7154` code looks up "#lj-name", which no page or script creates
- `builder.html:7911` code looks up "#rsCs", which no page or script creates
- `builder.html:9263` code looks up "#clGoalPick", which no page or script creates
- `builder.html:9264` code looks up "#clTaskPick", which no page or script creates
- `builder.html:9265` code looks up "#clMatPick", which no page or script creates
- `builder.html:11313` code looks up "#fpNewWing", which no page or script creates
- `builder.html:11403` code looks up "#fpWingShown", which no page or script creates
- `builder.html:16277` code looks up "#encKeep", which no page or script creates
- `resources/accessibility/index.html:1473` code looks up "#resourcesDropdownBtn", which no page or script creates
- `resources/accessibility/index.html:1473` code looks up "#resourcesDropdownBtn", which no page or script creates; it checks for null before attaching a listener, so nothing breaks, but that handler never runs
- `resources/activity-feature-guide/index.html:937` code looks up "#resourcesDropdownBtn", which no page or script creates
- `resources/activity-feature-guide/index.html:937` code looks up "#resourcesDropdownBtn", which no page or script creates; it checks for null before attaching a listener, so nothing breaks, but that handler never runs
- `resources/caregiver-faq/index.html:1424` code looks up "#resourcesDropdownBtn", which no page or script creates
- `resources/caregiver-faq/index.html:1424` code looks up "#resourcesDropdownBtn", which no page or script creates; it checks for null before attaching a listener, so nothing breaks, but that handler never runs
- `resources/high-volume-facilities/index.html:1237` code looks up "#resourcesDropdownBtn", which no page or script creates
- `resources/high-volume-facilities/index.html:1237` code looks up "#resourcesDropdownBtn", which no page or script creates; it checks for null before attaching a listener, so nothing breaks, but that handler never runs
- `resources/platform-overview/index.html:910` code looks up "#resourcesDropdownBtn", which no page or script creates
- `resources/platform-overview/index.html:910` code looks up "#resourcesDropdownBtn", which no page or script creates; it checks for null before attaching a listener, so nothing breaks, but that handler never runs
- `resources/privacy-and-data/index.html:1162` code looks up "#resourcesDropdownBtn", which no page or script creates
- `resources/privacy-and-data/index.html:1162` code looks up "#resourcesDropdownBtn", which no page or script creates; it checks for null before attaching a listener, so nothing breaks, but that handler never runs
- `resources/publishing-excellence/index.html:1223` code looks up "#resourcesDropdownBtn", which no page or script creates
- `resources/publishing-excellence/index.html:1223` code looks up "#resourcesDropdownBtn", which no page or script creates; it checks for null before attaching a listener, so nothing breaks, but that handler never runs
- `resources/resource-catalog/index.html:2034` code looks up "#resourcesDropdownBtn", which no page or script creates
- `resources/resource-catalog/index.html:2034` code looks up "#resourcesDropdownBtn", which no page or script creates; it checks for null before attaching a listener, so nothing breaks, but that handler never runs
- `resources/security-questions/index.html:1152` code looks up "#resourcesDropdownBtn", which no page or script creates
- `resources/security-questions/index.html:1152` code looks up "#resourcesDropdownBtn", which no page or script creates; it checks for null before attaching a listener, so nothing breaks, but that handler never runs
- `resources/staff-guide/index.html:1294` code looks up "#resourcesDropdownBtn", which no page or script creates
- `resources/staff-guide/index.html:1294` code looks up "#resourcesDropdownBtn", which no page or script creates; it checks for null before attaching a listener, so nothing breaks, but that handler never runs

### in-page link (20)

- `builder.html:3039` href="#/" has nothing to land on (no id or name "/" in this page or any script)
- `builder.html:3057` href="#/coloring" has nothing to land on (no id or name "/coloring" in this page or any script)
- `builder.html:3058` href="#/planner" has nothing to land on (no id or name "/planner" in this page or any script)
- `builder.html:3059` href="#/journal" has nothing to land on (no id or name "/journal" in this page or any script)
- `builder.html:3060` href="#/reminiscence" has nothing to land on (no id or name "/reminiscence" in this page or any script)
- `builder.html:3061` href="#/toolkit" has nothing to land on (no id or name "/toolkit" in this page or any script)
- `builder.html:3072` href="#/roster" has nothing to land on (no id or name "/roster" in this page or any script)
- `builder.html:3073` href="#/ehr-import" has nothing to land on (no id or name "/ehr-import" in this page or any script)
- `builder.html:3074` href="#/tracking" has nothing to land on (no id or name "/tracking" in this page or any script)
- `builder.html:3080` href="#/facility" has nothing to land on (no id or name "/facility" in this page or any script)
- `builder.html:3085` href="#/shift" has nothing to land on (no id or name "/shift" in this page or any script)
- `builder.html:3086` href="#/highlights" has nothing to land on (no id or name "/highlights" in this page or any script)
- `builder.html:3087` href="#/planner-care-companion" has nothing to land on (no id or name "/planner-care-companion" in this page or any script)
- `builder.html:3093` href="#/clinical" has nothing to land on (no id or name "/clinical" in this page or any script)
- `builder.html:3094` href="#/therapy-goals" has nothing to land on (no id or name "/therapy-goals" in this page or any script)
- `builder.html:3095` href="#/heirloom" has nothing to land on (no id or name "/heirloom" in this page or any script)
- `builder.html:3101` href="#/safety" has nothing to land on (no id or name "/safety" in this page or any script)
- `builder.html:3102` href="#/settings" has nothing to land on (no id or name "/settings" in this page or any script)
- `builder.html:3116` href="#/academy" has nothing to land on (no id or name "/academy" in this page or any script)
- `builder.html:3117` href="#/scenarios" has nothing to land on (no id or name "/scenarios" in this page or any script)

### debug leftover (1)

- `server.js:34` console.log( … ) left in the code

## Notes (143)

Information only. A class used by a calculation can look unused here.

### unreferenced class (143)

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
- `activity-studio.html:76` .as-rd-ok is styled but no page or script mentions it
- `activity-studio.html:77` .as-rd-warn is styled but no page or script mentions it
- `builder.html:50` .sb-section is styled but no page or script mentions it
- `builder.html:297` .lvl-moderate is styled but no page or script mentions it
- `builder.html:466` .art-svg is styled but no page or script mentions it
- `builder.html:679` .sb-hub-link is styled but no page or script mentions it
- `builder.html:732` .lp-s-spring is styled but no page or script mentions it
- `builder.html:733` .lp-s-summer is styled but no page or script mentions it
- `builder.html:734` .lp-s-autumn is styled but no page or script mentions it
- `builder.html:735` .lp-s-winter is styled but no page or script mentions it
- `builder.html:742` .lp-cg is styled but no page or script mentions it
- `builder.html:751` .lp-res is styled but no page or script mentions it
- `builder.html:774` .lp-role-lines is styled but no page or script mentions it
- `builder.html:1190` .lp-tab-cg is styled but no page or script mentions it
- `builder.html:1192` .lp-aud-res is styled but no page or script mentions it
- `builder.html:1193` .lp-aud-cg is styled but no page or script mentions it
- `builder.html:1201` .lp-panel-res is styled but no page or script mentions it
- `builder.html:1202` .lp-panel-cg is styled but no page or script mentions it
- `builder.html:1266` .lp-thumb-left is styled but no page or script mentions it
- `builder.html:1267` .lp-thumb-right is styled but no page or script mentions it
- `builder.html:1285` .lp-scope-companion is styled but no page or script mentions it
- `builder.html:1382` .cs-skip is styled but no page or script mentions it
- `builder.html:1383` .cs-duplicate is styled but no page or script mentions it
- `builder.html:1429` .lj-sec-2 is styled but no page or script mentions it
- `builder.html:1573` .lj-tab-1 is styled but no page or script mentions it
- `builder.html:1574` .lj-tab-2 is styled but no page or script mentions it
- `builder.html:1575` .lj-tab-3 is styled but no page or script mentions it
- …and 103 more (run with --json for all of them)

## What this scan cannot prove

It reads text; it does not run the pages. A clean report does not show that every button works. Run `scripts/check-*-ui.mjs` and `scripts/audit-ux.mjs` for behaviour.
