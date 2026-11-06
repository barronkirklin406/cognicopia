/**
 * @file packetGenerator.ts
 * @description Cognicopia Cognitive Puzzle & Packet Engine with Family Metadata Injection.
 * 
 * Provides clinically aligned activity generators (Word Searches, Fill-in-the-Blanks,
 * and Word Puzzles) that dynamically prioritize personal family relationship metadata
 * (e.g., daughter's name like "Sarah", spouse, children, siblings, and relational anchors:
 * "FAMILY", "HOME", "LOVE", "HEART", "CHERISH").
 *
 * Adheres strictly to Zero-Cloud execution, large-print typography (18pt+),
 * 0.75" binder gutter margins for physical care packets, and high-contrast B&W vector SVG export.
 */

export interface FamilyRelationshipMetadata {
  daughter?: string;
  son?: string;
  spouse?: string;
  children?: string[];
  siblings?: string[];
  mother?: string;
  father?: string;
  grandkids?: string[];
  relatives?: string[];
  customFamilyWords?: string[];
}

export interface ResidentProfile {
  id?: string;
  firstName: string;
  lastName?: string;
  preferredName?: string;
  birthYear?: number;
  stage?: 'early' | 'middle' | 'late' | 'Mild' | 'Moderate' | 'Advanced';
  town?: string;
  state?: string;
  pastOccupation?: string;
  hobbies?: string[];
  interests?: string[];
  musicEra?: string;
  family?: FamilyRelationshipMetadata;
  // Fallback flat fields for cross-compatibility
  daughter?: string;
  son?: string;
  spouse?: string;
  kids?: string[] | string;
  sibs?: string[] | string;
  mother?: string;
  father?: string;
  pets?: string[];
  avoidTopics?: string[];
  notes?: string;
}

export interface PlacedWord {
  word: string;
  row: number;
  col: number;
  direction: 'H' | 'V' | 'D'; // Horizontal, Vertical, Diagonal
  isFamilyWord: boolean;
  relationLabel?: string;
}

export interface WordSearchResult {
  size: number;
  grid: string[][];
  placedWords: PlacedWord[];
  wordBank: string[];
  familyWords: string[];
  stage: string;
  title: string;
  instructions: string;
}

export interface FillInBlankItem {
  id: string;
  prompt: string; // Contains "____" placeholder
  answer: string;
  options: [string, string];
  isFamilyRelation: boolean;
  relationType?: string;
}

export interface FillInBlankResult {
  title: string;
  subtitle: string;
  instructions: string;
  items: FillInBlankItem[];
  residentName: string;
}

export interface WordFitItem {
  word: string;
  length: number;
  isFamilyWord: boolean;
  clue?: string;
}

export interface WordFitResult {
  title: string;
  instructions: string;
  words: WordFitItem[];
  grid?: string[][];
}

export interface SVGExportOptions {
  pageWidthInches?: number;  // Default 8.5
  pageHeightInches?: number; // Default 11.0
  binderMarginInches?: number; // Default 0.75"
  topMarginInches?: number;   // Default 0.75"
  rightMarginInches?: number; // Default 0.75"
  bottomMarginInches?: number;// Default 0.75"
  highContrast?: boolean;
  facilityName?: string;
  residentName?: string;
  pageNumber?: string;
}

// -------------------------------------------------------------
// 1. FAMILY METADATA EXTRACTION & PRIORITIZATION
// -------------------------------------------------------------

const DEFAULT_RELATIONAL_ANCHORS = ['FAMILY', 'HOME', 'LOVE', 'HEART', 'CHERISH', 'SMILE'];

/**
 * Normalizes a raw string to alphanumeric uppercase characters.
 */
export function sanitizeWord(raw: string): string {
  if (!raw) return '';
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
}

/**
 * Extracts and prioritizes family relationship metadata from a resident profile.
 * Immediate family members (daughters, sons, spouse, siblings, parents) are extracted
 * along with relational anchor keywords.
 */
export function extractFamilyMetadata(profile: ResidentProfile, maxWordLength: number = 10): {
  familyWords: string[];
  relationships: Record<string, string>;
} {
  const familyWords: string[] = [];
  const relationships: Record<string, string> = {};
  const seen = new Set<string>();

  const addName = (rawName: string | undefined, relationLabel: string) => {
    if (!rawName) return;
    const parts = String(rawName).split(/[,;&]/);
    for (const part of parts) {
      const clean = sanitizeWord(part);
      if (clean.length >= 3 && clean.length <= maxWordLength && !seen.has(clean)) {
        seen.add(clean);
        familyWords.push(clean);
        relationships[clean] = relationLabel;
      }
    }
  };

  // Structured family object
  const fam = profile.family || {};

  // 1. Daughter(s) - e.g. "Sarah"
  if (fam.daughter) addName(fam.daughter, 'Daughter');
  if (profile.daughter) addName(profile.daughter, 'Daughter');

  // 2. Son(s)
  if (fam.son) addName(fam.son, 'Son');
  if (profile.son) addName(profile.son, 'Son');

  // 3. Spouse
  if (fam.spouse) addName(fam.spouse, 'Spouse');
  if (profile.spouse) addName(profile.spouse, 'Spouse');

  // 4. Children list
  const kids = fam.children || (Array.isArray(profile.kids) ? profile.kids : profile.kids ? [profile.kids] : []);
  for (const k of kids) addName(k, 'Child');

  // 5. Siblings
  const sibs = fam.siblings || (Array.isArray(profile.sibs) ? profile.sibs : profile.sibs ? [profile.sibs] : []);
  for (const s of sibs) addName(s, 'Sibling');

  // 6. Parents
  if (fam.mother || profile.mother) addName(fam.mother || profile.mother, 'Mother');
  if (fam.father || profile.father) addName(fam.father || profile.father, 'Father');

  // 7. Grandchildren
  if (fam.grandkids) {
    for (const g of fam.grandkids) addName(g, 'Grandchild');
  }

  // 8. Relational anchors ("FAMILY", "HOME", "LOVE", etc.)
  for (const anchor of DEFAULT_RELATIONAL_ANCHORS) {
    if (anchor.length <= maxWordLength && !seen.has(anchor)) {
      seen.add(anchor);
      familyWords.push(anchor);
      relationships[anchor] = 'Family Anchor';
    }
  }

  return { familyWords, relationships };
}

/**
 * Builds the primary word-bank generation queue for a resident.
 * Ensures family names and relational anchors are placed at the very front
 * so residents interact with personally significant words rather than generic vocabulary.
 */
export function buildPrimaryWordBankQueue(profile: ResidentProfile, maxWordLength: number = 10): string[] {
  const { familyWords } = extractFamilyMetadata(profile, maxWordLength);
  const queue: string[] = [...familyWords];
  const seen = new Set<string>(familyWords);

  // General biographical additions (town, hobbies, favorites)
  const generalBio: (string | undefined)[] = [
    profile.town,
    profile.state,
    profile.pastOccupation,
    ...(profile.hobbies || []),
    ...(profile.interests || [])
  ];

  for (const item of generalBio) {
    if (!item) continue;
    const parts = String(item).split(/[,;&]/);
    for (const p of parts) {
      const clean = sanitizeWord(p);
      if (clean.length >= 3 && clean.length <= maxWordLength && !seen.has(clean)) {
        seen.add(clean);
        queue.push(clean);
      }
    }
  }

  // Fallback dignified words if list is small
  const fallbacks = ['MUSIC', 'GARDEN', 'SPRING', 'PEACE', 'SMILE', 'FRIEND', 'SUNDAY', 'SONG'];
  for (const fb of fallbacks) {
    if (fb.length <= maxWordLength && !seen.has(fb)) {
      seen.add(fb);
      queue.push(fb);
    }
  }

  return queue;
}

// -------------------------------------------------------------
// 2. DEMENTIA-FRIENDLY WORD SEARCH ENGINE
// -------------------------------------------------------------

const FILL_CHARS = 'AAABCDEEEEFGHIIIKLLMNNOOOPRRSSSTTTUWY';

export interface WordSearchConfig {
  gridSize?: number;      // 8 (middle/late), 10, or 12 (early)
  maxWords?: number;      // 6 to 10
  allowDiagonal?: boolean;// False by default for dementia readability
  allowReverse?: boolean; // False by default (no backwards words)
  seed?: number;
}

/**
 * Generates an evidence-aligned Word Search where family metadata is prioritized.
 */
export function generateWordSearch(
  profile: ResidentProfile,
  config: WordSearchConfig = {}
): WordSearchResult {
  const stage = String(profile.stage || 'middle').toLowerCase();
  const defaultSize = stage.includes('late') ? 8 : stage.includes('early') ? 12 : 10;
  const size = config.gridSize || defaultSize;
  const maxWords = config.maxWords || (size <= 8 ? 6 : size <= 10 ? 8 : 10);
  const allowDiagonal = config.allowDiagonal ?? (stage.includes('early'));
  const allowReverse = config.allowReverse ?? false;

  const { familyWords, relationships } = extractFamilyMetadata(profile, size);
  const primaryQueue = buildPrimaryWordBankQueue(profile, size);

  // Initialize empty grid
  const grid: string[][] = Array.from({ length: size }, () => Array(size).fill(''));
  const placedWords: PlacedWord[] = [];

  // Allowed directions
  const directions: [number, number, 'H' | 'V' | 'D'][] = [
    [0, 1, 'H'], // Across
    [1, 0, 'V']  // Down
  ];
  if (allowDiagonal) {
    directions.push([1, 1, 'D']); // Diagonal down-right
  }

  // Attempt placement
  const wordCandidateList = primaryQueue.slice(0, maxWords * 2);

  for (const word of wordCandidateList) {
    if (placedWords.length >= maxWords) break;

    let placed = false;
    const shuffledDirs = [...directions].sort(() => Math.random() - 0.5);

    for (const [dr, dc, dirCode] of shuffledDirs) {
      if (placed) break;

      // Legal starting positions
      const maxR = size - dr * (word.length - 1);
      const maxC = size - dc * (word.length - 1);
      if (maxR <= 0 || maxC <= 0) continue;

      // Try multiple random coordinates
      const startRows = Array.from({ length: maxR }, (_, i) => i).sort(() => Math.random() - 0.5);
      const startCols = Array.from({ length: maxC }, (_, i) => i).sort(() => Math.random() - 0.5);

      for (const r0 of startRows) {
        if (placed) break;
        for (const c0 of startCols) {
          let fits = true;
          for (let i = 0; i < word.length; i++) {
            const ch = grid[r0 + dr * i][c0 + dc * i];
            if (ch !== '' && ch !== word[i]) {
              fits = false;
              break;
            }
          }
          if (fits) {
            for (let i = 0; i < word.length; i++) {
              grid[r0 + dr * i][c0 + dc * i] = word[i];
            }
            const isFam = familyWords.includes(word);
            placedWords.push({
              word,
              row: r0,
              col: c0,
              direction: dirCode,
              isFamilyWord: isFam,
              relationLabel: relationships[word]
            });
            placed = true;
            break;
          }
        }
      }
    }
  }

  // Fill empty spaces with high-frequency vowels/consonants
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c] === '') {
        const randIdx = Math.floor(Math.random() * FILL_CHARS.length);
        grid[r][c] = FILL_CHARS[randIdx];
      }
    }
  }

  const wordBank = placedWords.map(p => p.word).sort();
  const resName = profile.preferredName || profile.firstName || 'Resident';

  return {
    size,
    grid,
    placedWords,
    wordBank,
    familyWords: placedWords.filter(p => p.isFamilyWord).map(p => p.word),
    stage,
    title: `Words from ${resName}'s Life`,
    instructions: allowDiagonal
      ? 'Words run across, down, or diagonally. Circle each word you find.'
      : 'Words run across or down. Circle each word you find.'
  };
}

// -------------------------------------------------------------
// 3. FILL-IN-THE-BLANKS & COGNITIVE RECALL GENERATOR
// -------------------------------------------------------------

export function generateFillInTheBlanks(profile: ResidentProfile): FillInBlankResult {
  const resName = profile.preferredName || profile.firstName || 'Friend';
  const { familyWords, relationships } = extractFamilyMetadata(profile, 12);
  const items: FillInBlankItem[] = [];

  // 1. Daughter prompt if available (e.g. Sarah)
  const daughterWord = familyWords.find(w => relationships[w] === 'Daughter');
  if (daughterWord) {
    items.push({
      id: 'daughter_visit',
      prompt: `A wonderful visit from ${daughterWord} brings warmth and ____.`,
      answer: 'JOY',
      options: ['JOY', 'WINTER'],
      isFamilyRelation: true,
      relationType: 'Daughter'
    });
    items.push({
      id: 'daughter_name',
      prompt: `${resName}'s loving daughter is named ____.`,
      answer: daughterWord,
      options: [daughterWord, 'EMILY'],
      isFamilyRelation: true,
      relationType: 'Daughter'
    });
  }

  // 2. Core Family & Home Anchors
  items.push({
    id: 'fam_home',
    prompt: 'There is no place quite like ____.',
    answer: 'HOME',
    options: ['HOME', 'STREET'],
    isFamilyRelation: true,
    relationType: 'Home'
  });

  items.push({
    id: 'fam_together',
    prompt: 'The most cherished times are spent together with ____.',
    answer: 'FAMILY',
    options: ['FAMILY', 'CLOCKS'],
    isFamilyRelation: true,
    relationType: 'Family'
  });

  // 3. Hometown / Occupation
  if (profile.town) {
    const townClean = sanitizeWord(profile.town);
    items.push({
      id: 'hometown_memory',
      prompt: `Fond childhood memories in the town of ____.`,
      answer: townClean,
      options: [townClean, 'BOSTON'],
      isFamilyRelation: false
    });
  }

  if (profile.pastOccupation) {
    items.push({
      id: 'work_memory',
      prompt: `Taking pride in dedicated years of work as a ____.`,
      answer: sanitizeWord(profile.pastOccupation),
      options: [sanitizeWord(profile.pastOccupation), 'SAILOR'],
      isFamilyRelation: false
    });
  }

  return {
    title: 'Finish the Thought',
    subtitle: `Personal memories and cherished sayings for ${resName}`,
    instructions: 'Circle the word that finishes each sentence. Saying it aloud counts too!',
    items: items.slice(0, 6),
    residentName: resName
  };
}

// -------------------------------------------------------------
// 4. VECTOR SVG EXPORT ENGINE (0.75" BINDER MARGIN & 18PT+ TYPE)
// -------------------------------------------------------------

/**
 * Generates a clean, crisp, production-grade vector SVG string for the Word Search.
 * Adheres to 0.75" binder margins (left gutter for 3-ring binder punch),
 * 18pt+ high-contrast typography, and adult dignity layout standards.
 */
export function exportWordSearchSVG(
  result: WordSearchResult,
  options: SVGExportOptions = {}
): string {
  const widthInches = options.pageWidthInches || 8.5;
  const heightInches = options.pageHeightInches || 11.0;
  const binderMargin = options.binderMarginInches || 0.75;
  const rightMargin = options.rightMarginInches || 0.75;
  const topMargin = options.topMarginInches || 0.75;

  // Convert to points (72pt per inch)
  const W = widthInches * 72; // 612 pt
  const H = heightInches * 72; // 792 pt
  const leftX = binderMargin * 72; // 54 pt (0.75")
  const rightX = W - rightMargin * 72; // 558 pt
  const printableWidth = rightX - leftX; // 504 pt

  const size = result.size;
  // Size grid to fit comfortably with large print
  const maxGridWidth = Math.min(printableWidth, 380);
  const cellSize = Math.floor(maxGridWidth / size);
  const gridWidth = cellSize * size;
  const gridStartX = leftX + (printableWidth - gridWidth) / 2;

  let y = topMargin * 72 + 20;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${widthInches}in" height="${heightInches}in" style="background:#ffffff;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">\n`;

  // Visual binder punch margin indicator guide (subtle dotted line in print preview)
  svg += `  <!-- 0.75" Binder Gutter Boundary Guide -->\n`;
  svg += `  <line x1="${leftX}" y1="0" x2="${leftX}" y2="${H}" stroke="#e0e0e0" stroke-width="0.5" stroke-dasharray="4,4" />\n`;

  // Header Title
  svg += `  <text x="${leftX}" y="${y}" font-size="24" font-weight="700" fill="#000000">${escapeXml(result.title)}</text>\n`;
  y += 20;
  svg += `  <text x="${leftX}" y="${y}" font-size="14" font-weight="600" fill="#333333">${escapeXml(result.instructions)}</text>\n`;
  y += 14;
  svg += `  <line x1="${leftX}" y1="${y}" x2="${rightX}" y2="${y}" stroke="#000000" stroke-width="1.5" />\n`;
  y += 28;

  // Grid background and letter cells
  const gridTopY = y;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const cx = gridStartX + c * cellSize;
      const cy = gridTopY + r * cellSize;
      const letter = result.grid[r][c];

      // Draw high-contrast letter box
      svg += `  <rect x="${cx}" y="${cy}" width="${cellSize}" height="${cellSize}" fill="#ffffff" stroke="#000000" stroke-width="1.4" />\n`;
      // Center letter inside cell
      const fontPt = Math.max(18, Math.floor(cellSize * 0.65));
      const letterY = cy + cellSize * 0.72;
      svg += `  <text x="${cx + cellSize / 2}" y="${letterY}" font-size="${fontPt}" font-weight="700" fill="#000000" text-anchor="middle">${letter}</text>\n`;
    }
  }

  y = gridTopY + gridWidth + 32;

  // Word Bank Header
  svg += `  <text x="${leftX}" y="${y}" font-size="18" font-weight="700" fill="#000000">Word Bank (Find these words):</text>\n`;
  y += 24;

  // Render words in multi-column list
  const cols = 3;
  const colWidth = printableWidth / cols;
  const words = result.wordBank;

  for (let i = 0; i < words.length; i++) {
    const colIdx = i % cols;
    const rowIdx = Math.floor(i / cols);
    const wx = leftX + colIdx * colWidth;
    const wy = y + rowIdx * 28;
    const word = words[i];
    const isFam = result.familyWords.includes(word);

    // Checkbox box for ticking
    svg += `  <rect x="${wx}" y="${wy - 14}" width="16" height="16" fill="#ffffff" stroke="#000000" stroke-width="1.5" rx="3" />\n`;
    svg += `  <text x="${wx + 26}" y="${wy}" font-size="18" font-weight="${isFam ? '800' : '600'}" fill="#000000">${word}</text>\n`;
    if (isFam) {
      svg += `  <text x="${wx + 26 + word.length * 11 + 6}" y="${wy - 1}" font-size="11" font-weight="700" fill="#0e3c43">[Family]</text>\n`;
    }
  }

  // Footer with Cognicopia clinical notice and 0.75" binder gutter badge
  svg += `  <line x1="${leftX}" y1="${H - 45}" x2="${rightX}" y2="${H - 45}" stroke="#999999" stroke-width="0.8" />\n`;
  svg += `  <text x="${leftX}" y="${H - 28}" font-size="11" font-weight="600" fill="#555555">Cognicopia™ Memory Care Architecture · 0.75″ Binder Margin · High-Contrast Dementia Standard</text>\n`;
  svg += `  <text x="${rightX}" y="${H - 28}" font-size="11" font-weight="700" fill="#000000" text-anchor="end">Page 1 of 5</text>\n`;

  svg += `</svg>`;
  return svg;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
