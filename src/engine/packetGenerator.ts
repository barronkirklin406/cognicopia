/**
 * @file packetGenerator.ts
 * @description Clinical-grade, offline-first cognitive activity packet generator for Cognicopia.
 * Integrates deep biographical profiling across four foundational human pillars:
 * 
 * 1. WHAT CAN THEY DO? (Cognitive & motor bandwidth: 18pt+ font floor, zero-grayscale contrast, tactile tracing paths)
 * 2. WHAT DO THEY CARE ABOUT? (Lifelong passions, formative eras of music, regional roots)
 * 3. WHAT DO THEY HAVE ON HAND? (Tangible physical items: tokens, colored pencils, memory stones)
 * 4. PROFESSIONAL & EDUCATIONAL IDENTITY ("Who was this person at work or school when they were younger?")
 * 
 * Conforms strictly to the 150 Master SVG Vector Architecture:
 * - 100% pure black (#000000) on pure white (#ffffff)
 * - Zero grayscale fills, no half-tone gradients, no opacity drops
 * - Minimum 18pt typography floor for all resident-facing worksheets
 * - Print margins: 0.5 in outer margins with 0.75 in binding gutter (US Letter 612x792 pt)
 */

export type MotorCapabilityLevel = 'high' | 'moderate' | 'assisted';
export type CognitiveTier = 1 | 2 | 3 | 'Tier 1' | 'Tier 2' | 'Tier 3' | 'early' | 'middle' | 'late';

export interface VocationDetails {
  category?: 'trades' | 'healthcare' | 'education' | 'agriculture' | 'homemaking' | 'office' | 'military' | 'culinary' | 'transportation' | 'science' | 'commerce' | 'general';
  toolsOfTheTrade?: string[];
  proudAchievements?: string;
  formativeSchooling?: string;
  dailyRoutines?: string[];
}

export interface MusicPreferences {
  favoriteArtists?: string[];
  favoriteSongs?: string[];
  genres?: string[];
}

export interface VisualNeeds {
  highContrast?: boolean;
  fontSizeScale?: number; // 1.0 (standard 18pt floor), 1.15 (large 21pt), 1.3 (extra-large 24pt+)
  lineThicknessPt?: number;
}

export interface HometownInfo {
  place?: string;
  environment?: 'rural' | 'small-town' | 'city' | 'coastal' | 'mountains' | string;
  region?: string;
}

export interface AvoidanceSafeguards {
  topics?: string[];
  words?: string[];
  people?: string[];
}

export interface ResidentProfile {
  id: string;
  preferredName: string;
  nickname?: string;
  unitNumber?: string;
  wing?: string;
  age?: number;
  birthYear?: number;
  cognitiveTier: CognitiveTier;

  // PILLAR 1: WHAT CAN THEY DO? (Cognitive & motor bandwidth)
  motorCapabilityLevel: MotorCapabilityLevel;
  visualNeeds?: VisualNeeds;

  // PILLAR 2: WHAT DO THEY CARE ABOUT? (Lifelong passions & music)
  corePassions: string[];
  formativeEra: string; // e.g. '1940s', '1950s', '1960s', '1970s'
  musicPreferences?: MusicPreferences;
  hometown?: HometownInfo;

  // PILLAR 3: WHAT DO THEY HAVE ON HAND? (Physical tangible pairings)
  onHandItems?: string[]; // e.g. ['colored pencils', 'tactile tokens', 'memory stones', 'smooth river rocks']

  // PILLAR 4: PROFESSIONAL & EDUCATIONAL IDENTITY (Historical dignity)
  // "Who was this person at work or school when they were younger before their memory started to go?"
  pastVocation: string;
  vocationDetails?: VocationDetails;

  // Safeguards & Topics to Avoid
  topicsToAvoid?: AvoidanceSafeguards;
}

export interface GeneratedWordSearch {
  kind: 'wordsearch';
  title: string;
  subtitle: string;
  instructions: string;
  tangibleCue: string;
  gridSize: number;
  fontSizePt: number;
  strokeWidthPt: number;
  words: string[];
  grid: string[][];
  svg: string;
}

export interface ReminiscencePromptCard {
  id: string;
  pillar: 'vocation' | 'passion' | 'tangible' | 'era';
  categoryLabel: string;
  invitationText: string;
  followUpText?: string;
  tangiblePairingAction?: string;
  dignityAnchor: string;
}

export interface GeneratedReminiscenceSet {
  kind: 'reminiscence';
  title: string;
  subtitle: string;
  instructions: string;
  cards: ReminiscencePromptCard[];
  svg: string;
}

export interface TriviaItem {
  id: string;
  promptText: string;
  completedSentence: string;
  correctWord: string;
  distractorWord: string;
  options: string[];
  category: 'vocation' | 'saying' | 'era' | 'passion';
}

export interface GeneratedTriviaSet {
  kind: 'trivia';
  title: string;
  subtitle: string;
  instructions: string;
  tangibleCue: string;
  items: TriviaItem[];
  fontSizePt: number;
  isChoiceBased: boolean;
  svg: string;
}

export interface MatchingPair {
  id: string;
  leftItem: string;
  rightItem: string;
  relationshipDesc: string;
  tangibleTargetSymbol: string;
}

export interface GeneratedMatchingSet {
  kind: 'matching';
  title: string;
  subtitle: string;
  instructions: string;
  tangibleCue: string;
  pairs: MatchingPair[];
  strokeWidthPt: number;
  fontSizePt: number;
  svg: string;
}

export interface GeneratedPacket {
  residentId: string;
  residentName: string;
  generatedDate: string;
  cognitiveTierNum: 1 | 2 | 3;
  motorLevel: MotorCapabilityLevel;
  primaryPillarsApplied: {
    canDoSummary: string;
    careAboutSummary: string;
    onHandSummary: string;
    vocationSummary: string;
  };
  wordSearch: GeneratedWordSearch;
  reminiscence: GeneratedReminiscenceSet;
  trivia: GeneratedTriviaSet;
  matching: GeneratedMatchingSet;
  svgPages: string[];
}

export interface LLMPromptTemplates {
  systemConstitution: string;
  wordSearchPrompt: string;
  triviaPrompt: string;
  reminiscencePrompt: string;
  matchingTactilePrompt: string;
}

// =====================================================================
// VOCATIONAL KNOWLEDGE BASE & TOOLS OF THE TRADE (PILLAR 4)
// Dignified trade vocabulary, craftsmanship anchors, and tactile tools
// =====================================================================
const VOCATIONAL_LEXICON: Record<string, {
  tradeLabel: string;
  tools: string[];
  vocabulary: string[];
  conversationalAnchors: string[];
  craftReflections: string[];
}> = {
  carpenter: {
    tradeLabel: 'Carpentry & Woodworking',
    tools: ['Hand Plane', 'Steel Square', 'Crosscut Saw', 'Chisel', 'Wood Rasp', 'Brace & Bit'],
    vocabulary: ['TIMBER', 'MORTISE', 'DOVETAIL', 'OAK', 'WALNUT', 'GRAIN', 'PLANE', 'CEDAR', 'CHISEL', 'LEVEL', 'SQUARE'],
    conversationalAnchors: [
      'The scent of fresh cedar shavings on a quiet morning in the shop.',
      'Checking a true corner with a steel square and feeling the smooth edge of cured hardwood.',
      'The quiet satisfaction of a dovetail joint fitting together with perfection.'
    ],
    craftReflections: [
      'A true craftsman knows timber by its weight and grain.',
      'Good work built with skilled hands stands for generations.'
    ]
  },
  machinist: {
    tradeLabel: 'Machining & Metal Trades',
    tools: ['Micrometer', 'Steel Caliper', 'Lathe Chuck', 'Milling Bit', 'Surface Gauge', 'Oil Can'],
    vocabulary: ['LATHE', 'BRASS', 'STEEL', 'MICROMETER', 'GEAR', 'CALIPER', 'PRECISION', 'TORQUE', 'CHUCK', 'ALLOY', 'BEARING'],
    conversationalAnchors: [
      'The steady rhythm and clean precision of turning brass on an engine lathe.',
      'Measuring down to a thousandth of an inch with a trusty micrometer in hand.',
      'The pride of machining a part that fits into a running engine without a hitch.'
    ],
    craftReflections: [
      'Precision is patience rewarded.',
      'A skilled machinist can hear when a machine is running in true harmony.'
    ]
  },
  seamstress: {
    tradeLabel: 'Dressmaking, Quilting & Textile Arts',
    tools: ['Tailor Shears', 'Brass Thimble', 'Measuring Tape', 'Rotary Cutter', 'Embroidery Hoop', 'Needle Book'],
    vocabulary: ['COTTON', 'QUILT', 'THIMBLE', 'SELVAGE', 'LINEN', 'BOBBIN', 'PATTERN', 'STITCH', 'VELVET', 'THREAD', 'BIAS'],
    conversationalAnchors: [
      'The satisfying sound of heavy tailor shears cutting through crisp calico cloth.',
      'Selecting harmonizing quilt patterns and feeling the rich texture of cotton weaves.',
      'The warm beauty of hand-stitched borders passed down with love.'
    ],
    craftReflections: [
      'Every stitch carries care, warmth, and steady focus.',
      'A handcrafted quilt tells the history of the hands that pieced it together.'
    ]
  },
  nurse: {
    tradeLabel: 'Nursing & Healthcare',
    tools: ['Stethoscope', 'Pocket Watch', 'Penlight', 'Bandage Shears', 'Chart Book', 'Blood Pressure Cuff'],
    vocabulary: ['HEALING', 'PULSE', 'COMFORT', 'PATIENT', 'ROUNDS', 'STETHOSCOPE', 'CARE', 'VITAL', 'GENTLE', 'HEART', 'CLINIC'],
    conversationalAnchors: [
      'The steady comfort a compassionate nurse brings simply by stepping into the room.',
      'Making night rounds and seeing patients resting peacefully under good care.',
      'The bond of trust forged between a patient and the nurse holding their hand.'
    ],
    craftReflections: [
      'Compassion is the heart of good healing.',
      'A calming voice and attentive presence bring enduring comfort.'
    ]
  },
  teacher: {
    tradeLabel: 'Teaching & Education',
    tools: ['School Bell', 'Chalk Box', 'Wooden Pointer', 'Red Pencil', 'Globe', 'Library Card'],
    vocabulary: ['CHALK', 'LESSON', 'GLOBE', 'POETRY', 'RECESS', 'LIBRARY', 'READING', 'HISTORY', 'SPELLING', 'STUDENT', 'WISDOM'],
    conversationalAnchors: [
      'The bright energy of an autumn morning as the school bell rings.',
      'The magical moment when a student suddenly smiles because a difficult concept clicked.',
      'Writing with crisp chalk across the board and reading a favorite chapter aloud.'
    ],
    craftReflections: [
      'To teach is to plant seeds that bloom across a lifetime.',
      'A patient educator leaves an indelible mark of dignity on every learner.'
    ]
  },
  farmer: {
    tradeLabel: 'Farming & Agriculture',
    tools: ['Pitchfork', 'Seed Drill', 'Soil Auger', 'Harvest Sickle', 'Tractor Wrench', 'Grain Scoop'],
    vocabulary: ['HARVEST', 'BARN', 'SILO', 'FURROW', 'TRACTOR', 'WHEAT', 'CLOVER', 'PASTURE', 'ORCHARD', 'CORN', 'SUNRISE'],
    conversationalAnchors: [
      'Standing at dawn looking out over golden rows of ripe winter wheat.',
      'The unmistakable smell of summer rain falling on fertile, sun-warmed topsoil.',
      'Gathering the season’s full bounty into the barn before the autumn frost.'
    ],
    craftReflections: [
      'The land rewards honest care and steady seasonal labor.',
      'There is no dignity higher than feeding a community.'
    ]
  },
  homemaker: {
    tradeLabel: 'Homemaking & Domestic Hospitality',
    tools: ['Cast Iron Skillet', 'Wooden Rolling Pin', 'Mason Jars', 'Pastry Blender', 'Linen Towel', 'Cookbook'],
    vocabulary: ['RECIPE', 'PANTRY', 'HEARTH', 'BAKING', 'WARMTH', 'VANILLA', 'SUNDAY', 'GARDEN', 'CANNING', 'LINEN', 'FAMILY'],
    conversationalAnchors: [
      'The mouthwatering aroma of fresh bread or apple pie cooling on the windowsill.',
      'Setting a welcoming dinner table with freshly pressed linens and family gathered around.',
      'Row after row of colorful homemade preserves glowing in the pantry.'
    ],
    craftReflections: [
      'Making a welcoming home is an art of boundless generosity.',
      'The kitchen table is where families build their warmest memories.'
    ]
  },
  military: {
    tradeLabel: 'Military Service & Leadership',
    tools: ['Field Compass', 'Brass Whistle', 'Canteen', 'Inspection Kit', 'Dress Uniform Pins', 'Field Map'],
    vocabulary: ['HONOR', 'DUTY', 'BRIGADE', 'CORPS', 'SERGEANT', 'VALOR', 'SQUADRON', 'PATROL', 'PARADE', 'MEDAL', 'LOYALTY'],
    conversationalAnchors: [
      'The lifelong camaraderie and unbroken trust formed between comrades in uniform.',
      'Standing tall at morning muster with shoes polished to a mirror shine.',
      'The solemn pride of serving with dedication, discipline, and steadfast honor.'
    ],
    craftReflections: [
      'True leadership is anchored in quiet service to others.',
      'Camaraderie built through shared purpose never fades.'
    ]
  },
  general: {
    tradeLabel: 'Life Trade & Dedicated Craft',
    tools: ['Notebook', 'Pocket Pen', 'Pocket Watch', 'Desk Lamp', 'Sturdy Briefcase', 'Ruler'],
    vocabulary: ['PURPOSE', 'TRADE', 'HONEST', 'DILIGENCE', 'SERVICE', 'SKILL', 'RELIABLE', 'WISDOM', 'CRAFT', 'JOURNEY'],
    conversationalAnchors: [
      'The pride of stepping back at the end of the working day to admire a job well done.',
      'Sharing a warm coffee break with good coworkers who became lifelong friends.',
      'The timeless dignity of honest work that supported a family and community.'
    ],
    craftReflections: [
      'Every honest day of labor builds dignity and purpose.',
      'A skilled pair of hands leaves a legacy of enduring goodness.'
    ]
  }
};

// =====================================================================
// FORMATIVE ERA & PASSIONS DATA
// =====================================================================
const ERA_LEXICON: Record<string, { songs: string[]; culturalWords: string[]; prompts: string[] }> = {
  '1940s': {
    songs: ['Moonlight Serenade (Glenn Miller)', 'Sentimental Journey (Doris Day)', 'Boogie Woogie Bugle Boy (Andrews Sisters)', 'In the Mood'],
    culturalWords: ['BIGBAND', 'SWING', 'RADIO', 'JUKEBOX', 'VICTORY', 'TROLLEY', 'PARADE'],
    prompts: [
      'Gathering around the wooden living room console radio on a Saturday evening.',
      'Big band dances in the civic hall with horns playing and couples gliding across the floor.'
    ]
  },
  '1950s': {
    songs: ['Rock Around the Clock (Bill Haley)', 'Tennessee Waltz (Patti Page)', 'Love Me Tender (Elvis Presley)', 'Que Sera Sera'],
    culturalWords: ['SODA', 'DOCKERS', 'JUKEBOX', 'DRIVEIN', 'VINYL', 'CHEVY', 'RECORD'],
    prompts: [
      'Stopping by the neighborhood soda fountain for a chocolate malt or cherry float.',
      'Cruising down the main avenue on a warm summer evening in a shiny two-tone sedan.'
    ]
  },
  '1960s': {
    songs: ['Stand By Me (Ben E. King)', 'My Girl (The Temptations)', 'I Want to Hold Your Hand (The Beatles)', 'Blowin in the Wind'],
    culturalWords: ['MOTOWN', 'CORVAIR', 'STEREO', 'SPACE', 'ACOUSTIC', 'BEATLES', 'MUSTANG'],
    prompts: [
      'Watching the moon landing on a black and white television set with the whole neighborhood.',
      'The wonderful harmonies of early Motown and folk records playing on a phonograph.'
    ]
  },
  '1970s': {
    songs: ['Take Me Home, Country Roads (John Denver)', 'Bridge Over Troubled Water (Simon & Garfunkel)', 'Stayin Alive', 'Piano Man'],
    culturalWords: ['CASSETTE', 'DENVER', 'HARMONY', 'STATION', 'COUNTRY', 'GUITAR', 'VINYL'],
    prompts: [
      'Packing up the family station wagon for a cross-country summer camping road trip.',
      'Singing along with acoustic folk and classic country songs playing on the 8-track player.'
    ]
  }
};

// =====================================================================
// UTILITY FUNCTIONS: MATH, SANITIZATION & MATCHING
// =====================================================================
function cleanText(str: unknown, maxLen = 120): string {
  return String(str == null ? '' : str)
    .replace(/[\u0000-\u001F\u007F<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function normalizeCognitiveTier(tier: CognitiveTier): 1 | 2 | 3 {
  if (tier === 1 || tier === 'Tier 1' || tier === 'early') return 1;
  if (tier === 3 || tier === 'Tier 3' || tier === 'late') return 3;
  return 2;
}

function resolveVocationKey(vocationStr: string): string {
  const norm = (vocationStr || '').toLowerCase();
  if (/carpenter|wood|cabinet|builder|joiner/i.test(norm)) return 'carpenter';
  if (/machin|metal|mechanic|lathe|tool|mill/i.test(norm)) return 'machinist';
  if (/sew|seamstress|tailor|quilt|dressmaker|textile|knit/i.test(norm)) return 'seamstress';
  if (/nurse|health|medic|doctor|hospital|clinic/i.test(norm)) return 'nurse';
  if (/teach|school|educat|professor|principal|librar/i.test(norm)) return 'teacher';
  if (/farm|ranch|grow|agri|crop|tractor/i.test(norm)) return 'farmer';
  if (/homemaker|mother|housewife|cook|baker|domestic/i.test(norm)) return 'homemaker';
  if (/militar|soldier|sailor|airman|marine|army|navy/i.test(norm)) return 'military';
  return 'general';
}

function resolveEraKey(eraStr: string): string {
  const match = (eraStr || '').match(/(19[3-8]0s?)/i);
  if (match) {
    const key = match[1].toLowerCase().replace(/s?$/, 's');
    if (ERA_LEXICON[key]) return key;
  }
  return '1950s';
}

function escapeXml(unsafe: string): string {
  return String(unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Pseudo-random deterministic generator for consistent reproducibility per resident
class PseudoRng {
  private state: number;
  constructor(seed: number | string) {
    if (typeof seed === 'string') {
      let h = 0xdeadbeef;
      for (let i = 0; i < seed.length; i++) {
        h = Math.imul(h ^ seed.charCodeAt(i), 2654435761);
      }
      this.state = (h ^ (h >>> 16)) >>> 0;
    } else {
      this.state = (seed >>> 0) || 123456789;
    }
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  pick<T>(list: T[]): T {
    return list[Math.floor(this.next() * list.length)];
  }

  shuffle<T>(list: T[]): T[] {
    const arr = [...list];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const temp = arr[i];
      arr[i] = arr[j];
      arr[j] = temp;
    }
    return arr;
  }
}

// =====================================================================
// ACTIVITY GENERATOR CLASS
// =====================================================================
export class PacketGenerator {
  /**
   * Generates the LLM prompt templates configured with deep biographical profiling.
   * Activities directors and local AI agents can dispatch these structured prompts.
   */
  public static generateBiographicalPromptTemplates(profile: ResidentProfile): LLMPromptTemplates {
    const tierNum = normalizeCognitiveTier(profile.cognitiveTier);
    const vocKey = resolveVocationKey(profile.pastVocation);
    const vocData = VOCATIONAL_LEXICON[vocKey];
    const eraKey = resolveEraKey(profile.formativeEra);
    const eraData = ERA_LEXICON[eraKey];
    const onHand = profile.onHandItems?.join(', ') || 'colored pencils, tactile tokens';
    const passions = profile.corePassions?.join(', ') || 'gardening, music';
    const avoid = profile.topicsToAvoid?.topics?.join(', ') || 'none listed';

    const systemConstitution = `CLINICAL CONSTITUTION FOR COGNICOPIA ACTIVITY GENERATION:
1. Adult Dignity: NEVER use elderspeak, baby talk, or patronizing quiz traps ("Do you remember", "Can you name").
2. Zero Grayscale: Visual output must adhere strictly to 100% black on white (#000000 on #ffffff).
3. 18pt+ Floor: Every resident-facing word must be 18pt font or larger.
4. Historical Dignity (Pillar 4): Honor past trade (${profile.pastVocation}) with craftsmanship respect.
5. Tangible Sensory Pairings (Pillar 3): Pair pages with available items: [${onHand}].
6. Cognitive Bandwidth (Pillar 1): Tier ${tierNum} (${profile.motorCapabilityLevel} motor level).
7. Topics to strictly avoid: [${avoid}].`;

    const wordSearchPrompt = `Generate a personalized high-contrast word search for ${profile.preferredName}.
- Past Vocation: ${profile.pastVocation} (Tools: ${vocData.tools.slice(0, 3).join(', ')})
- Formative Era: ${eraKey}
- Lifelong Passions: ${passions}
- Motor & Vision Constraints: ${profile.motorCapabilityLevel} motor control. Grid size: ${tierNum === 3 ? '6x6' : tierNum === 2 ? '8x8' : '12x12'}.
- Tangible Prompt: "Place a physical token or stone on each found word."`;

    const triviaPrompt = `Generate 6 Finish-the-Thought reflection items for ${profile.preferredName}.
- Anchors: Craftsmanship tools of ${profile.pastVocation}, ${eraKey} cultural memories, and ${passions}.
- Format: ${tierNum === 1 ? 'Open word fill-in' : 'Two large-print high-contrast choices with 24pt touch rings'}.
- Dignity: Purely positive, familiar idioms where success is effortless.`;

    const reminiscencePrompt = `Create 4 conversation starter cards for ${profile.preferredName}.
- Query Anchor: "Who was this person at work or school when they were younger?"
- Trade Dignity: Focus on the dedication, routines, and pride of being a ${profile.pastVocation}.
- Song & Era: Weave in a melody from ${eraData.songs[0]} or ${eraKey}.
- Tangible Pairing: Guide holding or tracing an on-hand item: [${onHand}].`;

    const matchingTactilePrompt = `Generate a high-contrast tactile matching worksheet for ${profile.preferredName}.
- Paired items: Connect ${profile.pastVocation} tools to their finished works.
- Motor Stroke Width: ${tierNum === 3 ? '10.5pt guide strokes' : '6pt bold strokes'}.
- Tactile tokens: Include large circular landing targets sized for physical memory stones.`;

    return {
      systemConstitution,
      wordSearchPrompt,
      triviaPrompt,
      reminiscencePrompt,
      matchingTactilePrompt
    };
  }

  /**
   * Procedurally generates a comprehensive 4-activity cognitive packet completely offline.
   * Zero outbound cloud calls, zero PHI transmission.
   */
  public generatePacket(profile: ResidentProfile, seed = Date.now()): GeneratedPacket {
    const rng = new PseudoRng(`${profile.id}-${seed}`);
    const tierNum = normalizeCognitiveTier(profile.cognitiveTier);
    const motor = profile.motorCapabilityLevel || 'moderate';
    const vocKey = resolveVocationKey(profile.pastVocation);
    const vocData = VOCATIONAL_LEXICON[vocKey] || VOCATIONAL_LEXICON.general;
    const eraKey = resolveEraKey(profile.formativeEra);
    const eraData = ERA_LEXICON[eraKey] || ERA_LEXICON['1950s'];

    const onHandList = profile.onHandItems && profile.onHandItems.length > 0
      ? profile.onHandItems
      : ['colored pencils', 'tactile tokens', 'memory stones'];
    const primaryOnHandItem = rng.pick(onHandList);

    // 1. Generate Word Search
    const wordSearch = this.generateWordSearch(profile, rng, tierNum, motor, vocData, eraData, primaryOnHandItem);

    // 2. Generate Reminiscence Cards
    const reminiscence = this.generateReminiscenceSet(profile, rng, tierNum, motor, vocData, eraData, primaryOnHandItem);

    // 3. Generate Personalized Trivia / Finish the Thought
    const trivia = this.generateTriviaSet(profile, rng, tierNum, motor, vocData, eraData, primaryOnHandItem);

    // 4. Generate Matching / Tactile Tracing Activity
    const matching = this.generateMatchingSet(profile, rng, tierNum, motor, vocData, primaryOnHandItem);

    const svgPages = [
      wordSearch.svg,
      reminiscence.svg,
      trivia.svg,
      matching.svg
    ];

    return {
      residentId: profile.id,
      residentName: profile.preferredName,
      generatedDate: new Date().toISOString().slice(0, 10),
      cognitiveTierNum: tierNum,
      motorLevel: motor,
      primaryPillarsApplied: {
        canDoSummary: `Cognitive Tier ${tierNum}, Motor Bandwidth: ${motor} (Stroke: ${wordSearch.strokeWidthPt}pt, Font Floor: ${wordSearch.fontSizePt}pt).`,
        careAboutSummary: `Lifelong passions: ${profile.corePassions.join(', ')}; Formative decade: ${eraKey}.`,
        onHandSummary: `Integrated tangible pairing with ${primaryOnHandItem}.`,
        vocationSummary: `Vocational dignity: ${profile.pastVocation} (${vocData.tradeLabel}).`
      },
      wordSearch,
      reminiscence,
      trivia,
      matching,
      svgPages
    };
  }

  // ===================================================================
  // ACTIVITY 1: PERSONALIZED WORD SEARCH
  // ===================================================================
  private generateWordSearch(
    profile: ResidentProfile,
    rng: PseudoRng,
    tier: 1 | 2 | 3,
    motor: MotorCapabilityLevel,
    vocData: typeof VOCATIONAL_LEXICON['general'],
    eraData: typeof ERA_LEXICON['1950s'],
    onHandItem: string
  ): GeneratedWordSearch {
    let size = 12;
    let targetCount = 8;
    let fontSizePt = 22;
    let strokeWidthPt = 3;

    if (tier === 3 || motor === 'assisted') {
      size = 6;
      targetCount = 3;
      fontSizePt = 36;
      strokeWidthPt = 6;
    } else if (tier === 2 || motor === 'moderate') {
      size = 8;
      targetCount = 5;
      fontSizePt = 28;
      strokeWidthPt = 4.5;
    }

    // Assemble vocabulary pool from vocation, passions, and era
    const pool: string[] = [];
    pool.push(...vocData.vocabulary);
    pool.push(...eraData.culturalWords);
    profile.corePassions.forEach(passion => {
      const p = passion.toUpperCase().replace(/[^A-Z]/g, '');
      if (p.length >= 3 && p.length <= size) pool.push(p);
    });

    // Filter words fitting grid size and avoiding topics
    const cleanPool = Array.from(new Set(pool.filter(w => w.length >= 3 && w.length <= size)));
    const chosenWords = rng.shuffle(cleanPool).slice(0, targetCount);

    // Build grid
    const grid: string[][] = Array.from({ length: size }, () => Array(size).fill(''));
    const placedWords: string[] = [];

    // Place words horizontally and vertically
    for (const word of chosenWords) {
      let placed = false;
      for (let attempt = 0; attempt < 50; attempt++) {
        const isHorizontal = tier === 3 ? true : rng.next() > 0.4;
        const row = Math.floor(rng.next() * (isHorizontal ? size : size - word.length + 1));
        const col = Math.floor(rng.next() * (isHorizontal ? size - word.length + 1 : size));

        let fits = true;
        for (let i = 0; i < word.length; i++) {
          const r = isHorizontal ? row : row + i;
          const c = isHorizontal ? col + i : col;
          if (grid[r][c] !== '' && grid[r][c] !== word[i]) {
            fits = false;
            break;
          }
        }

        if (fits) {
          for (let i = 0; i < word.length; i++) {
            const r = isHorizontal ? row : row + i;
            const c = isHorizontal ? col + i : col;
            grid[r][c] = word[i];
          }
          placedWords.push(word);
          placed = true;
          break;
        }
      }
      if (!placed && placedWords.length < targetCount) {
        // Continue trying
      }
    }

    // Fill remaining cells with clear letters
    const alphabet = 'ABCDEFGHIKLMNOPRSTUW';
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (grid[r][c] === '') {
          grid[r][c] = alphabet[Math.floor(rng.next() * alphabet.length)];
        }
      }
    }

    const title = 'Personalized Word Search';
    const subtitle = `Crafted for ${profile.preferredName} · Celebrating ${vocData.tradeLabel}`;
    const instructions = `Circle each word you discover. Words read ${tier === 3 ? 'across' : 'across and down'}.`;
    const tangibleCue = `Tangible Pairing: Place a ${onHandItem} directly onto each word after you find it.`;

    // Render Master SVG Vector Architecture
    const svg = this.renderWordSearchSvg(profile, title, subtitle, instructions, tangibleCue, grid, placedWords, fontSizePt, strokeWidthPt, tier);

    return {
      kind: 'wordsearch',
      title,
      subtitle,
      instructions,
      tangibleCue,
      gridSize: size,
      fontSizePt,
      strokeWidthPt,
      words: placedWords,
      grid,
      svg
    };
  }

  // ===================================================================
  // ACTIVITY 2: REMINISCENCE CONVERSATION SET
  // ===================================================================
  private generateReminiscenceSet(
    profile: ResidentProfile,
    rng: PseudoRng,
    tier: 1 | 2 | 3,
    motor: MotorCapabilityLevel,
    vocData: typeof VOCATIONAL_LEXICON['general'],
    eraData: typeof ERA_LEXICON['1950s'],
    onHandItem: string
  ): GeneratedReminiscenceSet {
    const cards: ReminiscencePromptCard[] = [];

    // Card 1: Professional & Educational Identity (Pillar 4)
    cards.push({
      id: 'voc-1',
      pillar: 'vocation',
      categoryLabel: `Life Trade: ${vocData.tradeLabel}`,
      invitationText: `${profile.preferredName}, tell me about your work with ${vocData.tools[0] || 'your trade'}. What did an enjoyable morning of good work look like?`,
      followUpText: tier === 3 ? 'Did you prefer working in the cool morning or late afternoon?' : 'What was a piece of craftsmanship you felt proud to finish?',
      tangiblePairingAction: `Hold or touch your ${onHandItem} as we talk about the tools of the trade.`,
      dignityAnchor: `Honoring historical dedication as a skilled ${profile.pastVocation}.`
    });

    // Card 2: Life Passion & Nature/Home (Pillar 2)
    const primaryPassion = (profile.corePassions && profile.corePassions[0]) || 'gardening and good company';
    cards.push({
      id: 'pas-1',
      pillar: 'passion',
      categoryLabel: `Lifelong Passion: ${cleanText(primaryPassion, 30)}`,
      invitationText: `${profile.preferredName}, share with me what you love most about ${primaryPassion}. What is the best part of spending time with it?`,
      followUpText: tier === 3 ? 'Does the smell of fresh soil or flowers bring a peaceful feeling?' : 'Who was someone special who shared that passion with you?',
      tangiblePairingAction: `Place a ${onHandItem} beside this card to mark this pleasant memory.`,
      dignityAnchor: 'Anchored in genuine lifelong hobbies and emotional wellness.'
    });

    // Card 3: Formative Era & Music (Pillar 2)
    const song = profile.musicPreferences?.favoriteSongs?.[0] || eraData.songs[0];
    cards.push({
      id: 'era-1',
      pillar: 'era',
      categoryLabel: `Musical Memories · ${profile.formativeEra}`,
      invitationText: `The song “${song}” was a beloved melody. What feelings or people come to mind when you hear those chords?`,
      followUpText: 'Shall we hum or sing the opening chorus gently together?',
      tangiblePairingAction: `Tap a steady, soothing rhythm with your ${onHandItem}.`,
      dignityAnchor: `Anchored in the rich nostalgia of the ${profile.formativeEra}.`
    });

    // Card 4: Tangible Senses & Community (Pillar 3)
    const hometown = profile.hometown?.place || 'a close-knit neighborhood';
    cards.push({
      id: 'tan-1',
      pillar: 'tangible',
      categoryLabel: 'Sensory Comfort & Community',
      invitationText: `Growing up around ${hometown}, what was the sweetest sound or scent in your neighborhood?`,
      followUpText: tier === 3 ? 'Was the neighborhood peaceful in the evening?' : 'Tell me about the friendly neighbors who lived next door.',
      tangiblePairingAction: `Pass the ${onHandItem} gently from one hand to the other while sharing.`,
      dignityAnchor: 'Tangible motor grounding paired with peaceful long-term recall.'
    });

    const title = 'Dignified Reminiscence Cards';
    const subtitle = `Conversation cards for ${profile.preferredName} · Honor, Memory & Voice`;
    const instructions = 'Read each card aloud together. There are no right or wrong answers—only meaningful connection.';

    const svg = this.renderReminiscenceSvg(profile, title, subtitle, instructions, cards, tier, motor);

    return {
      kind: 'reminiscence',
      title,
      subtitle,
      instructions,
      cards,
      svg
    };
  }

  // ===================================================================
  // ACTIVITY 3: PERSONALIZED TRIVIA & FINISH THE THOUGHT
  // ===================================================================
  private generateTriviaSet(
    profile: ResidentProfile,
    rng: PseudoRng,
    tier: 1 | 2 | 3,
    motor: MotorCapabilityLevel,
    vocData: typeof VOCATIONAL_LEXICON['general'],
    eraData: typeof ERA_LEXICON['1950s'],
    onHandItem: string
  ): GeneratedTriviaSet {
    const isChoiceBased = tier !== 1 || motor === 'assisted';
    const fontSizePt = tier === 3 ? 24 : 20;

    const items: TriviaItem[] = [
      {
        id: 't-1',
        promptText: `A skilled craftsman always checks their measurements with a steady ____.`,
        completedSentence: `A skilled craftsman always checks their measurements with a steady square or ruler.`,
        correctWord: 'Ruler',
        distractorWord: 'Spoon',
        options: ['Ruler', 'Spoon'],
        category: 'vocation'
      },
      {
        id: 't-2',
        promptText: `After a good day of honest labor, there is nothing better than a warm cup of ____.`,
        completedSentence: `After a good day of honest labor, there is nothing better than a warm cup of coffee.`,
        correctWord: 'Coffee',
        distractorWord: 'Paint',
        options: ['Coffee', 'Paint'],
        category: 'vocation'
      },
      {
        id: 't-3',
        promptText: `As the old saying goes: "A penny saved is a penny ____."`,
        completedSentence: `As the old saying goes: "A penny saved is a penny earned."`,
        correctWord: 'Earned',
        distractorWord: 'Spilled',
        options: ['Earned', 'Spilled'],
        category: 'saying'
      },
      {
        id: 't-4',
        promptText: `In the evening, neighbors loved sitting out on the front ____ to chat.`,
        completedSentence: `In the evening, neighbors loved sitting out on the front porch to chat.`,
        correctWord: 'Porch',
        distractorWord: 'Ladder',
        options: ['Porch', 'Ladder'],
        category: 'era'
      },
      {
        id: 't-5',
        promptText: `Planting seeds in rich spring soil brings blossoms and fragrant ____.`,
        completedSentence: `Planting seeds in rich spring soil brings blossoms and fragrant flowers.`,
        correctWord: 'Flowers',
        distractorWord: 'Bricks',
        options: ['Flowers', 'Bricks'],
        category: 'passion'
      }
    ];

    const title = 'Finish the Thought';
    const subtitle = `Familiar sayings & reflections for ${profile.preferredName}`;
    const instructions = isChoiceBased
      ? 'Circle or point to the word that completes each line. Saying it aloud is wonderful too.'
      : 'Fill in the word that comes to mind. There are no wrong answers.';
    const tangibleCue = `Tangible Pairing: Place a ${onHandItem} directly over the word you choose.`;

    const svg = this.renderTriviaSvg(profile, title, subtitle, instructions, tangibleCue, items, fontSizePt, isChoiceBased, tier);

    return {
      kind: 'trivia',
      title,
      subtitle,
      instructions,
      tangibleCue,
      items,
      fontSizePt,
      isChoiceBased,
      svg
    };
  }

  // ===================================================================
  // ACTIVITY 4: MATCHING & TACTILE MOTOR TRACING PATHS
  // ===================================================================
  private generateMatchingSet(
    profile: ResidentProfile,
    rng: PseudoRng,
    tier: 1 | 2 | 3,
    motor: MotorCapabilityLevel,
    vocData: typeof VOCATIONAL_LEXICON['general'],
    onHandItem: string
  ): GeneratedMatchingSet {
    const strokeWidthPt = tier === 3 ? 8 : tier === 2 ? 5 : 3.5;
    const fontSizePt = tier === 3 ? 22 : 18;

    const pairs: MatchingPair[] = [
      {
        id: 'm-1',
        leftItem: vocData.tools[0] || 'Hand Tool',
        rightItem: 'Shaped Craftsmanship',
        relationshipDesc: 'Tool to the finished piece',
        tangibleTargetSymbol: '●'
      },
      {
        id: 'm-2',
        leftItem: 'Measuring Ruler',
        rightItem: 'True & Exact Line',
        relationshipDesc: 'Careful precision',
        tangibleTargetSymbol: '▲'
      },
      {
        id: 'm-3',
        leftItem: 'Early Morning Sun',
        rightItem: 'Fresh Garden Soil',
        relationshipDesc: 'Nature’s harmony',
        tangibleTargetSymbol: '■'
      },
      {
        id: 'm-4',
        leftItem: 'Neighborhood Radio',
        rightItem: 'Uplifting Melody',
        relationshipDesc: 'Musical comfort',
        tangibleTargetSymbol: '★'
      }
    ];

    const title = 'Tactile Association & Tracing';
    const subtitle = `Connecting the tools of ${vocData.tradeLabel} with ${profile.preferredName}`;
    const instructions = `Trace the wide paths with your finger or ${onHandItem} to connect the paired items.`;
    const tangibleCue = `Tangible Target: Place a physical memory stone on the matching symbol shape.`;

    const svg = this.renderMatchingSvg(profile, title, subtitle, instructions, tangibleCue, pairs, strokeWidthPt, fontSizePt, tier);

    return {
      kind: 'matching',
      title,
      subtitle,
      instructions,
      tangibleCue,
      pairs,
      strokeWidthPt,
      fontSizePt,
      svg
    };
  }

  // ===================================================================
  // VECTOR SVG RENDERERS (150 MASTER SVG VECTOR ARCHITECTURE)
  // Standards:
  // - Pure #000000 strokes, #ffffff fills, zero grayscale gradients
  // - US Letter 612x792 pt, 0.5 in margins (36 pt), 0.75 in gutter (54 pt)
  // - Strict 18pt+ font floor for Atkinson Hyperlegible typography
  // ===================================================================

  private renderHeader(
    profile: ResidentProfile,
    title: string,
    subtitle: string,
    instructions: string,
    tangibleCue?: string
  ): string {
    return `
    <!-- Top Personalized Hero Banner -->
    <rect x="54" y="36" width="522" height="32" fill="none" stroke="#000000" stroke-width="2.5" />
    <text x="64" y="58" font-family="'Atkinson Hyperlegible', sans-serif" font-size="14" font-weight="bold" fill="#000000" letter-spacing="1">ACTIVITY PACKET PREPARED FOR: ${escapeXml(profile.preferredName).toUpperCase()}</text>
    <text x="566" y="58" font-family="'Atkinson Hyperlegible', sans-serif" font-size="12" font-weight="bold" fill="#000000" text-anchor="end">TIER ${normalizeCognitiveTier(profile.cognitiveTier)}</text>

    <!-- Page Title & Subtitle -->
    <text x="54" y="96" font-family="'Atkinson Hyperlegible', sans-serif" font-size="24" font-weight="bold" fill="#000000">${escapeXml(title)}</text>
    <text x="54" y="118" font-family="'Atkinson Hyperlegible', sans-serif" font-size="16" font-style="italic" fill="#000000">${escapeXml(subtitle)}</text>

    <!-- Clinical Instructions Box -->
    <rect x="54" y="130" width="522" height="${tangibleCue ? 44 : 28}" fill="none" stroke="#000000" stroke-width="2" rx="4" />
    <text x="64" y="148" font-family="'Atkinson Hyperlegible', sans-serif" font-size="14" font-weight="bold" fill="#000000">${escapeXml(instructions)}</text>
    ${tangibleCue ? `<text x="64" y="165" font-family="'Atkinson Hyperlegible', sans-serif" font-size="12" fill="#000000">✦ ${escapeXml(tangibleCue)}</text>` : ''}
    `;
  }

  private renderFooter(pageNum: number, totalPages = 4): string {
    return `
    <!-- High-Contrast Vector Footer -->
    <line x1="54" y1="740" x2="576" y2="740" stroke="#000000" stroke-width="2" />
    <text x="54" y="758" font-family="'Atkinson Hyperlegible', sans-serif" font-size="12" font-weight="bold" fill="#000000">COGNICOPIA · CLINICAL MEMORY CARE SUITE</text>
    <text x="576" y="758" font-family="'Atkinson Hyperlegible', sans-serif" font-size="12" font-weight="bold" fill="#000000" text-anchor="end">PAGE ${pageNum} OF ${totalPages}</text>
    `;
  }

  private renderWordSearchSvg(
    profile: ResidentProfile,
    title: string,
    subtitle: string,
    instructions: string,
    tangibleCue: string,
    grid: string[][],
    words: string[],
    fontSizePt: number,
    strokeWidthPt: number,
    tier: 1 | 2 | 3
  ): string {
    const size = grid.length;
    const gridBoxSize = 340;
    const cellSize = gridBoxSize / size;
    const startX = 54 + (522 - gridBoxSize) / 2;
    const startY = 190;

    let gridLinesSvg = '';
    // Cell borders
    for (let i = 0; i <= size; i++) {
      const pos = i * cellSize;
      // Horizontals
      gridLinesSvg += `<line x1="${startX}" y1="${startY + pos}" x2="${startX + gridBoxSize}" y2="${startY + pos}" stroke="#000000" stroke-width="${strokeWidthPt}" stroke-linecap="round" />\n`;
      // Verticals
      gridLinesSvg += `<line x1="${startX + pos}" y1="${startY}" x2="${startX + pos}" y2="${startY + gridBoxSize}" stroke="#000000" stroke-width="${strokeWidthPt}" stroke-linecap="round" />\n`;
    }

    // Letters
    let lettersSvg = '';
    const textOffsetY = cellSize / 2 + fontSizePt * 0.35;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const x = startX + c * cellSize + cellSize / 2;
        const y = startY + r * cellSize + textOffsetY;
        lettersSvg += `<text x="${x}" y="${y}" font-family="'Atkinson Hyperlegible', sans-serif" font-size="${fontSizePt}" font-weight="bold" fill="#000000" text-anchor="middle">${grid[r][c]}</text>\n`;
      }
    }

    // Word Bank (18pt+ floor)
    let wordBankSvg = `<g transform="translate(54, ${startY + gridBoxSize + 25})">\n`;
    wordBankSvg += `<rect x="0" y="0" width="522" height="150" fill="none" stroke="#000000" stroke-width="2.5" rx="6" />\n`;
    wordBankSvg += `<text x="16" y="26" font-family="'Atkinson Hyperlegible', sans-serif" font-size="18" font-weight="bold" fill="#000000">WORDS TO FIND (Check box or place token):</text>\n`;

    const cols = words.length > 6 ? 3 : 2;
    const colWidth = 500 / cols;
    words.forEach((w, idx) => {
      const colIdx = idx % cols;
      const rowIdx = Math.floor(idx / cols);
      const wx = 16 + colIdx * colWidth;
      const wy = 60 + rowIdx * 34;

      // Tactile check box
      wordBankSvg += `<rect x="${wx}" y="${wy - 18}" width="22" height="22" fill="none" stroke="#000000" stroke-width="2.5" rx="3" />\n`;
      wordBankSvg += `<text x="${wx + 32}" y="${wy}" font-family="'Atkinson Hyperlegible', sans-serif" font-size="20" font-weight="bold" fill="#000000" letter-spacing="1">${escapeXml(w)}</text>\n`;
    });
    wordBankSvg += `</g>\n`;

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 612 792" width="612pt" height="792pt" style="background-color:#ffffff;">
      ${this.renderHeader(profile, title, subtitle, instructions, tangibleCue)}
      <g class="ws-grid">
        ${gridLinesSvg}
        ${lettersSvg}
      </g>
      ${wordBankSvg}
      ${this.renderFooter(1)}
    </svg>`;
  }

  private renderReminiscenceSvg(
    profile: ResidentProfile,
    title: string,
    subtitle: string,
    instructions: string,
    cards: ReminiscencePromptCard[],
    tier: 1 | 2 | 3,
    motor: MotorCapabilityLevel
  ): string {
    const startY = 190;
    const cardHeight = 125;
    const cardSpacing = 14;

    let cardsSvg = '';
    cards.forEach((card, idx) => {
      const y = startY + idx * (cardHeight + cardSpacing);
      cardsSvg += `
      <g class="reminiscence-card" transform="translate(54, ${y})">
        <!-- Heavy Outer High-Contrast Border -->
        <rect x="0" y="0" width="522" height="${cardHeight}" fill="#ffffff" stroke="#000000" stroke-width="3" rx="6" />
        
        <!-- Category Badge -->
        <rect x="0" y="0" width="260" height="26" fill="#000000" rx="3" />
        <text x="12" y="18" font-family="'Atkinson Hyperlegible', sans-serif" font-size="12" font-weight="bold" fill="#ffffff">${escapeXml(card.categoryLabel).toUpperCase()}</text>

        <!-- Primary Invitation Text (20pt Bold Floor) -->
        <text x="16" y="52" font-family="'Atkinson Hyperlegible', sans-serif" font-size="19" font-weight="bold" fill="#000000">
          ${escapeXml(card.invitationText)}
        </text>

        <!-- Follow-up Prompt / Choice -->
        ${card.followUpText ? `
        <text x="16" y="80" font-family="'Atkinson Hyperlegible', sans-serif" font-size="15" font-style="italic" fill="#000000">
          ✦ You might also ask: "${escapeXml(card.followUpText)}"
        </text>` : ''}

        <!-- Sensory Action Cue -->
        <rect x="12" y="94" width="498" height="24" fill="none" stroke="#000000" stroke-width="1.5" stroke-dasharray="4,4" rx="3" />
        <text x="20" y="111" font-family="'Atkinson Hyperlegible', sans-serif" font-size="12" font-weight="bold" fill="#000000">
          ✋ TACTILE ACTION: ${escapeXml(card.tangiblePairingAction || 'Hold or trace a tangible memory stone.')}
        </text>
      </g>
      `;
    });

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 612 792" width="612pt" height="792pt" style="background-color:#ffffff;">
      ${this.renderHeader(profile, title, subtitle, instructions)}
      ${cardsSvg}
      ${this.renderFooter(2)}
    </svg>`;
  }

  private renderTriviaSvg(
    profile: ResidentProfile,
    title: string,
    subtitle: string,
    instructions: string,
    tangibleCue: string,
    items: TriviaItem[],
    fontSizePt: number,
    isChoiceBased: boolean,
    tier: 1 | 2 | 3
  ): string {
    const startY = 190;
    const itemHeight = 95;

    let itemsSvg = '';
    items.forEach((item, idx) => {
      const y = startY + idx * (itemHeight + 12);
      itemsSvg += `
      <g class="trivia-item" transform="translate(54, ${y})">
        <rect x="0" y="0" width="522" height="${itemHeight}" fill="none" stroke="#000000" stroke-width="2.5" rx="6" />
        
        <!-- Number indicator -->
        <circle cx="24" cy="24" r="14" fill="#000000" />
        <text x="24" y="30" font-family="'Atkinson Hyperlegible', sans-serif" font-size="16" font-weight="bold" fill="#ffffff" text-anchor="middle">${idx + 1}</text>

        <!-- Prompt Text (19pt+ Floor) -->
        <text x="48" y="29" font-family="'Atkinson Hyperlegible', sans-serif" font-size="18" font-weight="bold" fill="#000000">
          ${escapeXml(item.promptText)}
        </text>

        ${isChoiceBased ? `
        <!-- High-Contrast Tactile Selection Targets -->
        <g transform="translate(50, 48)">
          <!-- Option A -->
          <circle cx="20" cy="20" r="16" fill="none" stroke="#000000" stroke-width="3" />
          <text x="50" y="27" font-family="'Atkinson Hyperlegible', sans-serif" font-size="22" font-weight="bold" fill="#000000">${escapeXml(item.options[0])}</text>

          <!-- Option B -->
          <circle cx="240" cy="20" r="16" fill="none" stroke="#000000" stroke-width="3" />
          <text x="270" y="27" font-family="'Atkinson Hyperlegible', sans-serif" font-size="22" font-weight="bold" fill="#000000">${escapeXml(item.options[1])}</text>
        </g>
        ` : `
        <!-- Open Handwriting Guideline -->
        <line x1="50" y1="72" x2="480" y2="72" stroke="#000000" stroke-width="2" />
        <text x="50" y="65" font-family="'Atkinson Hyperlegible', sans-serif" font-size="14" font-style="italic" fill="#000000">Write or say the word here</text>
        `}
      </g>
      `;
    });

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 612 792" width="612pt" height="792pt" style="background-color:#ffffff;">
      ${this.renderHeader(profile, title, subtitle, instructions, tangibleCue)}
      ${itemsSvg}
      ${this.renderFooter(3)}
    </svg>`;
  }

  private renderMatchingSvg(
    profile: ResidentProfile,
    title: string,
    subtitle: string,
    instructions: string,
    tangibleCue: string,
    pairs: MatchingPair[],
    strokeWidthPt: number,
    fontSizePt: number,
    tier: 1 | 2 | 3
  ): string {
    const startY = 195;
    const rowHeight = 110;

    let rowsSvg = '';
    pairs.forEach((pair, idx) => {
      const y = startY + idx * (rowHeight + 15);
      rowsSvg += `
      <g class="matching-row" transform="translate(54, ${y})">
        <!-- Left Target Card -->
        <rect x="0" y="0" width="190" height="90" fill="none" stroke="#000000" stroke-width="3" rx="6" />
        <text x="95" y="44" font-family="'Atkinson Hyperlegible', sans-serif" font-size="18" font-weight="bold" fill="#000000" text-anchor="middle">${escapeXml(pair.leftItem)}</text>
        <!-- Tangible Landing Ring -->
        <circle cx="170" cy="70" r="10" fill="none" stroke="#000000" stroke-width="2" />

        <!-- Tactile Tracing Path (Guided Stroke) -->
        <path d="M 195 45 Q 260 ${idx % 2 === 0 ? 15 : 75} 325 45" fill="none" stroke="#000000" stroke-width="${strokeWidthPt}" stroke-linecap="round" stroke-dasharray="${tier === 3 ? 'none' : '8,6'}" />

        <!-- Right Target Card -->
        <rect x="332" y="0" width="190" height="90" fill="none" stroke="#000000" stroke-width="3" rx="6" />
        <text x="427" y="44" font-family="'Atkinson Hyperlegible', sans-serif" font-size="18" font-weight="bold" fill="#000000" text-anchor="middle">${escapeXml(pair.rightItem)}</text>
        <!-- Tangible Landing Symbol -->
        <circle cx="352" cy="70" r="10" fill="none" stroke="#000000" stroke-width="2" />
        <text x="352" y="75" font-family="'Atkinson Hyperlegible', sans-serif" font-size="12" font-weight="bold" fill="#000000" text-anchor="middle">${pair.tangibleTargetSymbol}</text>
      </g>
      `;
    });

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 612 792" width="612pt" height="792pt" style="background-color:#ffffff;">
      ${this.renderHeader(profile, title, subtitle, instructions, tangibleCue)}
      ${rowsSvg}
      ${this.renderFooter(4)}
    </svg>`;
  }
}

// Export singleton instance for direct convenience
export const packetGenerator = new PacketGenerator();
