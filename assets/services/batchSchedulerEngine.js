/**
 * @file batchSchedulerEngine.js
 * @description Client-side browser service for Cognicopia Bulk Facility Batch Scheduler.
 * Generates vector SVG pages and compiles multi-resident printable PDFs via window.jspdf.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    var exp = factory();
    module.exports = exp;
    module.exports.default = exp;
  } else {
    root.CogniBatchScheduler = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var THEMES = [
    {
      id: 'spring_gardening',
      title: 'Spring Gardening & Farm Life',
      subtitle: 'Heirloom seeds, morning dew, rich soil, and porch flowers',
      icon: '🌱',
      description: 'Awakens memories of planting early vegetables, tending flower beds, turning sweet soil, and listening to songbirds after winter.',
      era: '1950s',
      tactileCue: 'Heirloom seed packet, smooth garden stone, or sprig of rosemary',
      words: ['GARDEN', 'TROWEL', 'SEEDLING', 'PETUNIA', 'ORCHARD', 'CARROT', 'RHUBARB', 'LILAC', 'SUNSHINE', 'TRACTOR', 'TOMATO', 'BLOSSOM'],
      prompts: [
        { q: 'Tell me about the first thing you planted when spring arrived.', sub: 'Did you prefer sweet peas, bright red tomatoes, or crisp snap beans?', act: 'Hold and feel the texture of an heirloom seed envelope.' },
        { q: 'What was your favorite flower to see blooming beside the front walkway?', sub: 'Did your porch or yard have fragrant purple lilacs or climbing roses?', act: 'Trace the petals of a flower outline with your finger.' },
        { q: 'How did the kitchen smell when fresh rhubarb or strawberries were brought indoors?', sub: 'Did anyone bake a warm cobbler with cream?', act: 'Breathe in deeply and picture fresh spring rain on the grass.' }
      ],
      trivia: [
        { q: 'Which flower is known as a favorite herald of early spring?', opts: ['Yellow Daffodil', 'Sunflower'] },
        { q: 'What tool is commonly used to gently loosen soil around tender young roots?', opts: ['Hand Trowel', 'Sledgehammer'] },
        { q: 'Finish the classic rhyme: "April showers bring May..."', opts: ['Flowers', 'Snowdrifts'] }
      ],
      matching: [
        { l: 'Seed Packet', r: 'Trowel & Furrow', s: '🌱' },
        { l: 'Sweet Corn', r: 'Butter & Salt', s: '🌽' },
        { l: 'Purple Lilac', r: 'Kitchen Table Vase', s: '🌸' },
        { l: 'Farm Tractor', r: 'Morning Chores', s: '🚜' }
      ]
    },
    {
      id: 'mid_century_nostalgia',
      title: 'Mid-Century Nostalgia & Big Band',
      subtitle: 'Chrome diners, jukebox singles, swing dance halls, and radio serials',
      icon: '🎷',
      description: 'Evokes the optimism of the 1940s and 1950s: Saturday night dances, soda fountains, classic convertible sedans, and big band melodies.',
      era: '1950s',
      tactileCue: 'Vintage 45 RPM adapter, polished chrome spoon, or smooth diner coaster',
      words: ['JUKEBOX', 'RECORDS', 'TROMBONE', 'CHROME', 'SODA', 'GLENN', 'MILLER', 'SWING', 'DANCING', 'MELODY', 'RADIO', 'CADILLAC'],
      prompts: [
        { q: 'Do you remember stepping onto the ballroom dance floor on Saturday night?', sub: 'Did the orchestra play "In the Mood" or "Moonlight Serenade"?', act: 'Tap your hand in rhythm to a classic swing beat.' },
        { q: 'What was your favorite order at the corner drugstore soda fountain?', sub: 'Did you enjoy an ice cream malt, a cherry cola, or a root beer float?', act: 'Hold a polished silver spoon and imagine cold vanilla ice cream.' },
        { q: 'Who gathered around the console radio in the living room in the evening?', sub: 'Which comedy show or music broadcast did you never want to miss?', act: 'Picture the warm amber glow of a vacuum-tube dial.' }
      ],
      trivia: [
        { q: 'Which famous bandleader led the orchestra that played "Moonlight Serenade"?', opts: ['Glenn Miller', 'Elvis Presley'] },
        { q: 'What did teenagers drop a nickel into to choose a song in a diner?', opts: ['Jukebox', 'Typewriter'] },
        { q: 'What cold treat was made with root beer and scoops of vanilla ice cream?', opts: ['Root Beer Float', 'Hot Cocoa'] }
      ],
      matching: [
        { l: 'Brass Trombone', r: 'Swing Band', s: '🎺' },
        { l: 'Soda Fountain', r: 'Cherry Phosphate', s: '🥤' },
        { l: 'Console Radio', r: 'Evening Serials', s: '📻' },
        { l: 'Dance Floor', r: 'Ballroom Waltz', s: '💃' }
      ]
    },
    {
      id: 'railroad_craftsman',
      title: 'Railroad, Timber & Craftsman Era',
      subtitle: 'Steam engines, hand planes, roundhouses, and honest workshop pride',
      icon: '🚂',
      description: 'Celebrates the historical dignity of American trade workers: machinists, carpenters, railroad engineers, and craftsmen who built with their hands.',
      era: '1940s',
      tactileCue: 'Smooth piece of sanded cedar, brass screw, or pocket spirit level',
      words: ['LOCOMOTIVE', 'ROUNDHOUSE', 'TIMBER', 'CARPENTER', 'ENGINEER', 'BOILER', 'RAILROAD', 'ANVIL', 'TOOLBOX', 'SAWMILL', 'CHISEL', 'HAMMER'],
      prompts: [
        { q: 'Tell me about the sound of a distant steam train whistle echoing across the hills.', sub: 'Did the evening passenger train roll through town right around sunset?', act: 'Listen in your mind to the rhythmic chug-chug of the engine.' },
        { q: 'What was your favorite tool in the workshop that felt perfectly balanced in your hands?', sub: 'Was it a trusty wooden hand plane, a steel framing square, or an oilstone?', act: 'Run your fingertips over a piece of smooth, sanded cedar wood.' },
        { q: 'What was something you built or repaired that you were truly proud of?', sub: 'Did it last for decades of honest, sturdy use?', act: 'Make the motion of turning a wrench or sighting down a straight board.' }
      ],
      trivia: [
        { q: 'What powered the mighty steam locomotives of the mid-twentieth century?', opts: ['Steam & Coal', 'Solar Panels'] },
        { q: 'What carpenter tool has a bubble in a small vial to check if a board is straight?', opts: ['Spirit Level', 'Paintbrush'] },
        { q: 'Finish the craftsman motto: "Measure twice, cut..."', opts: ['Once', 'Never'] }
      ],
      matching: [
        { l: 'Steam Whistle', r: 'Train Depot', s: '🚂' },
        { l: 'Hand Plane', r: 'Wood Shavings', s: '🪵' },
        { l: 'Steel Anvil', r: 'Blacksmith Forge', s: '🔨' },
        { l: 'Engineer Cap', r: 'Locomotive Cab', s: '🧢' }
      ]
    },
    {
      id: 'hometown_kitchen',
      title: 'Hometown Kitchen & Family Recipes',
      subtitle: 'Cast iron skillets, Sunday roasts, freshly baked bread, and pantry jams',
      icon: '🥧',
      description: 'Centers on the warmth of the family kitchen: gathering around the table, rolling out pie dough, simmering savory soups, and canning fruit.',
      era: '1950s',
      tactileCue: 'Wooden rolling pin miniature, cloth napkin, or cinnamon stick',
      words: ['RECIPE', 'SKILLET', 'CINNAMON', 'BISCUITS', 'PANTRY', 'SUNDAY', 'ROAST', 'KITCHEN', 'ROLLING', 'APRON', 'MASON', 'BUTTER'],
      prompts: [
        { q: 'What was the first thing you could smell when you walked into the house on Sunday morning?', sub: 'Was it roasting chicken, hot buttermilk biscuits, or brewing coffee?', act: 'Imagine the warmth of the kitchen stove on a crisp morning.' },
        { q: 'Did your family have a secret recipe that everyone asked for at potlucks?', sub: 'Was it Grandma’s apple pie, potato salad, or homemade peach jam?', act: 'Hold and smell a real cinnamon stick or piece of vanilla bean.' },
        { q: 'Who stood beside you at the kitchen counter while you rolled out dough or stirred the pot?', sub: 'Did they wear a favorite floral apron with deep pockets?', act: 'Trace circles on the table as if gently kneading bread dough.' }
      ],
      trivia: [
        { q: 'What heavy black cookware is famous for making the crispiest fried chicken?', opts: ['Cast Iron Skillet', 'Tin Can'] },
        { q: 'What sweet spice is traditionally sprinkled generously on warm apple pie?', opts: ['Cinnamon', 'Black Pepper'] },
        { q: 'What glass jars with zinc lids were used in every summer pantry for preserving peaches?', opts: ['Mason Jars', 'Plastic Bags'] }
      ],
      matching: [
        { l: 'Rolling Pin', r: 'Pie Crust', s: '🥧' },
        { l: 'Cast Iron Skillet', r: 'Sunday Dinner', s: '🍳' },
        { l: 'Mason Jar', r: 'Strawberry Jam', s: '🍓' },
        { l: 'Kitchen Apron', r: 'Baking Flour', s: '🥖' }
      ]
    },
    {
      id: 'patriotic_outdoors',
      title: 'Patriotic Milestones & Great Outdoors',
      subtitle: 'National parks, pine forests, starry skies, parades, and campfires',
      icon: '🌲',
      description: 'Evokes memories of family road trips to national parks, 4th of July parades, trout streams, campfire songs, and star-filled night skies.',
      era: '1950s',
      tactileCue: 'Polished river stone, miniature felt pennant, or small pine cone',
      words: ['FOREST', 'CAMPFIRE', 'PARADE', 'PATRIOTIC', 'STARS', 'MOUNTAIN', 'STREAM', 'YELLOWSTONE', 'PINEWOOD', 'COMPASS', 'CANOE', 'SUNSET'],
      prompts: [
        { q: 'Tell me about watching the town parade march down Main Street on a summer morning.', sub: 'Did the high school marching band wear bright uniforms with brass trumpets?', act: 'Tap your hand to the beat of a marching drum.' },
        { q: 'Do you remember sitting around an evening campfire as the stars came out?', sub: 'Did anyone play a harmonica or roast marshmallows on sticks?', act: 'Hold a smooth river rock warmed by the sun.' },
        { q: 'What was your favorite scenic trip through the mountains or by the lake?', sub: 'Did you pack sandwiches in a metal cooler in the trunk of the car?', act: 'Take a deep breath and picture the scent of fresh evergreen pine.' }
      ],
      trivia: [
        { q: 'Which famous national park is renowned for the geyser Old Faithful?', opts: ['Yellowstone', 'Times Square'] },
        { q: 'What instrument is traditionally played at sunset in camp or military service for Taps?', opts: ['Bugle', 'Bagpipes'] },
        { q: 'What bird with a bright red breast was celebrated as a sign of outdoor season?', opts: ['American Robin', 'Penguin'] }
      ],
      matching: [
        { l: 'Old Faithful', r: 'Yellowstone Park', s: '🌋' },
        { l: 'Campfire', r: 'Pine Woods', s: '🔥' },
        { l: 'Parade March', r: 'Brass Band', s: '🎺' },
        { l: 'Canoe Paddle', r: 'Quiet Lake', s: '🛶' }
      ]
    },
    {
      id: 'autumn_hearth',
      title: 'Autumn Harvest & Hearthside Reminiscence',
      subtitle: 'Cider pressing, warm patchwork quilts, woodstoves, and county fairs',
      icon: '🍂',
      description: 'Celebrates crisp autumn days: apple orchards, colorful maple leaves, blue-ribbon county fair exhibits, and sitting by a crackling fire.',
      era: '1950s',
      tactileCue: 'Preserved autumn maple leaf, woven wool yarn, or dried apple slice',
      words: ['HARVEST', 'ORCHARD', 'CIDER', 'PUMPKIN', 'QUILTING', 'AUTUMN', 'WOODSTOVE', 'MAPLE', 'HEARTH', 'FROST', 'COUNTY', 'RIBBON'],
      prompts: [
        { q: 'What was it like walking through an apple orchard on a crisp October morning?', sub: 'Did you press fresh sweet cider or pick bushel baskets of Macintoshes?', act: 'Picture the sweet, tangy aroma of pressed apple cider.' },
        { q: 'Did your family attend the annual county fair with its carnival rides and livestock barns?', sub: 'Did anyone enter a prized quilt, giant pumpkin, or blackberry jam for a blue ribbon?', act: 'Trace the textured stitching of a patchwork quilt.' },
        { q: 'How did it feel to warm your hands by the woodstove after raking leaves outdoors?', sub: 'Did the leaves crunch beneath your boots as you walked?', act: 'Hold your hands open toward warmth and remember cozy wool socks.' }
      ],
      trivia: [
        { q: 'What warm drink is pressed from freshly harvested autumn apples?', opts: ['Apple Cider', 'Iced Tea'] },
        { q: 'What color ribbon is traditionally awarded for First Place at the County Fair?', opts: ['Blue Ribbon', 'Green Ribbon'] },
        { q: 'What warm, heavy blanket is made by sewing together colorful fabric squares?', opts: ['Patchwork Quilt', 'Window Curtain'] }
      ],
      matching: [
        { l: 'Apple Orchard', r: 'Sweet Cider', s: '🍎' },
        { l: 'Patchwork Quilt', r: 'Hearthside Stove', s: '🧵' },
        { l: 'County Fair', r: 'Blue Ribbon', s: '🏅' },
        { l: 'Maple Leaf', r: 'Autumn Frost', s: '🍁' }
      ]
    }
  ];

  function escapeXml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function renderHeader(resident, title, subtitle, instructions, cue) {
    var name = resident.preferredName || 'Resident';
    var wing = resident.wing || 'Memory Care';
    var unit = resident.unitNumber ? 'Rm ' + resident.unitNumber : '';

    return [
      '<!-- Binding Gutter & Border -->',
      '<rect x="36" y="36" width="540" height="720" fill="none" stroke="#000000" stroke-width="3" rx="4" />',
      '<g class="header" transform="translate(54, 54)">',
      '  <text x="0" y="16" font-family="sans-serif" font-size="11" font-weight="bold" fill="#000000" letter-spacing="1">PERSONALIZED ACTIVITY PACKET PREPARED FOR ' + escapeXml(name.toUpperCase()) + ' • ' + escapeXml(wing) + ' ' + escapeXml(unit) + '</text>',
      '  <line x1="0" y1="26" x2="504" y2="26" stroke="#000000" stroke-width="2" />',
      '  <text x="0" y="54" font-family="sans-serif" font-size="24" font-weight="bold" fill="#000000">' + escapeXml(title) + '</text>',
      '  <text x="0" y="76" font-family="sans-serif" font-size="15" font-style="italic" fill="#000000">' + escapeXml(subtitle) + '</text>',
      cue ? '  <rect x="0" y="86" width="504" height="26" fill="#000000" rx="3" /><text x="10" y="103" font-family="sans-serif" font-size="12" font-weight="bold" fill="#ffffff">✋ TACTILE PAIRING: ' + escapeXml(cue.toUpperCase()) + '</text>' : '',
      '</g>'
    ].join('\n');
  }

  function renderFooter(pgNum) {
    return [
      '<g class="footer" transform="translate(54, 735)">',
      '  <line x1="0" y1="0" x2="504" y2="0" stroke="#000000" stroke-width="1.5" />',
      '  <text x="0" y="14" font-family="sans-serif" font-size="10" fill="#000000">Cognicopia Gerontological Standards • 18pt+ Type Floor • 100% Pure Contrast</text>',
      '  <text x="504" y="14" font-family="sans-serif" font-size="10" font-weight="bold" fill="#000000" text-anchor="end">Page ' + pgNum + '</text>',
      '</g>'
    ].join('\n');
  }

  return {
    getThemes: function () {
      return THEMES;
    },

    getTheme: function (id) {
      for (var i = 0; i < THEMES.length; i++) {
        if (THEMES[i].id === id) return THEMES[i];
      }
      return THEMES[0];
    },

    compileCoverPageSvg: function (resident, theme, facilityName, batchTitle) {
      var name = resident.preferredName || 'Resident';
      var wing = resident.wing || 'Memory Care Wing';
      var unit = resident.unitNumber ? 'Room ' + resident.unitNumber : 'Suite';
      var voc = resident.pastVocation || 'Lifelong Craftsman';
      var tier = resident.cognitiveTier || 2;
      var dateStr = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

      return [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 612 792" width="612pt" height="792pt" style="background-color:#ffffff;">',
        '  <rect x="36" y="36" width="540" height="720" fill="none" stroke="#000000" stroke-width="4" rx="8" />',
        '  <rect x="42" y="42" width="528" height="708" fill="none" stroke="#000000" stroke-width="1.5" rx="4" />',
        '  <text x="306" y="90" font-family="sans-serif" font-size="14" font-weight="bold" fill="#000000" text-anchor="middle" letter-spacing="2">' + escapeXml((facilityName || 'COGNICOPIA').toUpperCase()) + '</text>',
        '  <text x="306" y="110" font-family="sans-serif" font-size="11" fill="#000000" text-anchor="middle">INDIVIDUALIZED MEMORY CARE SERIES • ' + escapeXml((batchTitle || 'MONTHLY CURRICULUM').toUpperCase()) + '</text>',
        '  <line x1="80" y1="130" x2="532" y2="130" stroke="#000000" stroke-width="2.5" />',
        '  <circle cx="306" cy="130" r="6" fill="#000000" />',
        '  <rect x="70" y="165" width="472" height="150" fill="#ffffff" stroke="#000000" stroke-width="3" rx="6" />',
        '  <rect x="70" y="165" width="472" height="32" fill="#000000" rx="3" />',
        '  <text x="306" y="187" font-family="sans-serif" font-size="14" font-weight="bold" fill="#ffffff" text-anchor="middle" letter-spacing="1.5">PERSONALIZED COGNITIVE PACKET PREPARED FOR</text>',
        '  <text x="306" y="240" font-family="sans-serif" font-size="34" font-weight="bold" fill="#000000" text-anchor="middle">' + escapeXml(name) + '</text>',
        '  <text x="306" y="270" font-family="sans-serif" font-size="16" font-style="italic" fill="#000000" text-anchor="middle">' + escapeXml(wing) + ' • ' + escapeXml(unit) + '</text>',
        '  <text x="306" y="295" font-family="sans-serif" font-size="13" font-weight="bold" fill="#000000" text-anchor="middle">Vocational Dignity: ' + escapeXml(voc) + '</text>',
        '  <rect x="70" y="340" width="472" height="180" fill="none" stroke="#000000" stroke-width="2" stroke-dasharray="6,4" rx="6" />',
        '  <text x="96" y="375" font-family="sans-serif" font-size="13" font-weight="bold" fill="#000000" letter-spacing="1">MONTHLY CURRICULUM THEME:</text>',
        '  <text x="96" y="410" font-family="sans-serif" font-size="22" font-weight="bold" fill="#000000">' + escapeXml(theme.title) + '</text>',
        '  <g transform="translate(96, 435)">',
        '    <circle cx="8" cy="8" r="5" fill="#000000" />',
        '    <text x="24" y="12" font-family="sans-serif" font-size="13" font-weight="bold" fill="#000000">Clinical Bandwidth: Cognitive Tier ' + tier + ' (Large 18pt+ Type Floor)</text>',
        '    <circle cx="8" cy="36" r="5" fill="#000000" />',
        '    <text x="24" y="40" font-family="sans-serif" font-size="13" font-weight="bold" fill="#000000">Motor Guidance: ' + (resident.motorCapabilityLevel === 'assisted' ? 'Assisted (Bold Tracing Channels)' : 'Standard High-Contrast Stroke') + '</text>',
        '    <circle cx="8" cy="64" r="5" fill="#000000" />',
        '    <text x="24" y="68" font-family="sans-serif" font-size="13" font-weight="bold" fill="#000000">Tangible Item Pairing: ' + escapeXml(theme.tactileCue) + '</text>',
        '  </g>',
        '  <rect x="70" y="540" width="472" height="140" fill="#ffffff" stroke="#000000" stroke-width="2" rx="6" />',
        '  <text x="96" y="570" font-family="sans-serif" font-size="14" font-weight="bold" fill="#000000">FACILITY ACTIVITIES INSTRUCTIONS:</text>',
        '  <text x="96" y="596" font-family="sans-serif" font-size="12" fill="#000000">1. Calibrated for 1-on-1 engagement or calm morning table reminiscing.</text>',
        '  <text x="96" y="618" font-family="sans-serif" font-size="12" fill="#000000">2. No wrong answers. Encourage tactile touching and autobiographical stories.</text>',
        '  <text x="96" y="640" font-family="sans-serif" font-size="12" fill="#000000">3. Hand prompts gently to ' + escapeXml(resident.nickname || name) + ' alongside tactile tokens or pencils.</text>',
        '  <text x="96" y="662" font-family="sans-serif" font-size="12" font-weight="bold" fill="#000000">4. Archive completed worksheets in resident Life Story Album.</text>',
        '  <text x="306" y="730" font-family="sans-serif" font-size="10" fill="#000000" text-anchor="middle">Cognicopia • Clinical-Grade Gerontological Activity Architecture • ' + escapeXml(dateStr) + '</text>',
        '</svg>'
      ].join('\n');
    },

    compileWordSearchSvg: function (resident, theme) {
      var tier = resident.cognitiveTier || 2;
      var gridSize = (tier === 3) ? 6 : (tier === 2 ? 8 : 10);
      var words = theme.words.slice(0, tier === 3 ? 4 : (tier === 2 ? 6 : 8));

      // Deterministic letters grid
      var sampleGrid = [
        ['G', 'A', 'R', 'D', 'E', 'N', 'S', 'O', 'I', 'L'],
        ['T', 'R', 'O', 'W', 'E', 'L', 'F', 'A', 'R', 'M'],
        ['S', 'E', 'E', 'D', 'L', 'I', 'N', 'G', 'P', 'O'],
        ['P', 'E', 'T', 'U', 'N', 'I', 'A', 'B', 'E', 'D'],
        ['O', 'R', 'C', 'H', 'A', 'R', 'D', 'M', 'A', 'Y'],
        ['C', 'A', 'R', 'R', 'O', 'T', 'L', 'I', 'L', 'A'],
        ['R', 'H', 'U', 'B', 'A', 'R', 'B', 'S', 'U', 'N'],
        ['S', 'U', 'N', 'S', 'H', 'I', 'N', 'E', 'D', 'E'],
        ['T', 'R', 'A', 'C', 'T', 'O', 'R', 'H', 'O', 'E'],
        ['B', 'L', 'O', 'S', 'S', 'O', 'M', 'D', 'E', 'W']
      ];

      var cellSize = Math.floor(400 / gridSize);
      var startX = 54 + Math.floor((504 - (cellSize * gridSize)) / 2);
      var startY = 210;

      var cellsSvg = '';
      for (var r = 0; r < gridSize; r++) {
        for (var c = 0; c < gridSize; c++) {
          var letter = sampleGrid[r % 10][c % 10];
          var x = startX + c * cellSize;
          var y = startY + r * cellSize;
          cellsSvg += '<rect x="' + x + '" y="' + y + '" width="' + cellSize + '" height="' + cellSize + '" fill="none" stroke="#000000" stroke-width="2" />\n';
          cellsSvg += '<text x="' + (x + cellSize / 2) + '" y="' + (y + cellSize * 0.7) + '" font-family="sans-serif" font-size="' + (cellSize * 0.55) + '" font-weight="bold" fill="#000000" text-anchor="middle">' + letter + '</text>\n';
        }
      }

      var wordBankSvg = '<g transform="translate(54, ' + (startY + gridSize * cellSize + 24) + ')">';
      wordBankSvg += '<text x="0" y="0" font-family="sans-serif" font-size="14" font-weight="bold" fill="#000000">FIND THESE FAMILIAR WORDS (Check off each as you spot it):</text>';
      for (var i = 0; i < words.length; i++) {
        var col = i % 3;
        var row = Math.floor(i / 3);
        var wx = col * 170;
        var wy = 24 + row * 26;
        wordBankSvg += '<rect x="' + wx + '" y="' + (wy - 14) + '" width="18" height="18" fill="none" stroke="#000000" stroke-width="2" rx="3" />';
        wordBankSvg += '<text x="' + (wx + 26) + '" y="' + wy + '" font-family="sans-serif" font-size="16" font-weight="bold" fill="#000000">' + words[i] + '</text>';
      }
      wordBankSvg += '</g>';

      return [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 612 792" width="612pt" height="792pt" style="background-color:#ffffff;">',
        renderHeader(resident, theme.title + ' Word Search', 'High-Contrast Large-Print Cognitive Grid', 'Circle each word forward horizontally or vertically.', theme.tactileCue),
        cellsSvg,
        wordBankSvg,
        renderFooter(1),
        '</svg>'
      ].join('\n');
    },

    compileReminiscenceSvg: function (resident, theme) {
      var cards = theme.prompts;
      var cardsSvg = '';
      var startY = 190;

      for (var i = 0; i < cards.length; i++) {
        var y = startY + i * 165;
        cardsSvg += [
          '<g transform="translate(54, ' + y + ')">',
          '  <rect x="0" y="0" width="504" height="150" fill="#ffffff" stroke="#000000" stroke-width="3" rx="6" />',
          '  <rect x="0" y="0" width="220" height="26" fill="#000000" rx="3" />',
          '  <text x="12" y="18" font-family="sans-serif" font-size="12" font-weight="bold" fill="#ffffff">REMINISCENCE CONVERSATION #' + (i + 1) + '</text>',
          '  <text x="16" y="56" font-family="sans-serif" font-size="18" font-weight="bold" fill="#000000">' + escapeXml(cards[i].q) + '</text>',
          '  <text x="16" y="86" font-family="sans-serif" font-size="15" font-style="italic" fill="#000000">✦ Care Partner Follow-Up: "' + escapeXml(cards[i].sub) + '"</text>',
          '  <rect x="12" y="108" width="480" height="28" fill="none" stroke="#000000" stroke-width="1.5" stroke-dasharray="4,4" rx="3" />',
          '  <text x="20" y="126" font-family="sans-serif" font-size="12" font-weight="bold" fill="#000000">✋ SENSORY ACTION: ' + escapeXml(cards[i].act) + '</text>',
          '</g>'
        ].join('\n');
      }

      return [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 612 792" width="612pt" height="792pt" style="background-color:#ffffff;">',
        renderHeader(resident, theme.title + ' Memories', 'Meaningful Reminiscence Invitations for 1-on-1 Conversation', '', theme.tactileCue),
        cardsSvg,
        renderFooter(2),
        '</svg>'
      ].join('\n');
    },

    compileTriviaSvg: function (resident, theme) {
      var items = theme.trivia;
      var itemsSvg = '';
      var startY = 190;

      for (var i = 0; i < items.length; i++) {
        var y = startY + i * 155;
        itemsSvg += [
          '<g transform="translate(54, ' + y + ')">',
          '  <rect x="0" y="0" width="504" height="135" fill="none" stroke="#000000" stroke-width="2.5" rx="6" />',
          '  <circle cx="26" cy="28" r="14" fill="#000000" />',
          '  <text x="26" y="34" font-family="sans-serif" font-size="16" font-weight="bold" fill="#ffffff" text-anchor="middle">' + (i + 1) + '</text>',
          '  <text x="52" y="34" font-family="sans-serif" font-size="18" font-weight="bold" fill="#000000">' + escapeXml(items[i].q) + '</text>',
          '  <g transform="translate(52, 60)">',
          '    <circle cx="18" cy="24" r="16" fill="none" stroke="#000000" stroke-width="3" />',
          '    <text x="46" y="30" font-family="sans-serif" font-size="20" font-weight="bold" fill="#000000">' + escapeXml(items[i].opts[0]) + '</text>',
          '    <circle cx="260" cy="24" r="16" fill="none" stroke="#000000" stroke-width="3" />',
          '    <text x="288" y="30" font-family="sans-serif" font-size="20" font-weight="bold" fill="#000000">' + escapeXml(items[i].opts[1]) + '</text>',
          '  </g>',
          '</g>'
        ].join('\n');
      }

      return [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 612 792" width="612pt" height="792pt" style="background-color:#ffffff;">',
        renderHeader(resident, theme.title + ' Trivia &amp; Recall', 'High-Contrast Two-Choice Sensory Selection Targets', 'Touch or circle the answer that feels right.', theme.tactileCue),
        itemsSvg,
        renderFooter(3),
        '</svg>'
      ].join('\n');
    },

    compileMatchingSvg: function (resident, theme) {
      var pairs = theme.matching;
      var rowsSvg = '';
      var startY = 195;

      for (var i = 0; i < pairs.length; i++) {
        var y = startY + i * 125;
        rowsSvg += [
          '<g transform="translate(54, ' + y + ')">',
          '  <rect x="0" y="0" width="180" height="95" fill="none" stroke="#000000" stroke-width="3" rx="6" />',
          '  <text x="90" y="52" font-family="sans-serif" font-size="18" font-weight="bold" fill="#000000" text-anchor="middle">' + escapeXml(pairs[i].l) + '</text>',
          '  <circle cx="160" cy="74" r="10" fill="none" stroke="#000000" stroke-width="2" />',
          '  <path d="M 185 48 Q 250 ' + (i % 2 === 0 ? 15 : 80) + ' 318 48" fill="none" stroke="#000000" stroke-width="4.5" stroke-linecap="round" stroke-dasharray="8,6" />',
          '  <rect x="324" y="0" width="180" height="95" fill="none" stroke="#000000" stroke-width="3" rx="6" />',
          '  <text x="414" y="52" font-family="sans-serif" font-size="18" font-weight="bold" fill="#000000" text-anchor="middle">' + escapeXml(pairs[i].r) + '</text>',
          '  <circle cx="344" cy="74" r="10" fill="none" stroke="#000000" stroke-width="2" />',
          '  <text x="344" y="79" font-family="sans-serif" font-size="12" font-weight="bold" fill="#000000" text-anchor="middle">' + pairs[i].s + '</text>',
          '</g>'
        ].join('\n');
      }

      return [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 612 792" width="612pt" height="792pt" style="background-color:#ffffff;">',
        renderHeader(resident, theme.title + ' Tactile Tracing &amp; Pairs', 'Guided High-Contrast Motor Stroke Paths', 'Trace along the dashed line with your finger or marker from left to right.', theme.tactileCue),
        rowsSvg,
        renderFooter(4),
        '</svg>'
      ].join('\n');
    },

    compileResidentPacket: function (resident, theme, opts) {
      opts = opts || {};
      var pages = [];

      if (opts.includeCover !== false) {
        pages.push(this.compileCoverPageSvg(resident, theme, opts.facilityName || 'St. Jude Memory Care', opts.batchTitle || 'Monthly Curriculum'));
      }
      if (opts.includeWordSearch !== false) {
        pages.push(this.compileWordSearchSvg(resident, theme));
      }
      if (opts.includeReminiscence !== false) {
        pages.push(this.compileReminiscenceSvg(resident, theme));
      }
      if (opts.includeTrivia !== false) {
        pages.push(this.compileTriviaSvg(resident, theme));
      }
      if (opts.includeMatching !== false) {
        pages.push(this.compileMatchingSvg(resident, theme));
      }

      return pages;
    },

    exportBatchToPdf: function (allSvgPages, fileName) {
      return new Promise(function (resolve) {
        var jsPDF = (typeof window !== 'undefined' && window.jspdf && window.jspdf.jsPDF) ? window.jspdf.jsPDF : null;

        if (jsPDF) {
          var doc = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'portrait', compress: true });

          var processPage = function (idx) {
            if (idx >= allSvgPages.length) {
              resolve(doc.output('blob'));
              return;
            }

            if (idx > 0) doc.addPage('letter', 'portrait');
            var svgStr = allSvgPages[idx];

            var canvas = document.createElement('canvas');
            canvas.width = 612 * 2;
            canvas.height = 792 * 2;
            var ctx = canvas.getContext('2d');

            if (ctx) {
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              var img = new Image();
              var blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
              var url = URL.createObjectURL(blob);

              img.onload = function () {
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                URL.revokeObjectURL(url);
                var imgData = canvas.toDataURL('image/jpeg', 0.95);
                doc.addImage(imgData, 'JPEG', 0, 0, 612, 792, undefined, 'FAST');
                processPage(idx + 1);
              };

              img.onerror = function () {
                URL.revokeObjectURL(url);
                processPage(idx + 1);
              };

              img.src = url;
            } else {
              processPage(idx + 1);
            }
          };

          processPage(0);
        } else {
          // Fallback multi-page HTML printable document
          var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + escapeXml(fileName) + '</title><style>@page{size:letter;margin:0;}body{margin:0;background:#fff;}.page{width:612pt;height:792pt;page-break-after:always;display:block;margin:0 auto;}</style></head><body>' +
            allSvgPages.map(function (s) { return '<div class="page">' + s + '</div>'; }).join('\n') +
            '</body></html>';
          resolve(new Blob([html], { type: 'text/html' }));
        }
      });
    },

    downloadBlob: function (blob, fileName) {
      if (typeof window === 'undefined') return;
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 1000);
    }
  };
});
