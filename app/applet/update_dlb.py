import re

with open("index.html", "r", encoding="utf-8") as f:
    content = f.read()

# -------------------------------------------------------------
# 1. ADD DLB CSS STYLES
# -------------------------------------------------------------
dlb_css = """
/* ═══ Lewy Body Dementia (DLB) CST Expansion Styles ═══ */
.dlb-submenu {
  display: none;
  margin: 6px 10px 10px 14px;
  padding: 10px;
  background: rgba(14, 24, 33, 0.96);
  border: 1px solid rgba(138, 180, 248, 0.45);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}
.dlb-submenu.is-expanded {
  display: block;
}
.dlb-header {
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(138, 180, 248, 0.25);
}
.dlb-header-title {
  font-size: 8.5pt;
  font-weight: 700;
  color: #e8f0fe;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  display: flex;
  align-items: center;
  gap: 5px;
}
.dlb-filter-group {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 6px 0 8px;
}
.dlb-filter-pill {
  flex: 1 1 calc(50% - 4px);
  padding: 4px 5px;
  font-size: 7pt;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(138, 180, 248, 0.3);
  border-radius: 4px;
  color: #c2e7ff;
  cursor: pointer;
  text-align: center;
  transition: all 0.15s ease;
  white-space: nowrap;
}
.dlb-filter-pill:hover {
  background: rgba(138, 180, 248, 0.22);
  color: #fff;
}
.dlb-filter-pill.active {
  background: #8ab4f8;
  color: #04101e;
  border-color: #8ab4f8;
  font-weight: 700;
}
.dlb-quick-open {
  width: 100%;
  padding: 6px 8px;
  margin-bottom: 8px;
  background: linear-gradient(135deg, #1b3a57, #13273a);
  border: 1px solid #8ab4f8;
  border-radius: 5px;
  color: #e8f0fe;
  font-size: 8pt;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: background 0.15s;
}
.dlb-quick-open:hover {
  background: linear-gradient(135deg, #244c72, #18334d);
  color: #fff;
}
.dlb-activity-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
  max-height: 240px;
  overflow-y: auto;
  padding-right: 2px;
}
.dlb-activity-card {
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(138, 180, 248, 0.2);
  border-radius: 5px;
  cursor: pointer;
  display: flex;
  align-items: flex-start;
  gap: 7px;
  text-align: left;
  transition: all 0.15s ease;
}
.dlb-activity-card:hover {
  background: rgba(138, 180, 248, 0.18);
  border-color: rgba(138, 180, 248, 0.6);
  transform: translateX(2px);
}
.dlb-card-icon {
  font-size: 13px;
  flex: none;
  margin-top: 1px;
}
.dlb-card-content {
  flex: 1;
  min-width: 0;
}
.dlb-card-title {
  font-size: 8pt;
  font-weight: 700;
  color: #f1f8ff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dlb-card-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
}
.dlb-badge {
  font-size: 6.5pt;
  padding: 1px 4px;
  border-radius: 3px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.dlb-badge-alert {
  background: rgba(138, 180, 248, 0.25);
  color: #a8c7fa;
  border: 1px solid rgba(138, 180, 248, 0.5);
}
.dlb-badge-fluct {
  background: rgba(253, 214, 99, 0.25);
  color: #fdd663;
  border: 1px solid rgba(253, 214, 99, 0.5);
}
.dlb-badge-calm {
  background: rgba(129, 201, 149, 0.25);
  color: #81c995;
  border: 1px solid rgba(129, 201, 149, 0.5);
}

/* DLB Modal styles */
.dlb-modal {
  width: min(680px, 94vw);
  max-height: 90vh;
  border: 2px solid #8ab4f8;
  border-radius: 14px;
  background: #0b1a2b;
  color: #e8f0fe;
  padding: 24px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.75);
}
.dlb-modal::backdrop {
  background: rgba(3, 10, 18, 0.8);
  backdrop-filter: blur(4px);
}
.dlb-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 1px solid rgba(138, 180, 248, 0.3);
  padding-bottom: 14px;
  margin-bottom: 18px;
}
.dlb-modal-title {
  margin: 0;
  font-size: 19px;
  color: #fff;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
}
.dlb-modal-subtitle {
  margin: 4px 0 0;
  font-size: 12px;
  color: #a8c7fa;
}
.dlb-modal-close {
  background: transparent;
  border: none;
  color: #a8c7fa;
  font-size: 22px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  line-height: 1;
}
.dlb-modal-close:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}
.dlb-modal-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  max-height: calc(85vh - 160px);
  padding-right: 4px;
}
.dlb-field-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.dlb-field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
@media (max-width: 580px) {
  .dlb-field-row { grid-template-columns: 1fr; }
}
.dlb-label {
  font-size: 12.5px;
  font-weight: 700;
  color: #d2e3fc;
}
.dlb-input, .dlb-select {
  width: 100%;
  padding: 9px 12px;
  background: #06111e;
  border: 1px solid rgba(138, 180, 248, 0.5);
  border-radius: 7px;
  color: #fff;
  font-size: 14px;
  font-family: inherit;
  box-sizing: border-box;
}
.dlb-input:focus, .dlb-select:focus {
  outline: 2px solid #8ab4f8;
  border-color: #8ab4f8;
}
.dlb-options-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
@media (max-width: 600px) {
  .dlb-options-grid { grid-template-columns: 1fr; }
}
.dlb-output-card {
  padding: 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1.5px solid rgba(138, 180, 248, 0.3);
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 6px;
  position: relative;
  transition: all 0.15s ease;
}
.dlb-output-card:hover {
  background: rgba(138, 180, 248, 0.1);
  border-color: rgba(138, 180, 248, 0.6);
}
.dlb-output-card input[type="radio"] {
  position: absolute;
  top: 12px;
  right: 12px;
  accent-color: #8ab4f8;
  width: 16px;
  height: 16px;
}
.dlb-output-card.is-selected {
  background: rgba(138, 180, 248, 0.18);
  border-color: #8ab4f8;
  box-shadow: 0 0 0 1px #8ab4f8 inset;
}
.dlb-output-title {
  font-size: 13px;
  font-weight: 700;
  color: #fff;
}
.dlb-output-desc {
  font-size: 11px;
  color: #b0c9f0;
  line-height: 1.35;
}
.dlb-rationale-box {
  padding: 10px 12px;
  background: rgba(138, 180, 248, 0.08);
  border-left: 3px solid #8ab4f8;
  border-radius: 0 6px 6px 0;
  font-size: 11.5px;
  color: #c2e7ff;
  line-height: 1.4;
}
.dlb-modal-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
  border-top: 1px solid rgba(138, 180, 248, 0.3);
  padding-top: 16px;
  margin-top: 18px;
}
.dlb-btn-cancel {
  padding: 9px 16px;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 7px;
  color: #e8f0fe;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.dlb-btn-cancel:hover {
  background: rgba(255, 255, 255, 0.08);
}
.dlb-btn-generate {
  padding: 10px 20px;
  background: #8ab4f8;
  border: none;
  border-radius: 7px;
  color: #041427;
  font-size: 13.5px;
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: background 0.15s ease, transform 0.1s ease;
}
.dlb-btn-generate:hover {
  background: #a8c7fa;
  transform: translateY(-1px);
}
.dlb-btn-generate:active {
  transform: translateY(0);
}
"""

css_anchor = ".vad-btn-generate:active {\n  transform: translateY(0);\n}\n</style>"
idx_css = content.find(css_anchor)
if idx_css != -1:
    content = content[:idx_css + len(".vad-btn-generate:active {\n  transform: translateY(0);\n}")] + dlb_css + content[idx_css + len(".vad-btn-generate:active {\n  transform: translateY(0);\n}"):]
    print("DLB CSS inserted successfully.")
else:
    print("Could not find css_anchor")
    exit(1)

# -------------------------------------------------------------
# 2. ADD DLB SUBMENU UNDER caLewy
# -------------------------------------------------------------
dlb_submenu_html = """
      <div class="dlb-submenu" id="dlbSubmenu" aria-label="Lewy Body Dementia CST Modules">
        <div class="dlb-header">
          <div class="dlb-header-title">
            <span>👁️</span> DLB Visuospatial Suite (10 Modules)
          </div>
        </div>
        <div class="dlb-filter-group" role="group" aria-label="Filter activities by alertness mode">
          <button type="button" class="dlb-filter-pill active" data-filter="all">All Modes</button>
          <button type="button" class="dlb-filter-pill" data-filter="alert">Alert · 6-10px Borders</button>
          <button type="button" class="dlb-filter-pill" data-filter="fluctuating">Fluctuating · Auditory</button>
          <button type="button" class="dlb-filter-pill" data-filter="calming">Calming · Somatosensory</button>
        </div>
        <button type="button" class="dlb-quick-open" id="dlbOpenModalBtn">
          <span>⚙️</span> Personalize &amp; Print Suite
        </button>
        <div class="dlb-activity-list" id="dlbActivityList">
          <!-- Populated dynamically by initLewyModule() -->
        </div>
      </div>"""

lewy_btn_anchor = """      <button class="cg-ailment-card" id="caLewy"
        data-ailment="lewy_body"
        data-tip="High-contrast, low-precision layout. Avoids busy patterns to prevent hallucinations.">
        <span class="ca-icon">👁</span>
        <span class="ca-label">Lewy Body Dementia</span>
      </button>"""

idx_lewy_btn = content.find(lewy_btn_anchor)
if idx_lewy_btn != -1:
    content = content[:idx_lewy_btn + len(lewy_btn_anchor)] + dlb_submenu_html + content[idx_lewy_btn + len(lewy_btn_anchor):]
    print("DLB submenu HTML inserted successfully.")
else:
    print("Could not find lewy_btn_anchor")
    exit(1)

# -------------------------------------------------------------
# 3. ADD DLB MODAL AFTER vadModal
# -------------------------------------------------------------
dlb_modal_html = """
<!-- ══ LEWY BODY DEMENTIA (DLB) PERSONALIZATION & PRINT MODAL ══ -->
<dialog id="dlbModal" class="arb-dialog dlb-modal" aria-labelledby="dlbModalTitle">
  <div class="dlb-modal-header">
    <div>
      <h2 id="dlbModalTitle" class="dlb-modal-title">👁️ Lewy Body Dementia CST Suite</h2>
      <p class="dlb-modal-subtitle">Visuospatial accommodation, auditory-rhythmic cording, 6–10px borders &amp; somatic grounding</p>
    </div>
    <button type="button" class="dlb-modal-close" id="dlbModalCloseBtn" aria-label="Close dialog">&times;</button>
  </div>
  <form id="dlbModalForm" method="dialog">
    <div class="dlb-modal-body">
      <div class="dlb-field-row">
        <div class="dlb-field-group">
          <label class="dlb-label" for="dlbResidentName">Resident Name (for Header &amp; Personal Anchors):</label>
          <input type="text" id="dlbResidentName" class="dlb-input" placeholder="e.g., Arthur Pendelton" autocomplete="off">
        </div>
        <div class="dlb-field-group">
          <label class="dlb-label" for="dlbFormativeEra">Formative Era Selector:</label>
          <select id="dlbFormativeEra" class="dlb-select">
            <option value="1920s">1920s (Ragtime March, Steam Trains, Parlor Songs)</option>
            <option value="1930s">1930s (Big Band Swing, Radio Melodies, Farm Plots)</option>
            <option value="1940s">1940s (Sentimental Journey, Victory Hymns, Heritage)</option>
            <option value="1950s" selected>1950s (Main Street, Rock &amp; Roll Cadence, Classic Jukebox)</option>
            <option value="1960s">1960s (Acoustic Folk, Motown Rhythms, Apollo)</option>
            <option value="1970s">1970s (Classic Acoustic Ballads, Country Roads, Bicentennial)</option>
          </select>
        </div>
      </div>

      <div class="dlb-field-row">
        <div class="dlb-field-group">
          <label class="dlb-label" for="dlbModeSelect">Real-Time Lucidity &amp; Alertness State:</label>
          <select id="dlbModeSelect" class="dlb-select">
            <option value="all">All Modes (Balanced Access)</option>
            <option value="alert">Alert · High-Contrast (6–10px Visual-Motor Targets)</option>
            <option value="fluctuating">Fluctuating · Auditory Pacing (Rhythms &amp; Sing-Along)</option>
            <option value="calming">Visual Calming · Somatic Grounding (Anti-Hallucination Touch)</option>
          </select>
        </div>
        <div class="dlb-field-group">
          <label class="dlb-label" for="dlbLineWidthSelect">Adaptive Border Line-Weight (Parkinsonian Tremor):</label>
          <select id="dlbLineWidthSelect" class="dlb-select">
            <option value="6">6pt (Standard High-Contrast Border)</option>
            <option value="8" selected>8pt (Bold Tremor Compensation Border)</option>
            <option value="10">10pt (Maximum Visibility Ultra-Thick Outline)</option>
          </select>
        </div>
      </div>

      <div class="dlb-field-group">
        <label class="dlb-label" for="dlbActivitySelect">Target Activity Module:</label>
        <select id="dlbActivitySelect" class="dlb-select">
          <!-- Populated dynamically from LEWY_ACTIVITIES -->
        </select>
      </div>

      <div class="dlb-field-group" id="dlbRationaleContainer">
        <label class="dlb-label">Neuropathological &amp; Visuospatial Rationale:</label>
        <div class="dlb-rationale-box" id="dlbRationaleText">
          Loading DLB clinical rationale...
        </div>
      </div>

      <div class="dlb-field-group">
        <label class="dlb-label">Activity Output Options (0.75&Prime; Gutter Print Engine):</label>
        <div class="dlb-options-grid" role="radiogroup" aria-label="Output format selection">
          <label class="dlb-output-card is-selected" id="dlbModeSingleLabel">
            <input type="radio" name="dlbOutputMode" value="single" checked>
            <span class="dlb-output-title">📄 Single Activity Sheet</span>
            <span class="dlb-output-desc">Large high-contrast activity sheet with 6-10px adaptive borders, zero visual crowding, and verification block.</span>
          </label>
          <label class="dlb-output-card" id="dlbModeMiniLabel">
            <input type="radio" name="dlbOutputMode" value="mini_packet">
            <span class="dlb-output-title">📚 3-Activity Mini-Packet</span>
            <span class="dlb-output-desc">Complete daily session: Morning Auditory rhythm, Mid-day Visual-motor outline, Evening Somatic grounding + cover.</span>
          </label>
          <label class="dlb-output-card" id="dlbModeGuideLabel">
            <input type="radio" name="dlbOutputMode" value="guide">
            <span class="dlb-output-title">📋 Facilitation Guide</span>
            <span class="dlb-output-desc">Clinical caregiver protocol: alpha-synuclein pathology, anti-hallucination validation, and 3-tier prompting hierarchy.</span>
          </label>
        </div>
      </div>
    </div>

    <div class="dlb-modal-actions">
      <button type="button" class="dlb-btn-cancel" id="dlbModalCancelBtn">Cancel</button>
      <button type="submit" class="dlb-btn-generate" id="dlbModalSubmitBtn">
        <span>🖨️</span> Generate &amp; Print PDF
      </button>
    </div>
  </form>
</dialog>
"""

vad_modal_end_anchor = "</dialog>\n\n\n\n<!-- ══ PROFILE PACKET BUILDER"
idx_vm = content.find(vad_modal_end_anchor)
if idx_vm != -1:
    content = content[:idx_vm + len("</dialog>\n")] + dlb_modal_html + content[idx_vm + len("</dialog>\n"):]
    print("DLB Modal HTML inserted successfully.")
else:
    print("Could not find vad_modal_end_anchor")
    exit(1)

# -------------------------------------------------------------
# 4. INJECT LEWY_ACTIVITIES AND UPDATE AILMENT_DATA.lewy_body
# -------------------------------------------------------------
lewy_data_code = """/* -----------------------------------------------------------------
   LEWY BODY DEMENTIA (DLB) CST EXPANSION: 10 CLINICAL ACTIVITY MODULES
   Alpha-synuclein spectrum · Fluctuating alertness · Visuospatial agnosia
   Adaptive 6px-10px borders · Zero visual crowding · Somatosensory grounding
   ----------------------------------------------------------------- */
const LEWY_ACTIVITIES = [
  {
    id: "rhythmic_drumming",
    title: "Rhythmic Drumming & Percussion Tracking",
    shortTitle: "Percussion Tracking",
    icon: "🥁",
    mode: "fluctuating",
    visuospatialFocus: "Basal ganglia timing circuits, auditory-motor entrainment & alerting",
    rationale: "Bypasses compromised occipital-parietal visuospatial pathways by anchoring attention to steady auditory tempo. Bilateral percussive tapping stimulates thalamocortical alerting circuits during fluctuating daytime drowsiness without imposing visual processing fatigue.",
    guide: {
      prep: "Provide two lightweight wooden rhythm sticks or a single hand-held tambourine/drum. Caregiver sits directly across at eye level.",
      prompting: [
        "Level 1 (Auditory): Tap a steady 1-2-3-4 cadence and chant along rhythmically.",
        "Level 2 (Visual/Modeling): Model the alternating bilateral tap with exaggerated, slow arm movements.",
        "Level 3 (Physical/Hand-over-hand): Lightly guide the resident's wrist to strike the drum head in cadence."
      ],
      env: "Glare-free illumination. Eliminate background television or conversational crosstalk. Maintain a steady, unhurried 80–95 BPM cadence."
    },
    eraAnchors: {
      "1920s": "Charleston & Dixieland Brass Syncopation (Steady 2-beat march cadence)",
      "1930s": "Swing Big Band Snare Pulse (Benny Goodman, Glenn Miller 4-count rhythm)",
      "1940s": "Big Band Boogie & Military March Cadence (Glenn Miller, Andrews Sisters)",
      "1950s": "Classic Rockabilly Backbeat & Country Pulse (Bill Haley, Elvis, Johnny Cash)",
      "1960s": "Motown Tambourine & Folk Guitar Strumming Cadence (Four Tops, Supremes)",
      "1970s": "Classic Acoustic Ballad & Steady Pop Beat (John Denver, Carpenters, Eagles)"
    },
    instruction: "Follow the auditory rhythm. Tap your sticks or drum along with the caregiver on every count.",
    steps: [
      "Phase 1: Unison steady single beat (Count: 1... 2... 3... 4...)",
      "Phase 2: Alternating hand tapping (Left, Right, Left, Right)",
      "Phase 3: Call-and-response rhythm echo (Caregiver taps two, resident echoes two)",
      "Phase 4: Rhythmic rest and deep breath reset"
    ]
  },
  {
    id: "bold_coloring",
    title: "High-Contrast Bold & Easy Coloring (6px–10px borders)",
    shortTitle: "Bold Outline Coloring",
    icon: "🎨",
    mode: "alert",
    visuospatialFocus: "Ventral stream figure-ground discrimination & motor tremor compensation",
    rationale: "Alpha-synuclein pathology in the primary visual cortex causes severe visual crowding and boundary bleeding. 6px to 10px ultra-thick solid black borders contain parkinsonian resting tremors, eliminate ambiguous edges, and prevent visual hallucination triggers.",
    guide: {
      prep: "Provide thick wedge-tip black markers or jumbo triangular crayons. Secure the paper with non-residue tape to prevent paper slippage.",
      prompting: [
        "Level 1 (Verbal): 'Let's color inside this large bold outline. Would you like red or blue?'",
        "Level 2 (Gestural): Trace your index finger along the thick 8px black boundary to delineate the edge.",
        "Level 3 (Physical): Support the resident's forearm to stabilize resting motor tremor."
      ],
      env: "Even diffuse lighting from directly above. Zero shadows across the paper surface."
    },
    eraAnchors: {
      "1920s": { name: "Vintage Steam Locomotive Engine", detail: "Heavy iron boiler, front headlight, and brass bell" },
      "1930s": { name: "Country Farmhouse Apple Basket", detail: "Solid woven orchard basket with plump round apples" },
      "1940s": { name: "Rosie's Bandana Star & Heritage Biplane", detail: "Bold five-point star and twin-wing airplane" },
      "1950s": { name: "Main Street Diner Coffee Mug & Jukebox", detail: "Steaming ceramic diner mug and arched music crest" },
      "1960s": { name: "Apollo Space Capsule & Big Sunflower", detail: "Conical lunar command module and wide petal flower" },
      "1970s": { name: "Heritage Liberty Bell & Country Barn", detail: "Iconic historic bell and rustic timber barn outline" }
    },
    instruction: "Color inside the heavy solid border. Stay within the thick boundary line."
  },
  {
    id: "familiar_singalongs",
    title: "Familiar Sing-Alongs with Audio Anchors",
    shortTitle: "Familiar Sing-Along",
    icon: "🎶",
    mode: "fluctuating",
    visuospatialFocus: "Auditory cortex, temporal lobe autobiographical memory & autonomic regulation",
    rationale: "Musical memory in the superior temporal gyrus and supplementary motor area remains remarkably preserved in DLB despite occipital decline. Melodic phrasing bypasses visual apathy, stimulates diaphragmatic breathing, and elevates alertness during daytime dips.",
    guide: {
      prep: "Display the single large 24pt bold lyric sheet with no extraneous decoration or images.",
      prompting: [
        "Level 1 (Auditory): Begin humming or singing the familiar opening phrase in a warm, inviting tone.",
        "Level 2 (Gestural): Gently sway or tap hand in sync with the song's downbeat.",
        "Level 3 (Physical): Hold the resident's hand and gently squeeze on the accented syllables."
      ],
      env: "Quiet room with warm acoustics. Avoid electronic amplification with harsh treble frequencies."
    },
    eraAnchors: {
      "1920s": [
        { song: "Side by Side", chorus: "Oh, we ain't got a barrel of money, Maybe we're ragged and funny; But we'll travel along, singin' a song, Side by side!" },
        { song: "Ain't She Sweet", chorus: "Ain't she sweet? See her coming down the street! Now I ask you very confidentially, Ain't she sweet?" }
      ],
      "1930s": [
        { song: "Over the Rainbow", chorus: "Somewhere over the rainbow, way up high, There's a land that I heard of once in a lullaby." },
        { song: "Pennies from Heaven", chorus: "Every time it rains, it rains pennies from heaven. Don't you know each cloud contains pennies from heaven?" }
      ],
      "1940s": [
        { song: "You Are My Sunshine", chorus: "You are my sunshine, my only sunshine, You make me happy when skies are gray; You'll never know dear, how much I love you, Please don't take my sunshine away." },
        { song: "Sentimental Journey", chorus: "Gonna take a sentimental journey, Gonna set my heart at ease; Gonna make a sentimental journey, To renew old memories." }
      ],
      "1950s": [
        { song: "Que Sera, Sera", chorus: "Que sera, sera, Whatever will be, will be; The future's not ours to see, Que sera, sera! What will be, will be." },
        { song: "Love Me Tender", chorus: "Love me tender, love me sweet, Never let me go; You have made my life complete, And I love you so." }
      ],
      "1960s": [
        { song: "Stand by Me", chorus: "When the night has come, and the land is dark, And the moon is the only light we'll see; No I won't be afraid, no I won't be afraid, Just as long as you stand, stand by me." },
        { song: "Moon River", chorus: "Moon river, wider than a mile, I'm crossing you in style some day; Oh, dream maker, you heart breaker, Wherever you're goin', I'm goin' your way." }
      ],
      "1970s": [
        { song: "Take Me Home, Country Roads", chorus: "Country roads, take me home, To the place I belong; West Virginia, mountain mama, Take me home, country roads." },
        { song: "Lean on Me", chorus: "Lean on me, when you're not strong, And I'll be your friend, I'll help you carry on; For it won't be long 'til I'm gonna need somebody to lean on." }
      ]
    },
    instruction: "Sing along or hum to the familiar song chorus. Feel the melody and rhythmic phrasing."
  },
  {
    id: "tactile_matching",
    title: "Tactile Texture Matching Boards",
    shortTitle: "Texture Matching",
    icon: "🧶",
    mode: "calming",
    visuospatialFocus: "Primary somatosensory cortex (S1) & non-visual sensory verification",
    rationale: "Visual agnosia in DLB impairs object identification by sight alone. Tactile matching engages intact somatosensory mechanoreceptors to verify physical reality through touch, reassuring residents and extinguishing visual illusions without debate.",
    guide: {
      prep: "Prepare paired tactile cards (velvet, burlap, polished wood, corrugated card, cotton flannel).",
      prompting: [
        "Level 1 (Verbal): 'Feel this soft cloth. Can you find another one that feels just as soft?'",
        "Level 2 (Gestural): Place the resident's finger directly onto the sample texture card.",
        "Level 3 (Physical): Guide the resident's hand back and forth across both matching swatches."
      ],
      env: "Restful lighting. Resident may close eyes if visual stimuli are causing agitation or illusions."
    },
    textures: [
      { name: "Soft Velvet / Flannel", sensation: "Warm, smooth, low-friction calming sensory touch" },
      { name: "Coarse Burlap / Twine", sensation: "Textured, woven high-friction tactile feedback" },
      { name: "Polished Hardwood", sensation: "Cool, solid, invariant smooth surface anchor" },
      { name: "Corrugated Ridge Card", sensation: "Distinct parallel lines for tactile finger tracing" }
    ],
    instruction: "Feel each texture square with your fingertips. Find the matching pair through touch alone."
  },
  {
    id: "band_stretching",
    title: "Light Resistance Band Stretching to Music",
    shortTitle: "Band Stretch to Music",
    icon: "🧘",
    mode: "alert",
    visuospatialFocus: "Extrapyramidal motor pathways, bradykinesia mitigation & postural alignment",
    rationale: "Lewy body parkinsonism produces muscular rigidity, stooped posture, and bradykinesia. Gentle isometric resistance band exercises synchronized to slow musical cadences ease muscular stiffness and improve thoracic expansion for vocalization.",
    guide: {
      prep: "Use an extra-soft (yellow or red) elastic resistance band. Ensure resident is seated securely in a sturdy armchair with feet flat on the floor.",
      prompting: [
        "Level 1 (Verbal): 'Pull the band outward as we count: Open, two, three, and rest.'",
        "Level 2 (Visual): Sit directly facing resident and perform mirror movements with an identical band.",
        "Level 3 (Physical): Lightly support elbows to maintain safe biomechanics without pulling."
      ],
      env: "Clear 6-foot radius around chair. Upbeat, moderate-tempo classical or 1950s waltz."
    },
    drills: [
      { name: "Seated Chest Expansion", action: "Hold band shoulder-width apart; gently pull outward while inhaling to open chest" },
      { name: "Rhythmic Bicep Curls", action: "Loop band under shoes or thighs; curl hands toward shoulders matching musical meter" },
      { name: "Seated Heel-Tap Marching", action: "Keep hands steady on band; alternate heel taps on floor to stimulate circulation" },
      { name: "Overhead Sunrise Reach", action: "Raise band overhead in slow arc; look gently upward to relieve neck stiffness" }
    ],
    instruction: "Perform each gentle stretch in rhythm with the music. Breathe deeply with each movement."
  },
  {
    id: "scent_identification",
    title: "Olfactory Scent Identification & Reminiscence",
    shortTitle: "Olfactory Reminiscence",
    icon: "🌿",
    mode: "calming",
    visuospatialFocus: "Olfactory bulb & entorhinal limbic circuits (zero visual processing required)",
    rationale: "Olfactory stimulation bypasses visual pathways entirely, eliminating any risk of visual illusions, pareidolia, or visual fatigue. Familiar scent molecules trigger immediate episodic memories and evoke emotional grounding.",
    guide: {
      prep: "Prepare scented cotton rounds inside small opaque containers (unscented containers).",
      prompting: [
        "Level 1 (Olfactory): Hold the scent container 3 inches below the resident's nose for 3 seconds.",
        "Level 2 (Verbal): 'Does this smell like fresh lemon or warm holiday baking?'",
        "Level 3 (Reminiscence): 'Did your family bake apple pies or enjoy fresh oranges in winter?'"
      ],
      env: "Well-ventilated room. Introduce only one scent every 2 minutes to prevent olfactory habituation."
    },
    scents: [
      { name: "Fresh Orchard Lemon", memoryAnchor: "Sunlit kitchen counter, fresh lemonade, summer picnics" },
      { name: "Warm Ground Cinnamon", memoryAnchor: "Holiday baking, spiced cider, grandmother's apple pie" },
      { name: "Mountain Pine Needle", memoryAnchor: "Winter evergreen trees, crisp morning walks, forest air" },
      { name: "Sweet Bakery Vanilla", memoryAnchor: "Sunday birthday cake, ice cream parlor, warm cookies" }
    ],
    instruction: "Inhale gently. Identify the familiar scent and share the memories it brings to mind."
  },
  {
    id: "peg_puzzles",
    title: "Large-Piece Wooden Peg Puzzles",
    shortTitle: "High-Contrast Peg Puzzle",
    icon: "🧩",
    mode: "alert",
    visuospatialFocus: "Dorsal stream visuomotor guidance & parkinsonian grasp facilitation",
    rationale: "Standard puzzle pieces create visual confusion due to interlocking edge details. High-contrast peg puzzles feature isolated, bold geometric forms with oversized grip knobs and 8px contrast borders that prevent visual figure-ground ambiguity.",
    guide: {
      prep: "Lay out a 4-slot high-contrast puzzle board on a matte, unpatterned surface.",
      prompting: [
        "Level 1 (Verbal): 'Look at the round circle piece. Which space matches its shape?'",
        "Level 2 (Gestural): Point to the matching cutout border with a finger.",
        "Level 3 (Physical): Guide the resident's fingers onto the wooden peg and assist inset placement."
      ],
      env: "High ambient lighting. Contrast background cloth (navy or dark green) under wooden board."
    },
    shapes: [
      { shape: "Bold Circle", icon: "⚪", desc: "Invariant 360-degree round silhouette with central grab peg" },
      { shape: "Solid Square", icon: "⬛", desc: "Four equilateral corners with distinct right angles" },
      { shape: "Equilateral Triangle", icon: "▲", desc: "Three distinctive apex points pointing directly upward" },
      { shape: "Heritage Heart", icon: "♥", desc: "Familiar symmetrical contour with curved upper lobes" }
    ],
    instruction: "Grasp the large wooden peg. Match each solid shape into its corresponding high-contrast cutout."
  },
  {
    id: "hand_massage",
    title: "Caregiver-Guided Hand Massage & Somatic Grounding",
    shortTitle: "Somatic Hand Massage",
    icon: "🤲",
    mode: "calming",
    visuospatialFocus: "Proprioceptive somatic grounding, vagal nerve tone & parasympathetic calming",
    rationale: "During periods of visual hallucination or fluctuating REM sleep behavior disorientation, verbal rationalization can increase agitation. Deep somatic touch pressure recalibrates proprioceptive feedback, quieting the hyperactive amygdala and grounding the resident in physical reality.",
    guide: {
      prep: "Warm hands and warm a small dime-sized amount of hypoallergenic, unscented lotion or oil.",
      prompting: [
        "Level 1 (Somatic/Verbal): 'I am going to gently hold your hands. You are safe here with me.'",
        "Level 2 (Effleurage): Long, slow strokes from the fingertips up to the wrist on the dorsal surface.",
        "Level 3 (Thenar Pressure): Slow circular thumb compressions into the fleshy palm base."
      ],
      env: "Soft, warm lighting. Quiet background without unexpected door noises or paging systems."
    },
    steps: [
      { step: "Bilateral Warm Hold", desc: "Rest resident's hands in your warm palms for 30 seconds to establish safety" },
      { step: "Dorsal Effleurage", desc: "Slow, sweeping upward strokes from knuckles toward the wrist joint" },
      { step: "Palm Thenar Compression", desc: "Gentle circular thumb pressure across the base of the thumb and palm center" },
      { step: "Finger Extension Glide", desc: "Slide gently along each finger from base to tip, releasing flexor tension" }
    ],
    instruction: "Relax your hands completely. Breathe in slowly as your hands are gently warmed and massaged."
  },
  {
    id: "foam_ball_tracking",
    title: "High-Visibility Foam Ball Tracking",
    shortTitle: "Ocular Foam Ball Tracking",
    icon: "🟡",
    mode: "alert",
    visuospatialFocus: "Superior colliculus, ocular smooth pursuit & bilateral gross motor reaction",
    rationale: "DLB impairs saccadic and smooth-pursuit eye movements. A single high-visibility monochromatic foam ball (bright yellow on dark felt) rolled in a predictable linear path exercises ocular tracking without visual clutter.",
    guide: {
      prep: "Clear a solid-colored rectangular table. Caregiver sits 4 feet across from the resident.",
      prompting: [
        "Level 1 (Verbal): 'Watch the yellow ball roll toward your hands.'",
        "Level 2 (Auditory/Visual): Tap the table twice before rolling the ball along the center line.",
        "Level 3 (Physical): Gently touch the resident's palms to open them ready for contact."
      ],
      env: "Matte dark table surface. No tablecloth with floral patterns or stripes."
    },
    drills: [
      { drill: "Linear Center Roll", instruction: "Track the yellow ball as it rolls smoothly toward your chest; catch with two hands" },
      { drill: "Lateral Horizon Tracking", instruction: "Follow the ball with your eyes as the caregiver moves it slowly from left to right" },
      { drill: "Gentle Two-Hand Push", instruction: "Push the soft ball back across the table with both palms flat" }
    ],
    instruction: "Keep your eyes on the bright yellow ball. Catch it gently with both hands as it reaches you."
  },
  {
    id: "shadow_matching",
    title: "Object Shadow-Matching Silhouettes",
    shortTitle: "Shadow Silhouette Matching",
    icon: "👥",
    mode: "alert",
    visuospatialFocus: "Ventral occipitotemporal stream, figure-ground disambiguation & anti-pareidolia drill",
    rationale: "Pareidolia (perceiving illusory faces or figures in shadows and textured surfaces) is a clinical hallmark of DLB. This exercise explicitly trains the visual cortex to distinguish solid flat silhouettes from ambiguous textures, disambiguating visual illusions through structured matching.",
    guide: {
      prep: "Present one pair of cards at a time: a solid black silhouette and its corresponding bold outline illustration.",
      prompting: [
        "Level 1 (Verbal): 'Here is the shadow of a teapot. Which object matches this shadow?'",
        "Level 2 (Gestural): Trace the outer contour of the silhouette with your finger.",
        "Level 3 (Physical): Place the silhouette card directly over the matching outline drawing."
      ],
      env: "High figure-ground contrast. Solid white card stock with dense 100% black silhouette ink."
    },
    items: [
      { name: "Kitchen Teapot", desc: "Curved handle on left, distinctive spout on right, round domed lid" },
      { name: "Porch Rocking Chair", desc: "Tall vertical back slats and curved rocker base rails" },
      { name: "Garden Watering Can", desc: "Long slanted pour spout and large semi-circle top carry handle" },
      { name: "Classic Coupe Sedan", desc: "Sleek roofline curvature with distinct front bumper and rear fin" }
    ],
    instruction: "Look at the solid black silhouette on the left. Match it to the clear outline drawing on the right."
  }
];
"""

# Replace lewy_body object in AILMENT_DATA
old_lewy_body_block = """    lewy_body: {
    label: "Lewy Body Dementia",
    shortLabel: "Lewy Body",
    packetTitle: "Clear-View Activity Packet",
    fileTag: "LewyBody",
    pairs: [
      ["Salt", "Pepper"], ["Cup", "Saucer"], ["Bread", "Butter"], ["Shoes", "Socks"],
      ["Knife", "Fork"], ["Needle", "Thread"], ["Table", "Chair"], ["Rain", "Umbrella"],
      ["Pen", "Paper"], ["Bacon", "Eggs"]
    ],
    questions: [
      "Do you like the smell of fresh bread?", "Have you ever seen the ocean?",
      "Do you enjoy music?", "Do you like flowers?", "Do you like warm weather?",
      "Have you ever ridden a horse?", "Do you like to dance?", "Do you enjoy a cup of tea?"
    ],
    guide: {
      why: "Lewy body dementia commonly affects visual perception and can cause visual hallucinations. Plain white pages, heavy outlines and large bold type lower the chance of the page being misread.",
      how: [
        "Use good, even lighting with no glare on the paper.",
        "Offer a thick marker or felt pen. The targets are large on purpose.",
        "Go at the resident's pace; alertness can change from hour to hour. If now is not a good time, try again later.",
        "If the resident reports seeing something on the page that is not there, stay calm, do not argue, and move to a fresh page."
      ],
      avoid: [
        "Patterned tablecloths or busy surfaces under the page.",
        "Photocopies that add grey speckle or shading. Print from the PDF instead.",
        "Correcting or testing. Keep it relaxed."
      ],
      evidence: "Visual hallucinations and fluctuating attention are core clinical features of dementia with Lewy bodies (McKeith et al., 2017 consensus criteria)."
    }
  },"""

new_lewy_body_block = lewy_data_code + """
  lewy_body: {
    label: "Lewy Body Dementia",
    shortLabel: "Lewy Body",
    packetTitle: "Visuospatial & Sensory CST Packet",
    fileTag: "LewyBody_CST",
    activities: LEWY_ACTIVITIES,
    pairs: [
      ["Salt", "Pepper"], ["Cup", "Saucer"], ["Bread", "Butter"], ["Shoes", "Socks"],
      ["Knife", "Fork"], ["Needle", "Thread"], ["Table", "Chair"], ["Rain", "Umbrella"],
      ["Pen", "Paper"], ["Bacon", "Eggs"]
    ],
    questions: [
      "Do you like the sound of friendly music?", "Do you enjoy the smell of fresh bread?",
      "Have you ever seen the ocean shore?", "Do you like the warmth of spring sunshine?",
      "Do you enjoy a warm cup of sweet tea?", "Have you ever planted flower seeds?"
    ],
    guide: {
      why: "Lewy body dementia (alpha-synuclein pathology) damages occipital-parietal visual networks and dopamine striatal circuits, triggering fluctuating daytime alertness, visual crowding, visual misperceptions (pareidolia), and parkinsonism. Adaptive 6-10px borders, auditory-rhythmic cording, and somatic grounding preserve dignity and reduce distress.",
      how: [
        "Assess alertness first: if drowsy, engage rhythmic drumming or familiar sing-alongs; if alert, use bold 8px coloring or peg puzzles.",
        "Use pure black-and-white pages with zero background grayscale patterns or confusing wallpaper textures to prevent hallucinations.",
        "If the resident experiences an illusion, validate their emotional experience with empathy and gently redirect toward tactile grounding.",
        "Support parkinsonian motor tremor with wide, 6-10px heavy boundaries and large touch targets."
      ],
      avoid: [
        "Patterned tablecloths, shiny surfaces, or poor directional shadows.",
        "Arguing or debating perceived visual hallucinations.",
        "Rushing or testing. Adapt immediately to fluctuating lucidity levels."
      ],
      evidence: "Evidence-based dementia care (McKeith et al., 2017 consensus criteria for DLB) demonstrates that multimodal sensory anchors (auditory, somatic, olfactory) bypass occipital hypometabolism and support fluctuating lucidity."
    }
  },"""

idx_lb = content.find(old_lewy_body_block)
if idx_lb != -1:
    content = content[:idx_lb] + new_lewy_body_block + content[idx_lb + len(old_lewy_body_block):]
    print("AILMENT_DATA.lewy_body updated successfully.")
else:
    print("Could not find old_lewy_body_block")
    exit(1)

# -------------------------------------------------------------
# 5. UPDATE ailRenderLewy AND ADD generateLewySpecializedPDF
# -------------------------------------------------------------
old_ailRenderLewy_start = "function ailRenderLewy(ctx) {"
old_ailRenderLewy_end = "/* -----------------------------------------------------------------\n   FRONTOTEMPORAL"

idx_rl1 = content.find(old_ailRenderLewy_start)
idx_rl2 = content.find(old_ailRenderLewy_end)
if idx_rl1 == -1 or idx_rl2 == -1:
    print("Could not find ailRenderLewy boundaries")
    exit(1)

new_lewy_pdf_code = """/* -----------------------------------------------------------------
   LEWY BODY DEMENTIA: 0.75-inch (54pt) Gutter Print Engine,
   Adaptive 6-10px Borders, Zero Visual Crowding, Monochromatic High-Contrast.
   ----------------------------------------------------------------- */
function drawLewyHeader(d, residentName, era, title, subtitle, lineWidth, pageNum, totalPages) {
  const W = 612, H = 792, M = 54; // 54pt = 0.75 inches
  const lw = Number(lineWidth) || 8;

  // Outer border
  d.setDrawColor(0, 0, 0);
  d.setLineWidth(lw);
  d.line(M, 44, W - M, 44);

  // Top metadata row
  d.setFont("helvetica", "bold");
  d.setFontSize(9);
  d.setTextColor(0, 0, 0);
  d.text("COGNICOPIA  ·  LEWY BODY DEMENTIA (DLB) CST SUITE", M, 36);

  d.setFont("helvetica", "bold");
  d.setFontSize(8.5);
  const borderTag = lw + "pt Ultra-Bold Border  ·  Anti-Hallucination Layout" + (totalPages ? "  ·  Page " + pageNum + " of " + totalPages : "");
  d.text(borderTag, W - M, 36, { align: "right" });

  // Resident & Era anchor
  d.setFontSize(12);
  const resText = "Resident: " + (residentName || "Participant");
  d.text(resText, M, 60);

  d.setFont("helvetica", "normal");
  d.setFontSize(10);
  const eraText = "Anchor: " + (era || "1950s") + " Cohort  ·  Visuospatial & Alertness Cording";
  d.text(eraText, W - M, 60, { align: "right" });

  // Heavy title rule
  d.setLineWidth(lw);
  d.line(M, 70, W - M, 70);

  d.setFont("helvetica", "bold");
  d.setFontSize(22);
  d.setTextColor(0, 0, 0);
  d.text(title, W / 2, 98, { align: "center" });

  d.setFont("helvetica", "normal");
  d.setFontSize(12);
  d.text(subtitle || "Sensory Stimulation & Extrapyramidal Tremor Compensation", W / 2, 116, { align: "center" });

  d.setLineWidth(Math.max(4, lw - 2));
  d.line(M, 126, W - M, 126);
}

function drawLewyFooter(d, residentName, lineWidth) {
  const W = 612, H = 792, M = 54;
  const lw = Number(lineWidth) || 8;

  d.setDrawColor(0, 0, 0);
  d.setLineWidth(lw);
  d.line(M, H - 76, W - M, H - 76);

  // Large 46pt completion box
  d.rect(M + 8, H - 64, 44, 44, "S");

  d.setFont("helvetica", "bold");
  d.setFontSize(18);
  d.setTextColor(0, 0, 0);
  d.text("Activity Completed Together", M + 64, H - 38);

  d.setFont("helvetica", "normal");
  d.setFontSize(10);
  const dateStr = (typeof PACKET_DATE !== "undefined" ? PACKET_DATE : new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }));
  d.text("Date: " + dateStr + "   ·   Caregiver Verification: _______________________", M + 64, H - 22);
}

function renderLewyActivityContent(d, act, era, mode, lineWidth, yStart) {
  const W = 612, H = 792, M = 54;
  const lw = Number(lineWidth) || 8;
  let y = yStart;

  // Visuospatial Rationale Box
  d.setDrawColor(0, 0, 0);
  d.setFillColor(245, 245, 245);
  d.setLineWidth(1.5);
  const ratLines = d.splitTextToSize("Clinical Rationale: " + act.rationale, W - 2 * M - 24);
  const ratH = 16 + ratLines.length * 12;
  d.rect(M, y, W - 2 * M, ratH, "FD");
  d.setFont("helvetica", "bold");
  d.setFontSize(9.5);
  d.setTextColor(0, 0, 0);
  d.text(ratLines, M + 12, y + 16, { lineHeightFactor: 1.25 });
  y += ratH + 16;

  // Single boxed instruction with heavy boundary
  d.setLineWidth(Math.max(3, lw - 3));
  const instrLines = d.splitTextToSize(act.instruction, W - 2 * M - 30);
  const instrH = 20 + instrLines.length * 16;
  d.rect(M, y, W - 2 * M, instrH, "S");
  d.setFont("helvetica", "bold");
  d.setFontSize(15);
  d.text(instrLines, W / 2, y + 17 + (instrLines.length > 1 ? 0 : 3), { align: "center", lineHeightFactor: 1.2 });
  y += instrH + 20;

  d.setLineWidth(lw);

  if (act.id === "rhythmic_drumming") {
    d.setFont("helvetica", "bold");
    d.setFontSize(14);
    const anchorEra = (act.eraAnchors && act.eraAnchors[era]) ? act.eraAnchors[era] : act.eraAnchors["1950s"];
    d.text("Musical Cadence Anchor: " + anchorEra, M, y);
    y += 24;

    act.steps.forEach((st, idx) => {
      d.rect(M + 4, y, 36, 36, "S");
      d.setFont("helvetica", "bold");
      d.setFontSize(16);
      d.text(String(idx + 1), M + 16, y + 24);
      d.setFont("helvetica", "bold");
      d.setFontSize(13);
      const sl = d.splitTextToSize(st, W - 2 * M - 60);
      d.text(sl, M + 54, y + 16, { lineHeightFactor: 1.2 });
      y += Math.max(48, 18 + sl.length * 14);
    });

    // Rhythmic Tapping Target Circles
    y += 10;
    d.setFont("helvetica", "bold");
    d.setFontSize(13);
    d.text("Bilateral Hand Rhythm Targets (Tap in Unison):", M, y);
    y += 16;
    const cRadius = 38;
    d.setLineWidth(lw);
    d.circle(M + 120, y + 45, cRadius, "S");
    d.setFont("helvetica", "bold");
    d.setFontSize(14);
    d.text("LEFT HAND", M + 120, y + 50, { align: "center" });

    d.circle(W - M - 120, y + 45, cRadius, "S");
    d.text("RIGHT HAND", W - M - 120, y + 50, { align: "center" });

  } else if (act.id === "bold_coloring") {
    const eraItem = (act.eraAnchors && act.eraAnchors[era]) ? act.eraAnchors[era] : act.eraAnchors["1950s"];
    d.setFont("helvetica", "bold");
    d.setFontSize(16);
    d.text("Coloring Subject: " + eraItem.name, M, y);
    y += 16;
    d.setFont("helvetica", "normal");
    d.setFontSize(12);
    d.text(eraItem.detail, M, y);
    y += 22;

    // Draw ultra-thick high-contrast outline shapes
    d.setLineWidth(lw);
    const boxW = W - 2 * M;
    const boxH = 250;
    d.rect(M, y, boxW, boxH, "S");

    // Geometric high-contrast recognizable composition
    const cx = W / 2, cy = y + boxH / 2;
    d.circle(cx, cy, 75, "S");
    d.rect(cx - 50, cy - 50, 100, 100, "S");
    d.line(cx - 75, cy, cx + 75, cy);
    d.line(cx, cy - 75, cx, cy + 75);

    d.setFont("helvetica", "bold");
    d.setFontSize(14);
    d.text("BOLD " + lw + "pt CONTOUR · HIGH VISIBILITY", cx, y + boxH - 16, { align: "center" });

  } else if (act.id === "familiar_singalongs") {
    const songs = (act.eraAnchors && act.eraAnchors[era]) ? act.eraAnchors[era] : act.eraAnchors["1950s"];
    songs.forEach((sg, idx) => {
      d.rect(M, y, W - 2 * M, 115, "S");
      d.setFont("helvetica", "bold");
      d.setFontSize(16);
      d.text("Song " + (idx + 1) + ": \\"" + sg.song + "\\"", M + 14, y + 24);
      d.line(M, y + 32, W - M, y + 32);

      d.setFont("helvetica", "bold");
      d.setFontSize(13);
      const cLines = d.splitTextToSize(sg.chorus, W - 2 * M - 28);
      d.text(cLines, M + 14, y + 54, { lineHeightFactor: 1.35 });
      y += 130;
    });

    d.setFont("helvetica", "italic");
    d.setFontSize(11);
    d.text("Caregiver Tip: Sing the chorus together in a warm, unhurried cadence.", M, y + 10);

  } else if (act.id === "tactile_matching") {
    act.textures.forEach((tx, idx) => {
      d.rect(M, y, W - 2 * M, 58, "S");
      d.setFont("helvetica", "bold");
      d.setFontSize(15);
      d.text((idx + 1) + ". " + tx.name, M + 16, y + 24);
      d.setFont("helvetica", "normal");
      d.setFontSize(11);
      d.text(tx.sensation, M + 16, y + 42);

      // Checkbox
      d.rect(W - M - 44, y + 10, 36, 36, "S");
      y += 68;
    });

  } else if (act.id === "band_stretching") {
    act.drills.forEach((dr, idx) => {
      d.rect(M, y, W - 2 * M, 58, "S");
      d.setFont("helvetica", "bold");
      d.setFontSize(14);
      d.text("Stretch " + (idx + 1) + ": " + dr.name, M + 16, y + 22);
      d.setFont("helvetica", "normal");
      d.setFontSize(11);
      const al = d.splitTextToSize(dr.action, W - 2 * M - 70);
      d.text(al, M + 16, y + 38);

      d.rect(W - M - 44, y + 10, 36, 36, "S");
      y += 68;
    });

  } else if (act.id === "scent_identification") {
    act.scents.forEach((sc, idx) => {
      d.rect(M, y, W - 2 * M, 58, "S");
      d.setFont("helvetica", "bold");
      d.setFontSize(15);
      d.text("Scent " + (idx + 1) + ": " + sc.name, M + 16, y + 24);
      d.setFont("helvetica", "normal");
      d.setFontSize(11);
      d.text("Memory Anchor: " + sc.memoryAnchor, M + 16, y + 42);

      d.rect(W - M - 44, y + 10, 36, 36, "S");
      y += 68;
    });

  } else if (act.id === "peg_puzzles") {
    const colW = (W - 2 * M - 20) / 2;
    act.shapes.forEach((sh, idx) => {
      const colX = (idx % 2 === 0) ? M : M + colW + 20;
      const rowY = y + Math.floor(idx / 2) * 115;
      d.rect(colX, rowY, colW, 105, "S");

      d.setFont("helvetica", "bold");
      d.setFontSize(16);
      d.text(sh.icon + " " + sh.shape, colX + 16, rowY + 28);
      d.line(colX, rowY + 36, colX + colW, rowY + 36);

      d.setFont("helvetica", "normal");
      d.setFontSize(10.5);
      const dl = d.splitTextToSize(sh.desc, colW - 24);
      d.text(dl, colX + 12, rowY + 54, { lineHeightFactor: 1.25 });
    });

  } else if (act.id === "hand_massage") {
    act.steps.forEach((st, idx) => {
      d.rect(M, y, W - 2 * M, 58, "S");
      d.setFont("helvetica", "bold");
      d.setFontSize(14);
      d.text("Step " + (idx + 1) + ": " + st.step, M + 16, y + 22);
      d.setFont("helvetica", "normal");
      d.setFontSize(11);
      const sl = d.splitTextToSize(st.desc, W - 2 * M - 70);
      d.text(sl, M + 16, y + 38);

      d.rect(W - M - 44, y + 10, 36, 36, "S");
      y += 68;
    });

  } else if (act.id === "foam_ball_tracking") {
    act.drills.forEach((dr, idx) => {
      d.rect(M, y, W - 2 * M, 64, "S");
      d.setFont("helvetica", "bold");
      d.setFontSize(14);
      d.text("Tracking Drill " + (idx + 1) + ": " + dr.drill, M + 16, y + 22);
      d.setFont("helvetica", "normal");
      d.setFontSize(11);
      const il = d.splitTextToSize(dr.instruction, W - 2 * M - 70);
      d.text(il, M + 16, y + 40);

      d.rect(W - M - 44, y + 12, 36, 36, "S");
      y += 74;
    });

  } else if (act.id === "shadow_matching") {
    act.items.forEach((it, idx) => {
      d.rect(M, y, W - 2 * M, 58, "S");
      d.setFont("helvetica", "bold");
      d.setFontSize(14);
      d.text("Item " + (idx + 1) + ": " + it.name + " (Solid Silhouette)", M + 16, y + 22);
      d.setFont("helvetica", "normal");
      d.setFontSize(11);
      d.text("Distinct Contours: " + it.desc, M + 16, y + 40);

      d.rect(W - M - 44, y + 10, 36, 36, "S");
      y += 68;
    });
  }
}

function generateLewySpecializedPDF(opts) {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    throw new Error("jsPDF library is not loaded.");
  }
  const options = opts || {};
  const residentName = options.residentName || (typeof ailResidentName === "function" ? ailResidentName() : "") || "Resident";
  const era = options.era || "1950s";
  const mode = options.mode || "all";
  const lineWidth = Number(options.lineWidth) || 8;
  const actId = options.activityId || "bold_coloring";
  const outputMode = options.outputMode || "single";

  const activity = LEWY_ACTIVITIES.find(a => a.id === actId) || LEWY_ACTIVITIES[0];
  const doc = new window.jspdf.jsPDF({ unit: "pt", format: "letter" });
  const W = 612, H = 792, M = 54;

  if (outputMode === "single") {
    drawLewyHeader(doc, residentName, era, activity.title, activity.visuospatialFocus, lineWidth, 1, 1);
    renderLewyActivityContent(doc, activity, era, mode, lineWidth, 138);
    drawLewyFooter(doc, residentName, lineWidth);
  } else if (outputMode === "mini_packet") {
    // 3-Activity Daily Mini-Packet
    // Page 1: Cover Sheet
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(lineWidth);
    doc.rect(M, M, W - 2 * M, H - 2 * M, "S");
    doc.setLineWidth(Math.max(2, lineWidth - 4));
    doc.rect(M + 8, M + 8, W - 2 * M - 16, H - 2 * M - 16, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("COGNICOPIA  ·  CLINICAL MEMORY CARE SUITE", W / 2, M + 40, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(26);
    doc.text("Lewy Body Dementia (DLB)", W / 2, M + 85, { align: "center" });
    doc.setFontSize(18);
    doc.text("Visuospatial & Sensory Daily Mini-Packet", W / 2, M + 115, { align: "center" });

    doc.setLineWidth(lineWidth);
    doc.line(M + 40, M + 130, W - M - 40, M + 130);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Prepared for: " + residentName, W / 2, M + 160, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.text("Historical Cohort: " + era + "  ·  Border Thickness: " + lineWidth + "pt", W / 2, M + 180, { align: "center" });

    // Table of 3 Curated Activities
    const pActs = [
      LEWY_ACTIVITIES.find(a => a.id === "rhythmic_drumming") || LEWY_ACTIVITIES[0],
      LEWY_ACTIVITIES.find(a => a.id === "bold_coloring") || LEWY_ACTIVITIES[1],
      LEWY_ACTIVITIES.find(a => a.id === "hand_massage") || LEWY_ACTIVITIES[7]
    ];

    let ty = M + 225;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("Daily Sensory & Visuospatial Sequence:", M + 30, ty);
    ty += 20;

    const slots = ["Morning Session (Auditory & Rhythmic Pacing)", "Mid-Day Session (High-Contrast Visual-Motor)", "Evening Session (Somatic & Tactile Grounding)"];
    pActs.forEach((pa, i) => {
      doc.setLineWidth(lineWidth);
      doc.rect(M + 30, ty, W - 2 * M - 60, 54, "S");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(slots[i], M + 45, ty + 20);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text(pa.icon + " " + pa.title, M + 45, ty + 38);
      ty += 66;
    });

    // Evidence note
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const evText = doc.splitTextToSize("Clinical Protocol: DLB requires adaptive pacing to match fluctuating alertness. Use auditory rhythm in morning drowsiness, bold " + lineWidth + "pt visual outlines during peak midday lucidity, and somatic touch grounding in the evening to prevent anxiety and visual misperceptions.", W - 2 * M - 60);
    doc.text(evText, W / 2, H - M - 60, { align: "center", lineHeightFactor: 1.3 });

    // Pages 2, 3, 4: The 3 activities
    pActs.forEach((pa, idx) => {
      doc.addPage();
      drawLewyHeader(doc, residentName, era, pa.title, slots[idx], lineWidth, idx + 2, 4);
      renderLewyActivityContent(doc, pa, era, mode, lineWidth, 138);
      drawLewyFooter(doc, residentName, lineWidth);
    });

  } else if (outputMode === "guide") {
    // Caregiver Facilitation Guide
    drawLewyHeader(doc, residentName, era, "Caregiver Facilitation Guide", "Clinical Sensory & Visuospatial Protocol: Lewy Body Dementia", lineWidth, 1, 1);

    let gy = 142;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("1. Neuropathological Profile: Alpha-Synuclein & Occipital Hypometabolism", M, gy);
    gy += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    const nLines = doc.splitTextToSize("Dementia with Lewy Bodies (DLB) features cortical and subcortical Lewy bodies with profound cholinergic deficits and occipital hypometabolism. This generates core clinical features: spontaneous motor parkinsonism, prominent visual misperceptions (pareidolia), and fluctuating alertness. Multimodal sensory cording (auditory and somatic) bypasses damaged visual pathways.", W - 2 * M);
    doc.text(nLines, M, gy, { lineHeightFactor: 1.3 });
    gy += nLines.length * 12 + 16;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("2. Anti-Hallucination & Pareidolia Mitigation Rules", M, gy);
    gy += 16;
    const rules = [
      "Rule 1: Never argue with a visual illusion or hallucination. Validate their emotional reality ('I see that you feel startled. You are safe here with me.').",
      "Rule 2: Eliminate background visual clutter, patterned fabrics, and glare. Ensure solid high-contrast borders (" + lineWidth + "pt) for visual tasks.",
      "Rule 3: Use tactile and auditory redirection immediately (hand touch, familiar music, soothing scent) to ground the resident in the physical room."
    ];
    rules.forEach(rl => {
      doc.setLineWidth(1.5);
      doc.rect(M, gy, W - 2 * M, 30, "S");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      const rlines = doc.splitTextToSize(rl, W - 2 * M - 16);
      doc.text(rlines, M + 8, gy + 12, { lineHeightFactor: 1.2 });
      gy += 36;
    });

    gy += 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("3. Target Module Protocol: " + activity.title, M, gy);
    gy += 16;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text("Preparation:", M, gy);
    doc.setFont("helvetica", "normal");
    doc.text(activity.guide.prep, M + 80, gy);
    gy += 16;

    doc.setFont("helvetica", "bold");
    doc.text("Environment:", M, gy);
    doc.setFont("helvetica", "normal");
    doc.text(activity.guide.env, M + 80, gy);
    gy += 22;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("4. Clinical Lucidity & Alertness Observation Sheet", M, gy);
    gy += 16;

    const obs = [
      "Visual Discrimination: Distinct response to " + lineWidth + "pt bold boundaries without hesitation",
      "Alertness Continuity: Maintained attention throughout the 10-minute session",
      "Hallucination Absence: Calm engagement with zero distress or visual misperceptions",
      "Motor Tremor Control: Successful grasp and participation with steady pacing"
    ];
    obs.forEach(ob => {
      doc.rect(M + 8, gy, 18, 18, "S");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(ob, M + 36, gy + 13);
      gy += 26;
    });

    drawLewyFooter(doc, residentName, lineWidth);
  }

  const cleanName = (residentName || "Resident").replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = ("Cognicopia_LewyBody_CST_" + cleanName + "_" + era + "_" + outputMode).replace(/_+/g, "_") + ".pdf";
  doc.save(fileName);
  return fileName;
}

function ailRenderLewy(ctx) {
  const d = ctx.doc, W = AIL_PAGE.W, H = AIL_PAGE.H, M = AIL_PAGE.M;
  const name = ctx.who || (typeof ailResidentName === "function" ? ailResidentName() : "") || "Resident";
  
  // Pick 6 clinical tasks from LEWY_ACTIVITIES
  const acts = LEWY_ACTIVITIES.slice(0, 6);

  acts.forEach((act, i) => {
    ailFreshPage(ctx);
    drawLewyHeader(d, name, "1950s", act.title, "DLB Activity " + (i + 1) + " of " + acts.length + "  ·  Bold High-Contrast", 8, i + 1, acts.length);
    renderLewyActivityContent(d, act, "1950s", "all", 8, 138);
    drawLewyFooter(d, name, 8);
  });
}
"""

content = content[:idx_rl1] + new_lewy_pdf_code + "\n\n" + content[idx_rl2:]
print("ailRenderLewy replaced and generateLewySpecializedPDF added.")

# -------------------------------------------------------------
# 6. ADD initLewyModule SCRIPT WIRING
# -------------------------------------------------------------
lewy_init_script = """
/* -----------------------------------------------------------------
   LEWY BODY DEMENTIA (DLB) SUITE WIRING: Submenu, Toggles, & Modal
   ----------------------------------------------------------------- */
function initLewyModule() {
  const caLewyBtn = document.getElementById("caLewy");
  const dlbSubmenu = document.getElementById("dlbSubmenu");
  const actList = document.getElementById("dlbActivityList");
  const filterPills = document.querySelectorAll(".dlb-filter-pill[data-filter]");
  const openModalBtn = document.getElementById("dlbOpenModalBtn");

  const modal = document.getElementById("dlbModal");
  const modalCloseBtn = document.getElementById("dlbModalCloseBtn");
  const modalCancelBtn = document.getElementById("dlbModalCancelBtn");
  const modalForm = document.getElementById("dlbModalForm");
  const resNameInput = document.getElementById("dlbResidentName");
  const eraSelect = document.getElementById("dlbFormativeEra");
  const modeSelect = document.getElementById("dlbModeSelect");
  const lineWidthSelect = document.getElementById("dlbLineWidthSelect");
  const actSelect = document.getElementById("dlbActivitySelect");
  const rationaleBox = document.getElementById("dlbRationaleText");
  const outputRadios = document.querySelectorAll("input[name=\\"dlbOutputMode\\"]");
  const outputLabels = {
    single: document.getElementById("dlbModeSingleLabel"),
    mini_packet: document.getElementById("dlbModeMiniLabel"),
    guide: document.getElementById("dlbModeGuideLabel")
  };

  if (!caLewyBtn || !dlbSubmenu || !modal) return;

  let currentModeFilter = "all";

  function populateActivities(filter) {
    if (!actList) return;
    actList.innerHTML = "";
    const filtered = LEWY_ACTIVITIES.filter(a => {
      if (filter === "all") return true;
      return a.mode === filter;
    });

    filtered.forEach(act => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "dlb-activity-card";
      card.setAttribute("data-act-id", act.id);

      let badgeClass = "dlb-badge-alert";
      if (act.mode === "fluctuating") badgeClass = "dlb-badge-fluct";
      if (act.mode === "calming") badgeClass = "dlb-badge-calm";

      card.innerHTML = `
        <span class="dlb-card-icon" aria-hidden="true">${act.icon}</span>
        <div class="dlb-card-content">
          <div class="dlb-card-title">${act.title}</div>
          <div class="dlb-card-meta">
            <span class="dlb-badge ${badgeClass}">${act.mode.toUpperCase()}</span>
            <span style="font-size: 7pt; color: #a8c7fa;">${act.shortTitle}</span>
          </div>
        </div>
      `;

      card.addEventListener("click", (e) => {
        e.stopPropagation();
        openLewyModal(act.id);
      });

      actList.appendChild(card);
    });
  }

  function populateSelect(filter) {
    if (!actSelect) return;
    actSelect.innerHTML = "";
    const filtered = LEWY_ACTIVITIES.filter(a => {
      if (filter === "all") return true;
      return a.mode === filter;
    });

    filtered.forEach(act => {
      const opt = document.createElement("option");
      opt.value = act.id;
      opt.textContent = act.icon + " " + act.title + " (" + act.mode.toUpperCase() + ")";
      actSelect.appendChild(opt);
    });
    updateRationale();
  }

  function updateRationale() {
    if (!actSelect || !rationaleBox) return;
    const selectedId = actSelect.value;
    const act = LEWY_ACTIVITIES.find(a => a.id === selectedId);
    if (act) {
      rationaleBox.innerHTML = `<strong>${act.visuospatialFocus}</strong><br>${act.rationale}`;
    }
  }

  filterPills.forEach(pill => {
    pill.addEventListener("click", (e) => {
      e.stopPropagation();
      filterPills.forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      currentModeFilter = pill.getAttribute("data-filter") || "all";
      populateActivities(currentModeFilter);
    });
  });

  // Toggle submenu when caLewy is clicked
  caLewyBtn.addEventListener("click", () => {
    const isExpanded = dlbSubmenu.classList.toggle("is-expanded");
    if (isExpanded) {
      populateActivities(currentModeFilter);
    }
  });

  function openLewyModal(preselectActId) {
    if (resNameInput) {
      const curName = (typeof ailResidentName === "function" ? ailResidentName() : "") || "";
      resNameInput.value = curName;
    }

    populateSelect(currentModeFilter);

    if (preselectActId && actSelect) {
      actSelect.value = preselectActId;
      updateRationale();
    }

    if (typeof modal.showModal === "function") {
      modal.showModal();
    } else {
      modal.setAttribute("open", "");
    }
  }

  if (openModalBtn) {
    openModalBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openLewyModal();
    });
  }

  if (modeSelect) {
    modeSelect.addEventListener("change", () => {
      const selMode = modeSelect.value;
      populateSelect(selMode);
    });
  }

  if (actSelect) {
    actSelect.addEventListener("change", updateRationale);
  }

  outputRadios.forEach(radio => {
    radio.addEventListener("change", () => {
      Object.keys(outputLabels).forEach(k => {
        if (outputLabels[k]) outputLabels[k].classList.remove("is-selected");
      });
      if (radio.checked && outputLabels[radio.value]) {
        outputLabels[radio.value].classList.add("is-selected");
      }
    });
  });

  function closeModal() {
    if (typeof modal.close === "function") {
      modal.close();
    } else {
      modal.removeAttribute("open");
    }
  }

  if (modalCloseBtn) modalCloseBtn.addEventListener("click", closeModal);
  if (modalCancelBtn) modalCancelBtn.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  modalForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const residentName = resNameInput ? resNameInput.value.trim() : "";
    const era = eraSelect ? eraSelect.value : "1950s";
    const mode = modeSelect ? modeSelect.value : "all";
    const lineWidth = lineWidthSelect ? lineWidthSelect.value : "8";
    const activityId = actSelect ? actSelect.value : "bold_coloring";
    let outputMode = "single";
    outputRadios.forEach(r => { if (r.checked) outputMode = r.value; });

    try {
      const file = generateLewySpecializedPDF({
        residentName,
        era,
        mode,
        lineWidth,
        activityId,
        outputMode
      });
      closeModal();
      const statusMsg = document.getElementById("ailmentStatusMsg");
      if (statusMsg) {
        statusMsg.textContent = "Generated & Downloaded: " + file;
        statusMsg.classList.add("is-visible");
      }
    } catch (err) {
      console.error(err);
      alert("Error generating DLB PDF: " + err.message);
    }
  });

  // Initial populate
  populateActivities("all");
}

document.addEventListener("DOMContentLoaded", initLewyModule);
if (document.readyState === "complete" || document.readyState === "interactive") {
  initLewyModule();
}
"""

init_anchor = "document.addEventListener(\"DOMContentLoaded\", initVascularModule);\nif (document.readyState === \"complete\" || document.readyState === \"interactive\") {\n  initVascularModule();\n}"
idx_init = content.find(init_anchor)
if idx_init != -1:
    content = content[:idx_init + len(init_anchor)] + "\n\n" + lewy_init_script + content[idx_init + len(init_anchor):]
    print("initLewyModule script attached successfully.")
else:
    print("Could not find init_anchor")
    exit(1)

with open("index.html", "w", encoding="utf-8") as f:
    f.write(content)
print("All DLB updates written to index.html successfully!")
