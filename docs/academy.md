# Staff & Caregiver Academy

The Academy is Cognicopia's training hub. It has short masterclasses for care teams, gentle guides for family caregivers, and a training record with certificates for everyone who learns on the computer. Its screen is in the Packet Builder (`#/academy`). It opens from:
- the sidebar (**Academy**, a hub of its own);
- its card under **Learning & reference** on the Packet Builder home page;
- the **Interactive tools** tab of the Resource & Clinical Hub.

`src/services/academy.ts` (built to `assets/services/academy.js`, global `CogniAcademy`) holds the lessons, quizzes and toolkits, and the rules for progress, completion, certificates and records. It also lays out the printed pages. The screen draws it and saves each learner's progress. Neither sends anything anywhere.

| Address | Shows |
|---|---|
| `#/academy` | The dashboard and the masterclass grid |
| `#/academy/family` | The family track: guides and toolkits |
| `#/academy/records` | Training records, certificates, checking a certificate ID |
| `#/academy/<lesson>` | One lesson: the player, its transcript, guide and knowledge check, and the progress tracker |

## The dashboard

At the top of the masterclass grid, three tiles for the learner chosen under **Learning as**, each with a circular progress ring:
- **Courses completed**, of the six masterclasses;
- **Hours learned**, against the series' running time;
- **Certificates earned**.

The status line says **Ready to begin**, **In progress** or the like. It is worded as an in-service record on purpose: the certificates are not accredited credit unless the facility enters an approval statement (see Certificates). Under it are a search box, an **audience** filter and five pills: **All Courses**, **Memory Care Essentials**, **Reminiscence**, **Activity Guidance** and **Completed**. The word is Reminiscence, not Reminisce Therapy: the lessons teach the practice and make no therapy claim.

## The catalog

**Professional masterclasses:** six lessons, each about 15 minutes of training:
- a narrated lesson;
- a companion guide to read;
- a five-question knowledge check.

| Masterclass | Discipline | Lesson | Chapters |
|---|---|---|---|
| Running Structured Reminiscence Circles | Recreation therapy | 5:48 | 6 |
| Managing Sundowning Agitation | Nursing | 5:19 | 6 |
| Safe Movement Therapy in Wheelchairs | Physical therapy | 5:06 | 6 |
| Person-Centered Communication in Dementia | Speech-language pathology | 4:01 | 6 |
| Matching Activities to Cognitive Stage | Recreation therapy | 3:56 | 6 |
| Music That Reaches: Sing-Alongs and Playlists | Recreation therapy | 3:36 | 6 |

Each card has:
- a picture of the lesson with a play mark and its length;
- the instructor badge: Cognicopia Academy and the discipline behind the lesson;
- tags for the training time and who it is for;
- the learner's progress.

**Search** covers titles, topics, chapters and disciplines. The **Topic** and **For** (activity staff, nursing and CNAs, therapy staff) filters narrow the grid.

The lessons are written for Cognicopia, and each companion guide lists its sources. The instructor badge names the discipline behind the lesson, not a person: no lesson claims a named expert.

**Family caregivers:** five guides of one to one and a half minutes each, with four printable quick-start toolkits:

| Guide | Toolkit beside it |
|---|---|
| When They Don't Remember Your Name | Visit Toolkit |
| Late-Day Restlessness at Home | Calm Afternoon Toolkit |
| Joining Their World | Visit Toolkit |
| A Day With a Rhythm | Daily Rhythm Planner |
| Caring for You, Too | Caregiver Check-In (with the Alzheimer's Association 24/7 Helpline, the Eldercare Locator and 988) |

The family guides have no knowledge check and no certificate. They count toward the learner's record when they are completed.

**Language checks.** The tests hold every lesson, question and toolkit to the site's tone rules. No text:
- labels a person by a condition (for example "sufferer" or "dementia patient");
- promises a medical effect;
- uses baby talk or preschool words.

## A lesson

**The player.** A lesson plays as a narrated slide lesson:
- The slides show each chapter's title and key idea over the lesson's picture.
- Captions show the line being read.
- The transcript beside it follows along.

**Read aloud** uses this computer's own voices only: English voices the browser marks as local. The words are never sent to a voice service online. Without a local voice, the captions play at a steady speaking pace (140 words a minute) and the **Read aloud** button does not show.

| To | Button | Keyboard (on the picture) |
|---|---|---|
| Play or pause | Play / Pause | Space, Enter or K |
| Move a line back or forward | | Left and Right arrows |
| Go to the start or the end | | Home and End |
| Go back ten seconds, or to the previous or next chapter | Back 10 s, Previous, Next | |
| Go anywhere | The position slider | The slider's own arrow keys |
| Change the speed (0.75×, 1×, 1.25×, 1.5×) | Speed | |
| Mute, or set the volume | Mute, Volume | M |
| Bookmark this moment | Bookmark | B |
| Turn captions on or off | Captions | C |
| Read aloud, or captions only | Read aloud | |
| Fill the screen | Full screen | F |

The chapter bar under the controls jumps to a chapter and shows how much of each has played. **Chapters, bookmarks and other lessons** opens a drawer with the chapter list, the learner's bookmarks for this lesson (up to a limit, each removable) and the other lessons.

**Following along.** The word being read is highlighted in the caption and, with **Follow along as it plays** on, in the transcript. When this computer's voice reports word positions the highlight follows them; when it does not, it follows the voice's pace.

**Pictures.** Each lesson has a small illustration drawn in SVG (no image files). While a lesson plays, a few parts of it move gently (a pulse, a glow, steam, a twinkle) and the picture drifts slowly under each chapter. This is transform and opacity only, and it stops with the system's reduced-motion setting.

**Voice.** The player picks the most natural local voice it finds (names that say natural, neural, premium or enhanced come first, then US English) and slows it a little for clarity. A learner can choose another local voice when there is more than one. A recorded narration can be added to a lesson (set its `audio.src` in `src/services/academy.ts`); the player then uses the recording, times the transcript to it, and falls back to this computer's voice if the file cannot play. No recordings ship today, so the player says **Narrated lesson**, not recorded.

**How watching counts**
- A line counts once it has played from its start to its end. Lines skipped with the slider, the chapter buttons or the arrow keys do not count.
- A lesson counts as watched at 90% of its running time.
- Reading the whole transcript counts the same: **I've read the whole lesson**.
- A lesson opened again resumes at its first line not yet played.
- Leaving the lesson or hiding the page stops it and saves where it got to.
- Progress also saves every few seconds while it plays.

**Lesson materials** are in three tabs under the player:

| Tab | What it has |
|---|---|
| Transcript | Every word of the lesson, by chapter. A line or a chapter title plays from there. |
| Companion guide | The lesson's outline, the key points of each chapter, **Try this** steps, **Avoid**, **Reflect** questions with room to write, and sources. **Download companion guide (PDF)** makes it on Letter paper. |
| Knowledge check | Five questions. 80% passes. Wrong answers are marked with the right one, and every question explains its answer. It can be taken as often as the learner likes. The best score is kept. |

A family guide has **Transcript** and **Guide and toolkits** instead.

**The progress tracker** (beside the player on wide screens, above the materials on narrow ones) shows the steps:
1. Watch or read the lesson.
2. Pass the knowledge check (masterclasses).
3. **Mark as complete.**

Until the steps are done, **Mark as complete** is shown as not ready and lists what is missing. Pressing it only explains. Completing records:
- the date;
- the training minutes;
- for a masterclass, a certificate ID.

A lesson completed once stays completed with its first date.

## Learners

**Learning as**, at the top of the Academy, chooses who is learning. **Add a learner…** adds one with a name and a role:

| Role |
|---|
| Certified nursing assistant (CNA) |
| Nurse (RN or LPN) |
| Activity professional |
| Therapy (PT, OT or SLP) |
| Other staff |
| Family caregiver |

Learners are names on this computer, not logins. A computer holds up to 200. The last learner cannot be removed, so there is always someone to learn as.

## Certificates

A completed masterclass has a certificate, as a landscape Letter PDF. It shows:
- the learner's name and role;
- the masterclass;
- the knowledge check's best score;
- the facility's name (from Settings);
- the completion date;
- the training time in minutes and hours;
- the certificate ID;
- lines for the staff development coordinator's signature and the date.

A name that runs long steps down in size so the page never overflows. A learner with no name yet is asked for one first, right where they pressed the button.

**Certificate IDs** look like `CA-7K2M-9QXP`. They are made from the learner, the lesson and the completion time, using letters that cannot be misread (no I, L, O or U). **Training records › Check a certificate** finds an ID among the records on this computer, in upper or lower case.

**What a certificate is, and is not.** Real continuing education credit (CEUs, contact hours) comes only from an accredited provider or an approving body. By default, every certificate carries this statement:

> In-service training record. This is not accredited continuing education: it counts toward a license or certification only where your facility's education program or an approving body accepts it.

A facility whose program has been approved can enter its approval statement, exactly as the approval letter gives it, under **Training records › Certificate statement** (up to 300 characters). It then prints on every certificate instead.

## Training records

For the year chosen:
- **Totals:** learners on the computer, lessons completed, training time, and certificates issued.
- **By learner:** role, lessons completed (and in progress), training time and certificates. Each certificate downloads from here too.
- **For a CNA:** a meter toward the 12-hour yearly in-service minimum. Federal rules for nursing homes call for at least 12 hours of in-service training a year for nurse aides, including dementia management and abuse prevention (42 CFR 483.95(g)). The facility decides what counts toward its program.
- **Download records (CSV):**
  - RFC 4180, UTF-8 with a byte-order mark so Excel reads accents, CRLF line ends;
  - one row per completion;
  - a cell a spreadsheet would read as a formula is stored with an apostrophe in front.

## Printed pages

Companion guides, toolkits and certificates are made as PDFs on this computer:
- in Atkinson Hyperlegible;
- with Letter margins of 0.75 in;
- with writing lines 0.5 in apart;
- with a footer and page number on every page.

A heading never ends a page. A prompt and its writing lines always start on the same page.

**Print** (not only download): **Print key takeaways** on a lesson's guide tab and **Print** on the training record put the same content on US Letter sheets in the Packet Builder's print root: 0.75 in binding gutter, Atkinson Hyperlegible, pure black on white, lines 3 px or thicker, body type 12 pt or larger, page numbers, and content that runs over moves to a continued sheet so nothing is cut off. The footer says the record is in-service training, not accredited continuing education.

Academy PDFs and prints do not use one of the free packets: training is not metered.

## Adding a recorded video

A lesson can play a recorded video instead of the narrated slides:
1. Put the video file on the site (for example `assets/academy/sundowning.mp4`), with a WebVTT captions file if there is one.
2. Set the lesson's `video` in `src/services/academy.ts` to `{ src: "assets/academy/sundowning.mp4", captions: "assets/academy/sundowning.vtt" }`.
3. Run `npm run services`.

The player then uses the browser's own video controls. The lesson counts as watched once 90% of it has played (seeking ahead does not count). The transcript, guide and knowledge check stay as they are.

Only files on the site are played. The tools make no requests to other sites.

## Where it is kept

Everything the Academy saves is sealed in the encrypted store under `cognicopia_academy`, like resident profiles (see [Privacy and storage](privacy-and-storage.md)):
- learners (staff names and roles);
- each learner's progress, scores and completions;
- certificate IDs;
- the approval statement;
- the player settings (speed, captions, volume, mute, chosen voice, follow along) and each lesson's bookmarks and place.

**Training records › Remove the Academy's records from this computer** removes all of it. Download the records first if they are needed.

## Design

The Academy is a dark-slate screen: page `#0e1614`, panel `#16231f`, card `#1c2e29`, accent emerald `#52b788` (light `#74c69d`), borders `#2a3d36`, with glass-like cards (a faint gradient, a soft glow on hover). The tokens are `--ac-*` in the Academy's own style block in `builder.html`. One color was changed from the brief: the muted text was `#9bb0a5`, which reads 6.2:1 on a card and misses the 7:1 (AAA) bar this site holds its text to, so it is `#b4c6bc` (8.0:1). Completion is never shown by color alone: a check mark and words go with it.

| Pair | Contrast |
|---|---|
| Text `#f0f4f2` on the page, panel, card | 16.6, 14.6, 12.9:1 |
| Secondary text `#cfdcd5` on a card | 10.1:1 |
| Muted text `#b4c6bc` on a card | 8.0:1 |
| Accent text `#8ad8b0` on a card | 8.5:1 |
| Dark ink on the emerald button | 7.4:1 |
| Amber for the family track (`#e9b872`) on a card | 7.9:1 |
| Green for completion (`#7ad3a4`) on a card | 7.9:1 |
| Focus ring (`#e6f4f1`) on a card | 12.6:1 |

`scripts/check-academy-ui.mjs` recomputes every text pair from the live styles and fails below 7:1.

**Touch targets** are 52 px (`--tap`, the site's rule; the brief asked for 44). The chapter segments are the one exception, marked `data-tap-exempt`: the position slider and the chapter list reach every point at full size.

**Layout** follows the Academy's own width (container queries), so tablets and desktops each get an arrangement:
- **Grid:** one to three columns of cards.
- **Lesson:** the player and the tracker side by side from about 1,366 px screens, one above the other below that.
- **Small screens:** the slide gives way to the caption while a lesson plays.

Motion is short and switches off with the system's reduced-motion setting.

## Checks

**`npm test`** (`scripts/check-services.mjs`) covers:
- **Catalog:** the three requested masterclasses, chapters, instructors, quizzes (answers not all in one position), toolkits, and the language rules.
- **Timing:** the lesson timeline, training minutes and time formats.
- **Progress:** learners, coverage, grading (4 of 5 passes, 3 of 5 does not), completion only when ready (and only once), family completion.
- **Certificates:** certificate IDs, finding a certificate, the approval statement.
- **Records:** records by year and the CSV.
- **Stored data:** saved records cleaned on reading.
- **Printed pages:**
  - every guide and toolkit inside the margins, numbered;
  - no heading ending a page and no writing lines starting one, at five different font widths;
  - certificates with long names and a long approval statement, with nothing overlapping.

**Chromium runs by hand** when the Academy was first built (the screen has since been redesigned; the committed `check-academy-ui.mjs` below covers the current one):
- **The grid:** cards with thumbnail, length and instructor badge, search, topic and audience filters, the empty state, keyboard tabs, focus returning to a lesson's card.
- **The player:**
  - play, pause, captions and the keyboard, chapters, and transcript lines;
  - progress saved while playing, resumed on reopening, and kept when leaving;
  - a whole lesson played through on a fast clock, counted as watched, with **Replay**.
- **Read aloud:** with a stand-in local voice, it is used and the online voice never is:
  - captions and the transcript follow;
  - finished lines count;
  - a chapter jump or a slider drag restarts it once;
  - speed changes take effect;
  - it is silenced on leaving.
- **Completing a lesson:** the knowledge check (fail, then pass), **Mark as complete** gated and then completed, the certificate asking for a name, the companion guide.
- **Family track and records:**
  - a family guide and its toolkit;
  - the records and the CSV;
  - checking a certificate ID;
  - the approval statement;
  - learners added, switched and removed;
  - a change in another tab;
  - removing the records.
- **Every PDF, as a real file:**
  - all 11 guides, all 4 toolkits, and certificates with a 60-character name, a 60-character facility and a 300-character approval statement;
  - Atkinson Hyperlegible only, text inside the margins, nothing overlapping, page numbers, the right statement on each certificate.
- **Stress test:**
  - 40 learners, unbroken 60-character names, a long approval statement, every tab and a graded knowledge check;
  - at 320, 360, 390, 640, 768, 1024, 1280, 1440 and 1920 px;
  - the page never scrolls sideways, nothing leaves its card, and the slide's words, the play button and the captions never overlap.
- **Reduced motion:** nothing animates.
- **Privacy:** nothing stored in plain `localStorage`, and no requests to other sites.

**`npm run build`** also runs `scripts/check-academy-ui.mjs`, a Chromium check of the new screen (55 checks): the dark-slate tokens and AAA text pairs; the header, the three ringed tiles, search and the five pills; the player (play and pause, position moving, a word highlighted, back and forward ten seconds, the four speeds, mute and volume, captions, a bookmark, the chapter drawer, Home and arrow keys, the illustration and its motion, full screen); settings and bookmarks saved, sealed and back after a reload; reading, the knowledge check, completing, the certificate asking for a name and downloading as a PDF; the dashboard and Completed pill afterward; the training record; the Letter print sheets (pure black and white, 0.75 in gutter, numbered pages, nothing clipped); no sideways scroll on a phone; 52 px controls; reduced motion; and no request to another site.
