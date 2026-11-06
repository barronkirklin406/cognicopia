/* EHR import wizard (core): reads a census or resident list exported from an electronic health record as a CSV (or JSON) file, on this computer,
   and turns it into Cognicopia resident profiles with their wing and room tags. Nothing is sent anywhere.

   The steps the wizard walks through (the screen is js/facility-tools-ui.js):
     1. read(text)                      the file is parsed; a header row and at least one resident are required.
     2. detectSystem(headers)           a best guess at the source system (PointClickCare, MatrixCare or another) from the column names. The guess
                                        only chooses which spellings to try first; the director can change any column.
     3. suggest(headers, system)        which column holds which field, and which columns are ignored as sensitive (see SENSITIVE below).
     4. preview(table, mapping, opts)   the residents that would be added or updated, with wing and room tags, before anything is written.

   What is deliberately never kept: a last name, a full date of birth (only the year), a Social Security, medical-record or insurance number,
   a diagnosis, medication, allergy, physician, contact or address column. Those columns are named on the preview as ignored and are not
   passed on to the profile builder at all.

   Export column names differ between facilities and versions, so the spellings here are common ones, not a promise about any vendor's file:
   the mapping step always shows what was matched and lets the director choose a column by hand.

   The profile building itself (tier, era, wing, update-versus-add) is the census service's (assets/services/censusImport.js, CogniCensus), so
   this wizard and the plain census importer always agree. */

const census = () => (typeof globalThis !== "undefined" && globalThis.CogniCensus) || null;
const need = () => { const c = census(); if (!c) throw new Error("The census tools did not load."); return c; };
const norm = (h) => String(h == null ? "" : h).toLowerCase().replace(/[^a-z0-9]/g, "");
const one = (v, max) => String(v == null ? "" : v).replace(/[\u0000-\u001F\u007F<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

/* The fields the wizard can fill, in the order the mapping step shows them. */
export const FIELDS = Object.freeze([
  { id: "name", label: "Resident name", help: "Only the first name is kept. A last name in this column is never saved.", required: false },
  { id: "room", label: "Room or bed", help: "Becomes the room tag, and the alias “Resident 204-B” that the Shift board uses.", required: false },
  { id: "wing", label: "Wing, unit or neighborhood", help: "Becomes the wing tag. Rosters, pickers and the Shift board show one wing at a time.", required: false },
  { id: "tier", label: "Care level or stage", help: "A tier, a care-level word, or a GDS or FAST stage. Left blank, the resident starts at Tier 2.", required: false },
  { id: "score", label: "Cognitive score", help: "A MoCA, MMSE or BIMS total. Used only to suggest a starting tier when there is no care level.", required: false },
  { id: "birth", label: "Birth date or year", help: "Only the year is kept, and only to find the life era.", required: false },
  { id: "era", label: "Life era", help: "Decades such as 1940s, if the export has them.", required: false },
  { id: "interests", label: "Interests", help: "A list of likes. Matched to Cognicopia's own interest list.", required: false },
  { id: "hometown", label: "Hometown", help: "", required: false },
  { id: "occupation", label: "Former occupation", help: "", required: false }
]);

/* Source systems. `hints` are extra spellings tried first for a field; they are common export headings, not a statement about a vendor's format. */
export const SYSTEMS = Object.freeze({
  pointclickcare: { label: "PointClickCare", hints: { name: ["residentname", "resident", "patientname", "fullname"], room: ["roombed", "room", "bed", "roomnumber", "location"], wing: ["unit", "unitname", "floor", "wing", "building"], tier: ["carelevel", "levelofcare", "cognitivestatus", "gds", "fast"], score: ["bims", "bimsscore", "moca", "mmse", "cognitivescore"], birth: ["dob", "birthdate", "dateofbirth"] } },
  matrixcare: { label: "MatrixCare", hints: { name: ["residentname", "resident", "name", "clientname"], room: ["roombed", "room", "apartment", "apt", "unitnumber", "bed"], wing: ["neighborhood", "community", "household", "wing", "careunit", "unit", "floor"], tier: ["levelofcare", "carelevel", "servicelevel", "acuity", "gds", "fast"], score: ["moca", "mmse", "bims", "cognitivescore"], birth: ["birthdate", "dob", "dateofbirth"] } },
  other: { label: "Another system or a spreadsheet", hints: {} }
});
const SIGNATURES = { pointclickcare: ["residentname", "roombed", "unit", "carelevel", "bims", "admitdate"], matrixcare: ["neighborhood", "roombed", "levelofcare", "residentname", "serviceplan", "community"] };

/* Columns that are never used. Each has a plain reason, shown beside the column on the preview. */
export const SENSITIVE = Object.freeze([
  { id: "ssn", re: /ssn|socialsec|socsec/, label: "Social Security number" },
  { id: "record", re: /mrn|medicalrecord|chartn|patientid|residentid|residentnumber|accountn|admissionn|facilityid|externalid|medicaid|medicare|insurance|payer|policy|member/, label: "A record, account or insurance number" },
  { id: "clinical", re: /diagnos|icd|dx\b|^dx|condition|allerg|medication|^meds?$|drug|prescri|^rx|physician|doctor|^md$|npi|codestatus|dnr|polst|pharmacy|lab|vitals|weight|diet|fall|wound|infection/, label: "A diagnosis, medication or other clinical detail" },
  { id: "contact", re: /phone|email|address|street|city(?!.*home)|zip|postal|emergency|guardian|^poa|powerofattorney|responsibleparty|nextofkin|familycontact|spouse/, label: "Contact or family details" },
  { id: "dates", re: /admit|admission|discharge|movein|moveout|transfer|payor/, label: "An admission or discharge date" }
]);
export const sensitiveKind = (header) => { const n = norm(header); return SENSITIVE.find((s) => s.re.test(n)) || null; };

/* ---- scores to a starting tier ---------------------------------------------------------------------------------------------------------------- */
/* Common published severity bands, used only to suggest where a resident starts; staff confirm the tier on the profile.
   MoCA: 18 to 30 is mild or none, 10 to 17 moderate, below 10 severe. MMSE: 20 to 30, 10 to 19, below 10. BIMS (an MDS interview, 0 to 15): 13 to 15 intact, 8 to 12 moderately, 0 to 7 severely. */
export const SCORE_SCALES = Object.freeze({ moca: { label: "MoCA (0 to 30)", max: 30, bands: [[18, 1], [10, 2], [0, 3]] }, mmse: { label: "MMSE (0 to 30)", max: 30, bands: [[20, 1], [10, 2], [0, 3]] }, bims: { label: "BIMS (0 to 15)", max: 15, bands: [[13, 1], [8, 2], [0, 3]] } });
export function scoreScaleOf(header, value) {
  const n = norm(header); if (/moca/.test(n)) return "moca"; if (/mmse/.test(n)) return "mmse"; if (/bims/.test(n)) return "bims";
  const v = Number(String(value).replace(/[^0-9.]/g, "")); return v > 15 ? "moca" : v > 0 ? "bims" : "";
}
export function tierFromScore(scale, value) {
  const s = SCORE_SCALES[scale]; if (!s) return 0; const m = String(value == null ? "" : value).match(/-?\d+(\.\d+)?/); if (!m) return 0; const v = Number(m[0]); if (!(v >= 0 && v <= s.max)) return 0;
  return (s.bands.find((b) => v >= b[0]) || [0, 0])[1];
}

/* ---- reading ---------------------------------------------------------------------------------------------------------------------------------- */
/* -> { ok, problem, format, headers, rows, truncated } where rows are arrays of cell text. */
export function read(text) {
  const C = need(), src = String(text == null ? "" : text), out = { ok: false, problem: "", format: "csv", headers: [], rows: [], truncated: false };
  if (!src.trim()) { out.problem = "The file is empty."; return out; }
  if (src.length > C.MAX_BYTES) { out.problem = "The file is larger than 2 MB. Split it by wing and import each part."; return out; }
  out.format = C.detectFormat(src); let table;
  if (out.format === "json") { const j = C.parseJson(src); if (j.problem) { out.problem = j.problem; return out; } table = j.rows; } else table = C.parseCsv(src);
  if (!table || table.length < 2) { out.problem = "The file needs a header row and at least one resident."; return out; }
  out.headers = table[0].map((h) => String(h == null ? "" : h).trim());
  out.rows = table.slice(1).filter((r) => /[\p{L}\p{N}]/u.test(r.join("")));
  if (out.rows.length > C.MAX_ROWS) { out.truncated = true; out.rows.length = C.MAX_ROWS; }
  if (!out.rows.length) { out.problem = "No residents were found under the header row."; return out; }
  out.ok = true; return out;
}

/* ---- guessing the system and the columns ----------------------------------------------------------------------------------------------------- */
export function detectSystem(headers) {
  const set = new Set((headers || []).map(norm)); let best = "other", top = 1;
  for (const [id, sig] of Object.entries(SIGNATURES)) { const score = sig.filter((s) => set.has(s)).length; if (score > top) { top = score; best = id; } }
  return best;
}
const EXTRA = { name: ["name", "residentname", "resident", "fullname", "patientname", "clientname", "preferredname", "firstname"], room: ["room", "roomnumber", "roomno", "bed", "roombed", "apt", "apartment", "suite"], wing: ["wing", "unit", "neighborhood", "neighbourhood", "careunit", "household", "community", "floor", "area"],
  tier: ["tier", "acuitytier", "acuity", "carelevel", "levelofcare", "cognitivelevel", "stage", "gds", "fast"], score: ["moca", "mmse", "bims", "cognitivescore", "mocascore", "mmsescore"], birth: ["birthyear", "yearofbirth", "dob", "dateofbirth", "birthdate", "born"],
  era: ["era", "lifeera", "decade", "meaningfuldecades"], interests: ["interests", "hobbies", "likes", "favorites", "activities"], hometown: ["hometown", "grewupin", "origin"], occupation: ["occupation", "career", "formeroccupation", "profession", "job", "trade"] };
/* -> { fields: { fieldId: columnIndex }, ignored: [{ index, header, why }], unused: [header] } */
export function suggest(headers, system) {
  const sys = SYSTEMS[system] || SYSTEMS.other, hs = (headers || []).map(norm), fields = {}, ignored = [], used = new Set();
  hs.forEach((n, i) => { const s = sensitiveKind(headers[i]); if (s && !/^(name|residentname|preferredname|firstname)$/.test(n)) { ignored.push({ index: i, header: headers[i], why: s.label }); used.add(i); } });
  for (const f of FIELDS) {
    const lists = [...((sys.hints && sys.hints[f.id]) || []), ...(EXTRA[f.id] || [])];
    for (const w of lists) { const i = hs.findIndex((n, k) => !used.has(k) && n === w); if (i >= 0) { fields[f.id] = i; used.add(i); break; } }
  }
  for (const f of FIELDS) {
    if (fields[f.id] != null) continue;
    const words = (EXTRA[f.id] || []).filter((w) => w.length >= 4); const i = hs.findIndex((n, k) => !used.has(k) && n && words.some((w) => n.includes(w)));
    if (i >= 0) { fields[f.id] = i; used.add(i); }
  }
  return { fields, ignored, unused: (headers || []).filter((h, i) => !used.has(i) && String(h).trim()) };
}

/* ---- names ------------------------------------------------------------------------------------------------------------------------------------ */
const TITLES = /^(mr|mrs|ms|miss|dr|rev|sr|jr)\.?$/i;
/* "Smith, Dorothy A." and "Dorothy A. Smith" and "Mrs. Dorothy Smith" all give "Dorothy". A single word is taken as a first name. Never returns a last name. */
export function firstNameOf(raw) {
  let s = one(raw, 80).replace(/["()]/g, ""); if (!s) return "";
  if (s.includes(",")) { const after = s.split(",").slice(1).join(" ").trim().split(/\s+/).filter((w) => !TITLES.test(w))[0]; return cap(after || ""); }
  const w = s.split(/\s+/).filter((x) => !TITLES.test(x)); return cap(w[0] || "");
}
const cap = (w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : "");

/* ---- the preview ------------------------------------------------------------------------------------------------------------------------------ */
const csvCell = (v) => { const s = String(v == null ? "" : v); return /[",\n\r;|\t]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const CANON = ["Alias", "Preferred name", "Acuity tier", "Life era", "Interests", "Wing", "Room", "Birth year", "Hometown", "Occupation"];
/* opts: { nameMode: "first" | "alias", defaultWing, wingNames: { "mc-a": "Memory Care Unit A" }, scoreScale, mode: "update" | "skip", existing: profiles }
   -> { ok, problem, analysis, items, counts, report: { ignored, unused, wings, rooms, lastNamesDropped, datesReduced, tiersFromScore, noTier } } */
export function preview(table, mapping, opts = {}) {
  const C = need(), F = (mapping && mapping.fields) || {}, headers = table.headers, rows = table.rows, o = Object.assign({ nameMode: "first", defaultWing: "", wingNames: {}, mode: "update", existing: [] }, opts);
  const report = { ignored: (mapping && mapping.ignored) || [], unused: (mapping && mapping.unused) || [], wings: [], rooms: 0, lastNamesDropped: false, datesReduced: false, tiersFromScore: 0, noTier: 0, noName: 0 };
  if (F.name == null && F.room == null) return { ok: false, problem: "Choose the column that holds the resident's name or room, so each resident can be told apart.", report, items: [], counts: { add: 0, update: 0, skip: 0, duplicate: 0 } };
  const wn = {}; Object.entries(o.wingNames || {}).forEach(([k, v]) => { wn[norm(k)] = one(v, 40); });
  const cell = (r, f) => (F[f] == null ? "" : String(r[F[f]] == null ? "" : r[F[f]]));
  const out = [CANON.map(csvCell).join(",")], wingSeen = new Set();
  rows.forEach((r, i) => {
    const room = one(cell(r, "room"), 16).toUpperCase(), rawName = cell(r, "name"), first = o.nameMode === "alias" ? "" : firstNameOf(rawName);
    const words = one(rawName, 80).split(/\s+/).filter((w) => w && !TITLES.test(w));
    if (rawName.includes(",") || words.length >= 2 || (o.nameMode === "alias" && words.length)) report.lastNamesDropped = true;
    const alias = room ? "Resident " + room : "Resident " + (i + 1);
    if (!first && !room) report.noName++;
    let tier = cell(r, "tier"), scored = false;
    if (!String(tier).trim() && F.score != null) { const sc = o.scoreScale || scoreScaleOf(headers[F.score], cell(r, "score")), t = tierFromScore(sc, cell(r, "score")); if (t) { tier = "Tier " + t; scored = true; report.tiersFromScore++; } }
    if (!String(tier).trim()) report.noTier++;
    const rawBirth = cell(r, "birth"); if (/\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}|\d{4}-\d{2}-\d{2}/.test(rawBirth)) report.datesReduced = true;
    let wing = one(cell(r, "wing"), 40) || o.defaultWing || ""; const mapped = wn[norm(wing)]; if (mapped) wing = mapped;
    if (wing) wingSeen.add(wing); if (room) report.rooms++;
    out.push([alias, first, tier, cell(r, "era"), cell(r, "interests"), wing, room, rawBirth, cell(r, "hometown"), cell(r, "occupation")].map(csvCell).join(","));
  });
  report.wings = [...wingSeen].sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  const normalized = out.join("\n"), analysis = C.analyze(normalized, { wing: o.defaultWing });
  if (analysis.problem) return { ok: false, problem: analysis.problem, report, items: [], counts: { add: 0, update: 0, skip: 0, duplicate: 0 }, analysis };
  const items = C.plan(analysis.rows, o.existing || [], o.mode), counts = C.counts(items);
  return { ok: true, problem: "", analysis, items, counts, report, normalized };
}

/* Write the plan into a store. `save(id, profile)` stores one profile (the page passes the encrypted store's setItem). Returns { added, updated, failed }. */
export function apply(items, existing, save, now = new Date()) {
  const C = need(), have = existing || [], out = { added: 0, updated: 0, failed: 0 };
  for (const i of items || []) {
    if (i.action !== "add" && i.action !== "update") continue;
    const prev = i.action === "update" ? have.find((p) => p.id === i.existingId) : null, id = prev ? prev.id : C.newResidentId();
    try { save(id, C.toProfile(i.row, id, now, prev)); if (prev) out.updated++; else out.added++; } catch (e) { out.failed++; }
  }
  return out;
}
