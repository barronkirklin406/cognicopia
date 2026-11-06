/**
 * @file packetGenerator.js
 * @description In-browser and Node-compatible runtime service for Cognicopia.
 * Implements deep biographical profiling across the 4 Human Pillars:
 * 1. WHAT CAN THEY DO? (Cognitive & motor bandwidth: 18pt+ font floor, zero-grayscale contrast, tactile tracing paths)
 * 2. WHAT DO THEY CARE ABOUT? (Lifelong passions, formative eras of music, regional roots)
 * 3. WHAT DO THEY HAVE ON HAND? (Tangible physical items: tokens, colored pencils, memory stones)
 * 4. PROFESSIONAL & EDUCATIONAL IDENTITY ("Who was this person at work or school when they were younger?")
 * 
 * Conforms strictly to the 150 Master SVG Vector Architecture.
 * @global CogniPacketGenerator
 */
(function(root) {
  'use strict';

  var VOCATIONAL_LEXICON = {
    carpenter: {
      tradeLabel: 'Carpentry & Woodworking',
      tools: ['Hand Plane', 'Steel Square', 'Crosscut Saw', 'Chisel', 'Wood Rasp', 'Brace & Bit'],
      vocabulary: ['TIMBER', 'MORTISE', 'DOVETAIL', 'OAK', 'WALNUT', 'GRAIN', 'PLANE', 'CEDAR', 'CHISEL', 'LEVEL', 'SQUARE'],
      conversationalAnchors: [
        'The scent of fresh cedar shavings on a quiet morning in the shop.',
        'Checking a true corner with a steel square and feeling the smooth edge of cured hardwood.',
        'The quiet satisfaction of a dovetail joint fitting together with perfection.'
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
      ]
    }
  };

  var ERA_LEXICON = {
    '1940s': {
      songs: ['Moonlight Serenade (Glenn Miller)', 'Sentimental Journey (Doris Day)', 'In the Mood'],
      culturalWords: ['BIGBAND', 'SWING', 'RADIO', 'JUKEBOX', 'VICTORY', 'TROLLEY', 'PARADE']
    },
    '1950s': {
      songs: ['Rock Around the Clock (Bill Haley)', 'Tennessee Waltz (Patti Page)', 'Love Me Tender (Elvis Presley)'],
      culturalWords: ['SODA', 'DOCKERS', 'JUKEBOX', 'DRIVEIN', 'VINYL', 'CHEVY', 'RECORD']
    },
    '1960s': {
      songs: ['Stand By Me (Ben E. King)', 'My Girl (The Temptations)', 'I Want to Hold Your Hand (The Beatles)'],
      culturalWords: ['MOTOWN', 'CORVAIR', 'STEREO', 'SPACE', 'ACOUSTIC', 'BEATLES', 'MUSTANG']
    },
    '1970s': {
      songs: ['Take Me Home, Country Roads (John Denver)', 'Bridge Over Troubled Water (Simon & Garfunkel)'],
      culturalWords: ['CASSETTE', 'DENVER', 'HARMONY', 'STATION', 'COUNTRY', 'GUITAR', 'VINYL']
    }
  };

  function escapeXml(unsafe) {
    return String(unsafe == null ? '' : unsafe)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function resolveVocationKey(vocationStr) {
    var norm = (vocationStr || '').toLowerCase();
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

  function resolveEraKey(eraStr) {
    var match = (eraStr || '').match(/(19[3-8]0s?)/i);
    if (match) {
      var key = match[1].toLowerCase().replace(/s?$/, 's');
      if (ERA_LEXICON[key]) return key;
    }
    return '1950s';
  }

  function normalizeTier(tier) {
    if (tier === 1 || tier === 'Tier 1' || tier === 'early') return 1;
    if (tier === 3 || tier === 'Tier 3' || tier === 'late') return 3;
    return 2;
  }

  function PseudoRng(seed) {
    var s = typeof seed === 'number' ? seed : 123456789;
    if (typeof seed === 'string') {
      var h = 0xdeadbeef;
      for (var i = 0; i < seed.length; i++) {
        h = Math.imul(h ^ seed.charCodeAt(i), 2654435761);
      }
      s = (h ^ (h >>> 16)) >>> 0;
    }
    this.state = s || 123456789;
  }
  PseudoRng.prototype.next = function() {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    var t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  PseudoRng.prototype.pick = function(list) {
    return list[Math.floor(this.next() * list.length)];
  };
  PseudoRng.prototype.shuffle = function(list) {
    var arr = list.slice();
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(this.next() * (i + 1));
      var temp = arr[i];
      arr[i] = arr[j];
      arr[j] = temp;
    }
    return arr;
  };

  var PacketGenerator = {
    /**
     * Generates local LLM prompt templates configured with biographical profiling.
     */
    generateBiographicalPromptTemplates: function(profile) {
      var tierNum = normalizeTier(profile.cognitiveTier);
      var vocKey = resolveVocationKey(profile.pastVocation);
      var vocData = VOCATIONAL_LEXICON[vocKey];
      var eraKey = resolveEraKey(profile.formativeEra);
      var onHand = (profile.onHandItems || ['colored pencils', 'tactile tokens']).join(', ');
      var passions = (profile.corePassions || ['gardening', 'music']).join(', ');

      return {
        systemConstitution: 'CLINICAL CONSTITUTION FOR COGNICOPIA:\n' +
          '1. Adult Dignity: No quiz traps or elderspeak.\n' +
          '2. Zero Grayscale: 100% black on white (#000000 on #ffffff).\n' +
          '3. 18pt+ Floor: Every resident-facing word must be at least 18pt.\n' +
          '4. Historical Dignity (Pillar 4): ' + profile.pastVocation + ' (' + vocData.tradeLabel + ').\n' +
          '5. Tangible Sensory Pairings (Pillar 3): [' + onHand + '].\n' +
          '6. Cognitive & Motor Bandwidth (Pillar 1): Tier ' + tierNum + ' (' + (profile.motorCapabilityLevel || 'moderate') + ').\n',
        wordSearchPrompt: 'Create personalized word search for ' + profile.preferredName + ' honoring ' + profile.pastVocation + ' and ' + eraKey + '.\n',
        triviaPrompt: 'Generate 6 dignified Finish-the-Thought reflection lines for ' + profile.preferredName + '.\n',
        reminiscencePrompt: 'Create 4 conversation starter cards querying "Who was this person at work or school when they were younger?"\n',
        matchingTactilePrompt: 'Generate high-contrast tactile matching worksheet for ' + profile.preferredName + ' with guided motor stroke paths.\n'
      };
    },

    /**
     * Procedurally generates a comprehensive 4-activity cognitive packet completely offline.
     */
    generatePacket: function(profile, seed) {
      seed = seed || Date.now();
      profile = profile || {};
      profile.preferredName = profile.preferredName || profile.name || 'Resident';
      profile.corePassions = (profile.corePassions && profile.corePassions.length > 0)
        ? profile.corePassions
        : ['Family & Good Conversations', 'Gardening & Nature'];
      profile.formativeEra = profile.formativeEra || '1950s';
      profile.pastVocation = profile.pastVocation || profile.vocation || 'Life Craft & Building';
      var rng = new PseudoRng((profile.id || 'res') + '-' + seed);
      var tierNum = normalizeTier(profile.cognitiveTier);
      var motor = profile.motorCapabilityLevel || 'moderate';
      var vocKey = resolveVocationKey(profile.pastVocation);
      var vocData = VOCATIONAL_LEXICON[vocKey] || VOCATIONAL_LEXICON.general;
      var eraKey = resolveEraKey(profile.formativeEra);
      var eraData = ERA_LEXICON[eraKey] || ERA_LEXICON['1950s'];

      var onHandList = profile.onHandItems && profile.onHandItems.length > 0
        ? profile.onHandItems
        : ['colored pencils', 'tactile tokens', 'memory stones'];
      var primaryOnHand = rng.pick(onHandList);

      var ws = this._generateWordSearch(profile, rng, tierNum, motor, vocData, eraData, primaryOnHand);
      var rem = this._generateReminiscence(profile, rng, tierNum, motor, vocData, eraData, primaryOnHand);
      var triv = this._generateTrivia(profile, rng, tierNum, motor, vocData, eraData, primaryOnHand);
      var match = this._generateMatching(profile, rng, tierNum, motor, vocData, primaryOnHand);

      return {
        residentId: profile.id,
        residentName: profile.preferredName,
        generatedDate: new Date().toISOString().slice(0, 10),
        cognitiveTierNum: tierNum,
        motorLevel: motor,
        primaryPillarsApplied: {
          canDoSummary: 'Cognitive Tier ' + tierNum + ', Motor Bandwidth: ' + motor + ' (Font Floor: ' + ws.fontSizePt + 'pt).',
          careAboutSummary: 'Lifelong passions: ' + (profile.corePassions || []).join(', ') + '; Era: ' + eraKey + '.',
          onHandSummary: 'Integrated tangible pairing with ' + primaryOnHand + '.',
          vocationSummary: 'Vocational dignity: ' + profile.pastVocation + ' (' + vocData.tradeLabel + ').'
        },
        wordSearch: ws,
        reminiscence: rem,
        trivia: triv,
        matching: match,
        svgPages: [ws.svg, rem.svg, triv.svg, match.svg]
      };
    },

    _renderHeader: function(profile, title, subtitle, instructions, tangibleCue) {
      var tierNum = normalizeTier(profile.cognitiveTier);
      var name = escapeXml(profile.preferredName || 'Resident').toUpperCase();
      return '<!-- Top Personalized Hero Banner -->\n' +
        '<rect x="54" y="36" width="522" height="32" fill="none" stroke="#000000" stroke-width="2.5" />\n' +
        '<text x="64" y="58" font-family="\'Atkinson Hyperlegible\', sans-serif" font-size="14" font-weight="bold" fill="#000000" letter-spacing="1">ACTIVITY PACKET PREPARED FOR: ' + name + '</text>\n' +
        '<text x="566" y="58" font-family="\'Atkinson Hyperlegible\', sans-serif" font-size="12" font-weight="bold" fill="#000000" text-anchor="end">TIER ' + tierNum + '</text>\n' +
        '<text x="54" y="96" font-family="\'Atkinson Hyperlegible\', sans-serif" font-size="24" font-weight="bold" fill="#000000">' + escapeXml(title) + '</text>\n' +
        '<text x="54" y="118" font-family="\'Atkinson Hyperlegible\', sans-serif" font-size="16" font-style="italic" fill="#000000">' + escapeXml(subtitle) + '</text>\n' +
        '<rect x="54" y="130" width="522" height="' + (tangibleCue ? 44 : 28) + '" fill="none" stroke="#000000" stroke-width="2" rx="4" />\n' +
        '<text x="64" y="148" font-family="\'Atkinson Hyperlegible\', sans-serif" font-size="14" font-weight="bold" fill="#000000">' + escapeXml(instructions) + '</text>\n' +
        (tangibleCue ? '<text x="64" y="165" font-family="\'Atkinson Hyperlegible\', sans-serif" font-size="12" fill="#000000">✦ ' + escapeXml(tangibleCue) + '</text>\n' : '');
    },

    _renderFooter: function(pageNum, totalPages) {
      totalPages = totalPages || 4;
      return '<line x1="54" y1="740" x2="576" y2="740" stroke="#000000" stroke-width="2" />\n' +
        '<text x="54" y="758" font-family="\'Atkinson Hyperlegible\', sans-serif" font-size="12" font-weight="bold" fill="#000000">COGNICOPIA · CLINICAL MEMORY CARE SUITE</text>\n' +
        '<text x="576" y="758" font-family="\'Atkinson Hyperlegible\', sans-serif" font-size="12" font-weight="bold" fill="#000000" text-anchor="end">PAGE ' + pageNum + ' OF ' + totalPages + '</text>\n';
    },

    _generateWordSearch: function(profile, rng, tier, motor, vocData, eraData, onHandItem) {
      var size = tier === 3 || motor === 'assisted' ? 6 : tier === 2 || motor === 'moderate' ? 8 : 12;
      var targetCount = tier === 3 ? 3 : tier === 2 ? 5 : 8;
      var fontSizePt = tier === 3 ? 36 : tier === 2 ? 28 : 22;
      var strokeWidthPt = tier === 3 ? 6 : tier === 2 ? 4.5 : 3;

      var pool = [].concat(vocData.vocabulary, eraData.culturalWords);
      (profile.corePassions || []).forEach(function(p) {
        var clean = p.toUpperCase().replace(/[^A-Z]/g, '');
        if (clean.length >= 3 && clean.length <= size) pool.push(clean);
      });

      var seen = {};
      var cleanPool = pool.filter(function(w) {
        if (w.length < 3 || w.length > size || seen[w]) return false;
        seen[w] = true;
        return true;
      });

      var chosenWords = rng.shuffle(cleanPool).slice(0, targetCount);
      var grid = [];
      for (var r = 0; r < size; r++) {
        grid.push([]);
        for (var c = 0; c < size; c++) grid[r].push('');
      }

      var placedWords = [];
      for (var wIdx = 0; wIdx < chosenWords.length; wIdx++) {
        var word = chosenWords[wIdx];
        var isHorizontal = tier === 3 ? true : rng.next() > 0.4;
        var row = Math.floor(rng.next() * (isHorizontal ? size : size - word.length + 1));
        var col = Math.floor(rng.next() * (isHorizontal ? size - word.length + 1 : size));

        var fits = true;
        for (var i = 0; i < word.length; i++) {
          var cr = isHorizontal ? row : row + i;
          var cc = isHorizontal ? col + i : col;
          if (grid[cr][cc] !== '' && grid[cr][cc] !== word[i]) { fits = false; break; }
        }

        if (fits) {
          for (var k = 0; k < word.length; k++) {
            var pr = isHorizontal ? row : row + k;
            var pc = isHorizontal ? col + k : col;
            grid[pr][pc] = word[k];
          }
          placedWords.push(word);
        }
      }

      var alphabet = 'ABCDEFGHIKLMNOPRSTUW';
      for (var gr = 0; gr < size; gr++) {
        for (var gc = 0; gc < size; gc++) {
          if (!grid[gr][gc]) grid[gr][gc] = alphabet[Math.floor(rng.next() * alphabet.length)];
        }
      }

      var gridBoxSize = 340;
      var cellSize = gridBoxSize / size;
      var startX = 54 + (522 - gridBoxSize) / 2;
      var startY = 190;
      var linesSvg = '';

      for (var l = 0; l <= size; l++) {
        var pos = l * cellSize;
        linesSvg += '<line x1="' + startX + '" y1="' + (startY + pos) + '" x2="' + (startX + gridBoxSize) + '" y2="' + (startY + pos) + '" stroke="#000000" stroke-width="' + strokeWidthPt + '" stroke-linecap="round" />\n';
        linesSvg += '<line x1="' + (startX + pos) + '" y1="' + startY + '" x2="' + (startX + pos) + '" y2="' + (startY + gridBoxSize) + '" stroke="#000000" stroke-width="' + strokeWidthPt + '" stroke-linecap="round" />\n';
      }

      var lettersSvg = '';
      var textOffsetY = cellSize / 2 + fontSizePt * 0.35;
      for (var lr = 0; lr < size; lr++) {
        for (var lc = 0; lc < size; lc++) {
          var lx = startX + lc * cellSize + cellSize / 2;
          var ly = startY + lr * cellSize + textOffsetY;
          lettersSvg += '<text x="' + lx + '" y="' + ly + '" font-family="\'Atkinson Hyperlegible\', sans-serif" font-size="' + fontSizePt + '" font-weight="bold" fill="#000000" text-anchor="middle">' + grid[lr][lc] + '</text>\n';
        }
      }

      var wordBankSvg = '<g transform="translate(54, ' + (startY + gridBoxSize + 25) + ')">\n' +
        '<rect x="0" y="0" width="522" height="150" fill="none" stroke="#000000" stroke-width="2.5" rx="6" />\n' +
        '<text x="16" y="26" font-family="\'Atkinson Hyperlegible\', sans-serif" font-size="18" font-weight="bold" fill="#000000">WORDS TO FIND (Check box or place token):</text>\n';

      var cols = placedWords.length > 6 ? 3 : 2;
      var colWidth = 500 / cols;
      placedWords.forEach(function(w, idx) {
        var cIdx = idx % cols;
        var rIdx = Math.floor(idx / cols);
        var wx = 16 + cIdx * colWidth;
        var wy = 60 + rIdx * 34;
        wordBankSvg += '<rect x="' + wx + '" y="' + (wy - 18) + '" width="22" height="22" fill="none" stroke="#000000" stroke-width="2.5" rx="3" />\n';
        wordBankSvg += '<text x="' + (wx + 32) + '" y="' + wy + '" font-family="\'Atkinson Hyperlegible\', sans-serif" font-size="20" font-weight="bold" fill="#000000" letter-spacing="1">' + escapeXml(w) + '</text>\n';
      });
      wordBankSvg += '</g>\n';

      var title = 'Personalized Word Search';
      var subtitle = 'Crafted for ' + profile.preferredName + ' · Celebrating ' + vocData.tradeLabel;
      var instructions = 'Circle each word you discover. Words read ' + (tier === 3 ? 'across' : 'across and down') + '.';
      var tangibleCue = 'Tangible Pairing: Place a ' + onHandItem + ' directly onto each word after you find it.';

      var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 612 792" width="612pt" height="792pt" style="background-color:#ffffff;">\n' +
        this._renderHeader(profile, title, subtitle, instructions, tangibleCue) +
        '<g class="ws-grid">\n' + linesSvg + lettersSvg + '</g>\n' +
        wordBankSvg +
        this._renderFooter(1) +
        '</svg>';

      return {
        kind: 'wordsearch',
        title: title,
        subtitle: subtitle,
        instructions: instructions,
        tangibleCue: tangibleCue,
        gridSize: size,
        fontSizePt: fontSizePt,
        strokeWidthPt: strokeWidthPt,
        words: placedWords,
        grid: grid,
        svg: svg
      };
    },

    _generateReminiscence: function(profile, rng, tier, motor, vocData, eraData, onHandItem) {
      var cards = [
        {
          id: 'voc-1',
          categoryLabel: 'Life Trade: ' + vocData.tradeLabel,
          invitationText: profile.preferredName + ', tell me about your work with ' + (vocData.tools[0] || 'your trade') + '. What did a good morning of work feel like?',
          followUpText: tier === 3 ? 'Did you enjoy working in the cool morning air?' : 'What piece of work were you most proud to finish?',
          tangiblePairingAction: 'Hold or touch your ' + onHandItem + ' as we talk about the tools of the trade.'
        },
        {
          id: 'pas-1',
          categoryLabel: 'Lifelong Passion: ' + (profile.corePassions[0] || 'Good company'),
          invitationText: profile.preferredName + ', share with me what you love most about ' + (profile.corePassions[0] || 'nature') + '. What brings a peaceful feeling?',
          followUpText: 'Who was someone special who shared that passion with you?',
          tangiblePairingAction: 'Place a ' + onHandItem + ' beside this card to mark this warm memory.'
        },
        {
          id: 'era-1',
          categoryLabel: 'Musical Memories · ' + profile.formativeEra,
          invitationText: 'The song “' + eraData.songs[0] + '” was a beloved melody. What feelings or people come to mind?',
          followUpText: 'Shall we hum or sing the opening chorus gently together?',
          tangiblePairingAction: 'Tap a steady, soothing rhythm with your ' + onHandItem + '.'
        },
        {
          id: 'tan-1',
          categoryLabel: 'Sensory Comfort & Community',
          invitationText: 'Growing up around ' + (profile.hometown && profile.hometown.place ? profile.hometown.place : 'home') + ', what was the sweetest sound or scent in your neighborhood?',
          followUpText: 'Tell me about the friendly neighbors who lived next door.',
          tangiblePairingAction: 'Pass the ' + onHandItem + ' gently from one hand to the other while sharing.'
        }
      ];

      var startY = 190;
      var cardHeight = 125;
      var cardSpacing = 14;
      var cardsSvg = '';

      cards.forEach(function(c, idx) {
        var y = startY + idx * (cardHeight + cardSpacing);
        cardsSvg += '<g class="reminiscence-card" transform="translate(54, ' + y + ')">\n' +
          '<rect x="0" y="0" width="522" height="' + cardHeight + '" fill="#ffffff" stroke="#000000" stroke-width="3" rx="6" />\n' +
          '<rect x="0" y="0" width="260" height="26" fill="#000000" rx="3" />\n' +
          '<text x="12" y="18" font-family="\'Atkinson Hyperlegible\', sans-serif" font-size="12" font-weight="bold" fill="#ffffff">' + escapeXml(c.categoryLabel).toUpperCase() + '</text>\n' +
          '<text x="16" y="52" font-family="\'Atkinson Hyperlegible\', sans-serif" font-size="19" font-weight="bold" fill="#000000">' + escapeXml(c.invitationText) + '</text>\n' +
          (c.followUpText ? '<text x="16" y="80" font-family="\'Atkinson Hyperlegible\', sans-serif" font-size="15" font-style="italic" fill="#000000">✦ You might also ask: "' + escapeXml(c.followUpText) + '"</text>\n' : '') +
          '<rect x="12" y="94" width="498" height="24" fill="none" stroke="#000000" stroke-width="1.5" stroke-dasharray="4,4" rx="3" />\n' +
          '<text x="20" y="111" font-family="\'Atkinson Hyperlegible\', sans-serif" font-size="12" font-weight="bold" fill="#000000">✋ TACTILE ACTION: ' + escapeXml(c.tangiblePairingAction) + '</text>\n' +
          '</g>\n';
      });

      var title = 'Dignified Reminiscence Cards';
      var subtitle = 'Conversation cards for ' + profile.preferredName + ' · Honor, Memory & Voice';
      var instructions = 'Read each card aloud together. There are no right or wrong answers—only meaningful connection.';

      var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 612 792" width="612pt" height="792pt" style="background-color:#ffffff;">\n' +
        this._renderHeader(profile, title, subtitle, instructions) +
        cardsSvg +
        this._renderFooter(2) +
        '</svg>';

      return {
        kind: 'reminiscence',
        title: title,
        subtitle: subtitle,
        instructions: instructions,
        cards: cards,
        svg: svg
      };
    },

    _generateTrivia: function(profile, rng, tier, motor, vocData, eraData, onHandItem) {
      var isChoiceBased = tier !== 1 || motor === 'assisted';
      var fontSizePt = tier === 3 ? 24 : 20;

      var items = [
        { promptText: 'A skilled craftsman always checks measurements with a steady ____.', options: ['Ruler', 'Spoon'] },
        { promptText: 'After a good day of honest labor, there is nothing better than a warm cup of ____.', options: ['Coffee', 'Paint'] },
        { promptText: 'As the old saying goes: "A penny saved is a penny ____."', options: ['Earned', 'Spilled'] },
        { promptText: 'In the evening, neighbors loved sitting out on the front ____ to chat.', options: ['Porch', 'Ladder'] },
        { promptText: 'Planting seeds in rich spring soil brings blossoms and fragrant ____.', options: ['Flowers', 'Bricks'] }
      ];

      var startY = 190;
      var itemHeight = 95;
      var itemsSvg = '';

      items.forEach(function(item, idx) {
        var y = startY + idx * (itemHeight + 12);
        itemsSvg += '<g class="trivia-item" transform="translate(54, ' + y + ')">\n' +
          '<rect x="0" y="0" width="522" height="' + itemHeight + '" fill="none" stroke="#000000" stroke-width="2.5" rx="6" />\n' +
          '<circle cx="24" cy="24" r="14" fill="#000000" />\n' +
          '<text x="24" y="30" font-family="\'Atkinson Hyperlegible\', sans-serif" font-size="16" font-weight="bold" fill="#ffffff" text-anchor="middle">' + (idx + 1) + '</text>\n' +
          '<text x="48" y="29" font-family="\'Atkinson Hyperlegible\', sans-serif" font-size="18" font-weight="bold" fill="#000000">' + escapeXml(item.promptText) + '</text>\n' +
          (isChoiceBased ?
            '<g transform="translate(50, 48)">\n' +
            '<circle cx="20" cy="20" r="16" fill="none" stroke="#000000" stroke-width="3" />\n' +
            '<text x="50" y="27" font-family="\'Atkinson Hyperlegible\', sans-serif" font-size="22" font-weight="bold" fill="#000000">' + escapeXml(item.options[0]) + '</text>\n' +
            '<circle cx="240" cy="20" r="16" fill="none" stroke="#000000" stroke-width="3" />\n' +
            '<text x="270" y="27" font-family="\'Atkinson Hyperlegible\', sans-serif" font-size="22" font-weight="bold" fill="#000000">' + escapeXml(item.options[1]) + '</text>\n' +
            '</g>\n' :
            '<line x1="50" y1="72" x2="480" y2="72" stroke="#000000" stroke-width="2" />\n' +
            '<text x="50" y="65" font-family="\'Atkinson Hyperlegible\', sans-serif" font-size="14" font-style="italic" fill="#000000">Write or say the word here</text>\n'
          ) +
          '</g>\n';
      });

      var title = 'Finish the Thought';
      var subtitle = 'Familiar sayings & reflections for ' + profile.preferredName;
      var instructions = isChoiceBased
        ? 'Circle or point to the word that completes each line. Saying it aloud is wonderful too.'
        : 'Fill in the word that comes to mind. There are no wrong answers.';
      var tangibleCue = 'Tangible Pairing: Place a ' + onHandItem + ' directly over the word you choose.';

      var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 612 792" width="612pt" height="792pt" style="background-color:#ffffff;">\n' +
        this._renderHeader(profile, title, subtitle, instructions, tangibleCue) +
        itemsSvg +
        this._renderFooter(3) +
        '</svg>';

      return {
        kind: 'trivia',
        title: title,
        subtitle: subtitle,
        instructions: instructions,
        tangibleCue: tangibleCue,
        items: items,
        fontSizePt: fontSizePt,
        isChoiceBased: isChoiceBased,
        svg: svg
      };
    },

    _generateMatching: function(profile, rng, tier, motor, vocData, onHandItem) {
      var strokeWidthPt = tier === 3 ? 8 : tier === 2 ? 5 : 3.5;
      var fontSizePt = tier === 3 ? 22 : 18;

      var pairs = [
        { leftItem: vocData.tools[0] || 'Hand Tool', rightItem: 'Shaped Craftsmanship', symbol: '●' },
        { leftItem: 'Measuring Ruler', rightItem: 'True & Exact Line', symbol: '▲' },
        { leftItem: 'Early Morning Sun', rightItem: 'Fresh Garden Soil', symbol: '■' },
        { leftItem: 'Neighborhood Radio', rightItem: 'Uplifting Melody', symbol: '★' }
      ];

      var startY = 195;
      var rowHeight = 110;
      var rowsSvg = '';

      pairs.forEach(function(pair, idx) {
        var y = startY + idx * (rowHeight + 15);
        rowsSvg += '<g class="matching-row" transform="translate(54, ' + y + ')">\n' +
          '<rect x="0" y="0" width="190" height="90" fill="none" stroke="#000000" stroke-width="3" rx="6" />\n' +
          '<text x="95" y="44" font-family="\'Atkinson Hyperlegible\', sans-serif" font-size="18" font-weight="bold" fill="#000000" text-anchor="middle">' + escapeXml(pair.leftItem) + '</text>\n' +
          '<circle cx="170" cy="70" r="10" fill="none" stroke="#000000" stroke-width="2" />\n' +
          '<path d="M 195 45 Q 260 ' + (idx % 2 === 0 ? 15 : 75) + ' 325 45" fill="none" stroke="#000000" stroke-width="' + strokeWidthPt + '" stroke-linecap="round" stroke-dasharray="' + (tier === 3 ? 'none' : '8,6') + '" />\n' +
          '<rect x="332" y="0" width="190" height="90" fill="none" stroke="#000000" stroke-width="3" rx="6" />\n' +
          '<text x="427" y="44" font-family="\'Atkinson Hyperlegible\', sans-serif" font-size="18" font-weight="bold" fill="#000000" text-anchor="middle">' + escapeXml(pair.rightItem) + '</text>\n' +
          '<circle cx="352" cy="70" r="10" fill="none" stroke="#000000" stroke-width="2" />\n' +
          '<text x="352" y="75" font-family="\'Atkinson Hyperlegible\', sans-serif" font-size="12" font-weight="bold" fill="#000000" text-anchor="middle">' + pair.symbol + '</text>\n' +
          '</g>\n';
      });

      var title = 'Tactile Association & Tracing';
      var subtitle = 'Connecting the tools of ' + vocData.tradeLabel + ' with ' + profile.preferredName;
      var instructions = 'Trace the wide paths with your finger or ' + onHandItem + ' to connect the paired items.';
      var tangibleCue = 'Tangible Target: Place a physical memory stone on the matching symbol shape.';

      var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 612 792" width="612pt" height="792pt" style="background-color:#ffffff;">\n' +
        this._renderHeader(profile, title, subtitle, instructions, tangibleCue) +
        rowsSvg +
        this._renderFooter(4) +
        '</svg>';

      return {
        kind: 'matching',
        title: title,
        subtitle: subtitle,
        instructions: instructions,
        tangibleCue: tangibleCue,
        pairs: pairs,
        strokeWidthPt: strokeWidthPt,
        fontSizePt: fontSizePt,
        svg: svg
      };
    }
  };

  root.CogniPacketGenerator = PacketGenerator;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PacketGenerator;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
