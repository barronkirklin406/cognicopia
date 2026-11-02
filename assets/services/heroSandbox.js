/**
 * @file heroSandbox.js
 * @description Zero-latency interactive Live Packet Sandbox for the Cognicopia landing page hero.
 * Generates live Master SVG Vector activity cards in real time as visitors type dummy resident details.
 */
(function() {
  'use strict';

  var activeTab = 'wordSearch';

  var PRESETS = {
    arthur: {
      name: "Arthur 'Artie' Smith",
      hometown: "Williston, ND",
      vocation: "Railroad Machinist & Master Carpenter"
    },
    eleanor: {
      name: "Eleanor Vance",
      hometown: "Savannah, GA",
      vocation: "High School Biology Teacher & Garden Club Leader"
    },
    harold: {
      name: "Harold Miller",
      hometown: "Cedar Rapids, IA",
      vocation: "Jazz Trombonist & Grain Farmer"
    },
    clara: {
      name: "Clara Tremblay",
      hometown: "Portland, ME",
      vocation: "Pediatric Nurse & Master Quilter"
    }
  };

  function escapeXml(unsafe) {
    if (!unsafe) return '';
    return String(unsafe)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function getInputs() {
    var nameEl = document.getElementById('cgHeroName');
    var townEl = document.getElementById('cgHeroHometown');
    var vocEl = document.getElementById('cgHeroVocation');

    var name = (nameEl && nameEl.value.trim()) || 'Arthur';
    var hometown = (townEl && townEl.value.trim()) || 'Williston, ND';
    var vocation = (vocEl && vocEl.value.trim()) || 'Railroad Machinist & Master Carpenter';

    return { name: name, hometown: hometown, vocation: vocation };
  }

  function updateCtaLinks(name, hometown, vocation) {
    var btnNameEl = document.getElementById('cgHeroBtnName');
    if (btnNameEl) {
      btnNameEl.textContent = name;
    }

    var genBtn = document.getElementById('cgHeroGeneratePacketBtn');
    if (genBtn) {
      var targetUrl = 'builder.html?name=' + encodeURIComponent(name) +
        '&hometown=' + encodeURIComponent(hometown) +
        '&vocation=' + encodeURIComponent(vocation);
      genBtn.setAttribute('href', targetUrl);
    }
  }

  function renderFallbackSvg(name, hometown, vocation, tab) {
    var escapedName = escapeXml(name);
    var escapedTown = escapeXml(hometown);
    var escapedVoc = escapeXml(vocation);

    if (tab === 'reminiscence') {
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 612 792" width="100%" height="auto" style="background-color:#ffffff;">' +
        '<rect x="24" y="24" width="564" height="744" fill="none" stroke="#000000" stroke-width="4" />' +
        '<text x="44" y="60" font-family="\'Atkinson Hyperlegible\', sans-serif" font-size="14" font-weight="bold" fill="#000000">COGNICOPIA MEMORY CARE • DIGNIFIED CONVERSATIONAL REMINISCENCE</text>' +
        '<text x="568" y="60" font-family="\'Atkinson Hyperlegible\', sans-serif" font-size="14" font-weight="bold" fill="#000000" text-anchor="end">PAGE 2 OF 50</text>' +
        '<line x1="44" y1="72" x2="568" y2="72" stroke="#000000" stroke-width="2.5" />' +
        '<text x="44" y="112" font-family="\'Atkinson Hyperlegible\', sans-serif" font-size="26" font-weight="bold" fill="#000000">' + escapedName + '’s Life Story &amp; Craft</text>' +
        '<text x="44" y="142" font-family="\'Atkinson Hyperlegible\', sans-serif" font-size="18" fill="#000000">Rooted in ' + escapedTown + ' • Life Work: ' + escapedVoc + '</text>' +
        '<rect x="44" y="170" width="524" height="190" fill="none" stroke="#000000" stroke-width="2.5" rx="8" />' +
        '<text x="64" y="210" font-family="\'Atkinson Hyperlegible\', sans-serif" font-size="20" font-weight="bold" fill="#000000">“Tell us about your workshop back in ' + escapedTown + '.”</text>' +
        '<text x="64" y="246" font-family="\'Atkinson Hyperlegible\', sans-serif" font-size="18" fill="#000000">What tools were always within arm’s reach on your workbench?</text>' +
        '<text x="64" y="280" font-family="\'Atkinson Hyperlegible\', sans-serif" font-size="18" fill="#000000">What did the first morning hours feel like when starting a new project?</text>' +
        '<text x="64" y="324" font-family="\'Atkinson Hyperlegible\', sans-serif" font-size="16" font-style="italic" fill="#000000">Facilitator Cue: Place a tangible memory stone or wooden token in hand.</text>' +
        '<line x1="64" y1="410" x2="548" y2="410" stroke="#000000" stroke-width="2" />' +
        '<line x1="64" y1="460" x2="548" y2="460" stroke="#000000" stroke-width="2" />' +
        '<line x1="64" y1="510" x2="548" y2="510" stroke="#000000" stroke-width="2" />' +
        '<line x1="64" y1="560" x2="548" y2="560" stroke="#000000" stroke-width="2" />' +
        '<text x="44" y="730" font-family="\'Atkinson Hyperlegible\', sans-serif" font-size="13" fill="#000000">Cognicopia Enrichment Activity — 100% Pure Black and White Vector Art — 18pt Floor</text>' +
        '</svg>';
    }

    if (tab === 'matching') {
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 612 792" width="100%" height="auto" style="background-color:#ffffff;">' +
        '<rect x="24" y="24" width="564" height="744" fill="none" stroke="#000000" stroke-width="4" />' +
        '<text x="44" y="60" font-family="\'Atkinson Hyperlegible\', sans-serif" font-size="14" font-weight="bold" fill="#000000">TACTILE ASSOCIATION &amp; GUIDED MOTOR TRACING</text>' +
        '<text x="568" y="60" font-family="\'Atkinson Hyperlegible\', sans-serif" font-size="14" font-weight="bold" fill="#000000" text-anchor="end">PAGE 3 OF 50</text>' +
        '<line x1="44" y1="72" x2="568" y2="72" stroke="#000000" stroke-width="2.5" />' +
        '<text x="44" y="112" font-family="\'Atkinson Hyperlegible\', sans-serif" font-size="24" font-weight="bold" fill="#000000">Tools of ' + escapedName + '’s Craft</text>' +
        '<text x="44" y="140" font-family="\'Atkinson Hyperlegible\', sans-serif" font-size="18" fill="#000000">Trace along the guided path to connect each tool with its trade purpose.</text>' +
        '<g transform="translate(44, 180)">' +
        '  <rect x="0" y="0" width="190" height="90" fill="none" stroke="#000000" stroke-width="3" rx="6" />' +
        '  <text x="95" y="48" font-family="\'Atkinson Hyperlegible\', sans-serif" font-size="20" font-weight="bold" fill="#000000" text-anchor="middle">Hand Plane</text>' +
        '  <circle cx="170" cy="70" r="10" fill="none" stroke="#000000" stroke-width="2" />' +
        '  <path d="M 195 45 Q 260 15 325 45" fill="none" stroke="#000000" stroke-width="5" stroke-dasharray="8,6" />' +
        '  <rect x="332" y="0" width="190" height="90" fill="none" stroke="#000000" stroke-width="3" rx="6" />' +
        '  <text x="427" y="48" font-family="\'Atkinson Hyperlegible\', sans-serif" font-size="20" font-weight="bold" fill="#000000" text-anchor="middle">Cedar Timber</text>' +
        '  <circle cx="352" cy="70" r="10" fill="none" stroke="#000000" stroke-width="2" />' +
        '</g>' +
        '<g transform="translate(44, 310)">' +
        '  <rect x="0" y="0" width="190" height="90" fill="none" stroke="#000000" stroke-width="3" rx="6" />' +
        '  <text x="95" y="48" font-family="\'Atkinson Hyperlegible\', sans-serif" font-size="20" font-weight="bold" fill="#000000" text-anchor="middle">Micrometer</text>' +
        '  <circle cx="170" cy="70" r="10" fill="none" stroke="#000000" stroke-width="2" />' +
        '  <path d="M 195 45 Q 260 75 325 45" fill="none" stroke="#000000" stroke-width="5" stroke-dasharray="8,6" />' +
        '  <rect x="332" y="0" width="190" height="90" fill="none" stroke="#000000" stroke-width="3" rx="6" />' +
        '  <text x="427" y="48" font-family="\'Atkinson Hyperlegible\', sans-serif" font-size="20" font-weight="bold" fill="#000000" text-anchor="middle">Engine Lathe</text>' +
        '  <circle cx="352" cy="70" r="10" fill="none" stroke="#000000" stroke-width="2" />' +
        '</g>' +
        '<g transform="translate(44, 440)">' +
        '  <rect x="0" y="0" width="190" height="90" fill="none" stroke="#000000" stroke-width="3" rx="6" />' +
        '  <text x="95" y="48" font-family="\'Atkinson Hyperlegible\', sans-serif" font-size="20" font-weight="bold" fill="#000000" text-anchor="middle">Depot Whistle</text>' +
        '  <circle cx="170" cy="70" r="10" fill="none" stroke="#000000" stroke-width="2" />' +
        '  <path d="M 195 45 Q 260 15 325 45" fill="none" stroke="#000000" stroke-width="5" stroke-dasharray="8,6" />' +
        '  <rect x="332" y="0" width="190" height="90" fill="none" stroke="#000000" stroke-width="3" rx="6" />' +
        '  <text x="427" y="48" font-family="\'Atkinson Hyperlegible\', sans-serif" font-size="20" font-weight="bold" fill="#000000" text-anchor="middle">' + escapeXml(escapedTown.split(',')[0]) + ' Depot</text>' +
        '  <circle cx="352" cy="70" r="10" fill="none" stroke="#000000" stroke-width="2" />' +
        '</g>' +
        '<text x="44" y="730" font-family="\'Atkinson Hyperlegible\', sans-serif" font-size="13" fill="#000000">Tactile Pairing: Slide a tangible counter or finger across each high-contrast tracing path.</text>' +
        '</svg>';
    }

    // Default: Word Search
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 612 792" width="100%" height="auto" style="background-color:#ffffff;">' +
      '<rect x="24" y="24" width="564" height="744" fill="none" stroke="#000000" stroke-width="4" />' +
      '<text x="44" y="60" font-family="\'Atkinson Hyperlegible\', sans-serif" font-size="14" font-weight="bold" fill="#000000">COGNICOPIA ENRICHMENT ACTIVITY • CLINICAL LARGE-PRINT</text>' +
      '<text x="568" y="60" font-family="\'Atkinson Hyperlegible\', sans-serif" font-size="14" font-weight="bold" fill="#000000" text-anchor="end">PAGE 1 OF 50</text>' +
      '<line x1="44" y1="72" x2="568" y2="72" stroke="#000000" stroke-width="2.5" />' +
      '<text x="44" y="112" font-family="\'Atkinson Hyperlegible\', sans-serif" font-size="26" font-weight="bold" fill="#000000">' + escapedName + ' · ' + escapedTown + '</text>' +
      '<text x="44" y="142" font-family="\'Atkinson Hyperlegible\', sans-serif" font-size="18" fill="#000000">Historical Trade: ' + escapedVoc + '</text>' +
      '<rect x="44" y="160" width="524" height="42" fill="none" stroke="#000000" stroke-width="2" stroke-dasharray="6,4" />' +
      '<text x="56" y="187" font-family="\'Atkinson Hyperlegible\', sans-serif" font-size="18" font-weight="bold" fill="#000000">DIRECTIONS: Find and circle the words from ' + escapedName + '’s craft and roots.</text>' +
      '<g transform="translate(44, 230)">' +
      '  <rect x="0" y="0" width="46" height="46" fill="none" stroke="#000000" stroke-width="2" rx="4"/><text x="23" y="32" font-family="\'Atkinson Hyperlegible\', monospace" font-size="24" font-weight="bold" text-anchor="middle">L</text>' +
      '  <rect x="52" y="0" width="46" height="46" fill="none" stroke="#000000" stroke-width="2" rx="4"/><text x="75" y="32" font-family="\'Atkinson Hyperlegible\', monospace" font-size="24" font-weight="bold" text-anchor="middle">A</text>' +
      '  <rect x="104" y="0" width="46" height="46" fill="none" stroke="#000000" stroke-width="2" rx="4"/><text x="127" y="32" font-family="\'Atkinson Hyperlegible\', monospace" font-size="24" font-weight="bold" text-anchor="middle">T</text>' +
      '  <rect x="156" y="0" width="46" height="46" fill="none" stroke="#000000" stroke-width="2" rx="4"/><text x="179" y="32" font-family="\'Atkinson Hyperlegible\', monospace" font-size="24" font-weight="bold" text-anchor="middle">H</text>' +
      '  <rect x="208" y="0" width="46" height="46" fill="none" stroke="#000000" stroke-width="2" rx="4"/><text x="231" y="32" font-family="\'Atkinson Hyperlegible\', monospace" font-size="24" font-weight="bold" text-anchor="middle">E</text>' +
      '  <rect x="0" y="52" width="46" height="46" fill="none" stroke="#000000" stroke-width="2" rx="4"/><text x="23" y="84" font-family="\'Atkinson Hyperlegible\', monospace" font-size="24" font-weight="bold" text-anchor="middle">T</text>' +
      '  <rect x="52" y="52" width="46" height="46" fill="none" stroke="#000000" stroke-width="2" rx="4"/><text x="75" y="84" font-family="\'Atkinson Hyperlegible\', monospace" font-size="24" font-weight="bold" text-anchor="middle">I</text>' +
      '  <rect x="104" y="52" width="46" height="46" fill="none" stroke="#000000" stroke-width="2" rx="4"/><text x="127" y="84" font-family="\'Atkinson Hyperlegible\', monospace" font-size="24" font-weight="bold" text-anchor="middle">M</text>' +
      '  <rect x="156" y="52" width="46" height="46" fill="none" stroke="#000000" stroke-width="2" rx="4"/><text x="179" y="84" font-family="\'Atkinson Hyperlegible\', monospace" font-size="24" font-weight="bold" text-anchor="middle">B</text>' +
      '  <rect x="208" y="52" width="46" height="46" fill="none" stroke="#000000" stroke-width="2" rx="4"/><text x="231" y="84" font-family="\'Atkinson Hyperlegible\', monospace" font-size="24" font-weight="bold" text-anchor="middle">E</text>' +
      '  <rect x="0" y="104" width="46" height="46" fill="none" stroke="#000000" stroke-width="2" rx="4"/><text x="23" y="136" font-family="\'Atkinson Hyperlegible\', monospace" font-size="24" font-weight="bold" text-anchor="middle">S</text>' +
      '  <rect x="52" y="104" width="46" height="46" fill="none" stroke="#000000" stroke-width="2" rx="4"/><text x="75" y="136" font-family="\'Atkinson Hyperlegible\', monospace" font-size="24" font-weight="bold" text-anchor="middle">T</text>' +
      '  <rect x="104" y="104" width="46" height="46" fill="none" stroke="#000000" stroke-width="2" rx="4"/><text x="127" y="136" font-family="\'Atkinson Hyperlegible\', monospace" font-size="24" font-weight="bold" text-anchor="middle">E</text>' +
      '  <rect x="156" y="104" width="46" height="46" fill="none" stroke="#000000" stroke-width="2" rx="4"/><text x="179" y="136" font-family="\'Atkinson Hyperlegible\', monospace" font-size="24" font-weight="bold" text-anchor="middle">A</text>' +
      '  <rect x="208" y="104" width="46" height="46" fill="none" stroke="#000000" stroke-width="2" rx="4"/><text x="231" y="136" font-family="\'Atkinson Hyperlegible\', monospace" font-size="24" font-weight="bold" text-anchor="middle">M</text>' +
      '  <rect x="0" y="156" width="46" height="46" fill="none" stroke="#000000" stroke-width="2" rx="4"/><text x="23" y="188" font-family="\'Atkinson Hyperlegible\', monospace" font-size="24" font-weight="bold" text-anchor="middle">C</text>' +
      '  <rect x="52" y="156" width="46" height="46" fill="none" stroke="#000000" stroke-width="2" rx="4"/><text x="75" y="188" font-family="\'Atkinson Hyperlegible\', monospace" font-size="24" font-weight="bold" text-anchor="middle">H</text>' +
      '  <rect x="104" y="156" width="46" height="46" fill="none" stroke="#000000" stroke-width="2" rx="4"/><text x="127" y="188" font-family="\'Atkinson Hyperlegible\', monospace" font-size="24" font-weight="bold" text-anchor="middle">I</text>' +
      '  <rect x="156" y="156" width="46" height="46" fill="none" stroke="#000000" stroke-width="2" rx="4"/><text x="179" y="188" font-family="\'Atkinson Hyperlegible\', monospace" font-size="24" font-weight="bold" text-anchor="middle">S</text>' +
      '  <rect x="208" y="156" width="46" height="46" fill="none" stroke="#000000" stroke-width="2" rx="4"/><text x="231" y="188" font-family="\'Atkinson Hyperlegible\', monospace" font-size="24" font-weight="bold" text-anchor="middle">E</text>' +
      '  <rect x="2" y="54" width="250" height="42" rx="21" fill="none" stroke="#000000" stroke-width="3.5" stroke-dasharray="6,4" />' +
      '</g>' +
      '<g transform="translate(330, 230)">' +
      '  <rect x="0" y="0" width="238" height="202" fill="none" stroke="#000000" stroke-width="2.5" />' +
      '  <rect x="0" y="0" width="238" height="34" fill="#000000" />' +
      '  <text x="119" y="23" font-family="\'Atkinson Hyperlegible\', sans-serif" font-size="16" font-weight="bold" fill="#ffffff" text-anchor="middle">WORD BANK</text>' +
      '  <g transform="translate(18, 58)"><circle cx="8" cy="4" r="5" fill="none" stroke="#000000" stroke-width="2"/><text x="24" y="10" font-family="\'Atkinson Hyperlegible\', sans-serif" font-size="19" font-weight="bold">LATHE</text></g>' +
      '  <g transform="translate(18, 92)"><circle cx="8" cy="4" r="5" fill="#000000" stroke="#000000" stroke-width="2"/><text x="24" y="10" font-family="\'Atkinson Hyperlegible\', sans-serif" font-size="19" font-weight="bold">TIMBER</text><line x1="20" y1="5" x2="160" y2="5" stroke="#000000" stroke-width="2.5"/></g>' +
      '  <g transform="translate(18, 126)"><circle cx="8" cy="4" r="5" fill="none" stroke="#000000" stroke-width="2"/><text x="24" y="10" font-family="\'Atkinson Hyperlegible\', sans-serif" font-size="19" font-weight="bold">STEAM</text></g>' +
      '  <g transform="translate(18, 160)"><circle cx="8" cy="4" r="5" fill="none" stroke="#000000" stroke-width="2"/><text x="24" y="10" font-family="\'Atkinson Hyperlegible\', sans-serif" font-size="19" font-weight="bold">CHISEL</text></g>' +
      '</g>' +
      '<rect x="44" y="470" width="524" height="42" fill="none" stroke="#000000" stroke-width="2" />' +
      '<text x="56" y="496" font-family="\'Atkinson Hyperlegible\', sans-serif" font-size="16" fill="#000000">💡 Facilitator Cue: Place a wooden block or tool token on the desk to evoke muscle memory.</text>' +
      '<text x="44" y="730" font-family="\'Atkinson Hyperlegible\', sans-serif" font-size="13" fill="#000000">Cognicopia Master SVG Vector Suite • Pure B&amp;W Contrast • Zero Infantilization</text>' +
      '</svg>';
  }

  function renderHeroSvgPreview() {
    var data = getInputs();
    updateCtaLinks(data.name, data.hometown, data.vocation);

    var container = document.getElementById('cgHeroSvgContainer');
    if (!container) return;

    var svgHtml = '';

    if (window.CogniPacketGenerator && typeof window.CogniPacketGenerator.generatePacket === 'function') {
      try {
        var profile = {
          preferredName: data.name,
          hometown: { place: data.hometown },
          pastVocation: data.vocation,
          corePassions: ['Family Stories', 'Hometown Heritage', 'Craftsmanship'],
          formativeEra: '1950s',
          cognitiveTier: 2,
          motorCapabilityLevel: 'moderate'
        };

        var packet = window.CogniPacketGenerator.generatePacket(profile);
        if (activeTab === 'wordSearch' && packet.wordSearch && packet.wordSearch.svg) {
          svgHtml = packet.wordSearch.svg;
        } else if (activeTab === 'reminiscence' && packet.reminiscence && packet.reminiscence.svg) {
          svgHtml = packet.reminiscence.svg;
        } else if (activeTab === 'matching' && packet.matching && packet.matching.svg) {
          svgHtml = packet.matching.svg;
        }
      } catch (err) {
        console.warn('[HeroSandbox] packetGenerator threw error, using fallback:', err);
      }
    }

    if (!svgHtml) {
      svgHtml = renderFallbackSvg(data.name, data.hometown, data.vocation, activeTab);
    }

    container.innerHTML = svgHtml;
  }

  function setupEventListeners() {
    var inputs = ['cgHeroName', 'cgHeroHometown', 'cgHeroVocation'];
    inputs.forEach(function(id) {
      var el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', function() {
          // Clear active chip style if user types manually
          var chips = document.querySelectorAll('.lp-sb-chip');
          chips.forEach(function(c) { c.classList.remove('active'); });
          renderHeroSvgPreview();
        });
      }
    });

    // Preset Chip Buttons
    var chips = document.querySelectorAll('.lp-sb-chip');
    chips.forEach(function(chip) {
      chip.addEventListener('click', function() {
        var key = chip.getAttribute('data-preset');
        if (PRESETS[key]) {
          var p = PRESETS[key];
          var nameEl = document.getElementById('cgHeroName');
          var townEl = document.getElementById('cgHeroHometown');
          var vocEl = document.getElementById('cgHeroVocation');

          if (nameEl) nameEl.value = p.name;
          if (townEl) townEl.value = p.hometown;
          if (vocEl) vocEl.value = p.vocation;

          chips.forEach(function(c) { c.classList.remove('active'); });
          chip.classList.add('active');

          renderHeroSvgPreview();
        }
      });
    });

    // View Mode Tab Buttons
    var tabs = document.querySelectorAll('.lp-sb-tab');
    tabs.forEach(function(tabBtn) {
      tabBtn.addEventListener('click', function() {
        var tabId = tabBtn.getAttribute('data-tab');
        if (tabId) {
          activeTab = tabId;
          tabs.forEach(function(t) { t.classList.remove('active'); });
          tabBtn.classList.add('active');
          renderHeroSvgPreview();
        }
      });
    });

    // Initial render
    renderHeroSvgPreview();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupEventListeners);
  } else {
    setupEventListeners();
  }

  // Export to global for debug/programmatic access
  window.CogniHeroSandbox = {
    render: renderHeroSvgPreview,
    setTab: function(tab) {
      activeTab = tab;
      renderHeroSvgPreview();
    }
  };
})();
