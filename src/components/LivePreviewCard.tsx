import React, { useState, useMemo } from 'react';

export interface ResidentSandboxState {
  name: string;
  hometown: string;
  vocation: string;
}

export interface LivePreviewCardProps {
  initialName?: string;
  initialHometown?: string;
  initialVocation?: string;
  onGeneratePacket?: (profile: ResidentSandboxState) => void;
  className?: string;
}

const PRESET_RESIDENTS: Array<{
  label: string;
  name: string;
  hometown: string;
  vocation: string;
}> = [
  {
    label: "Arthur (Railroad & Woodworking)",
    name: "Arthur 'Artie' Smith",
    hometown: "Williston, ND",
    vocation: "Railroad Machinist & Master Carpenter"
  },
  {
    label: "Eleanor (Botany & Teaching)",
    name: "Eleanor Vance",
    hometown: "Savannah, GA",
    vocation: "High School Biology Teacher & Garden Club Leader"
  },
  {
    label: "Harold (Music & Agriculture)",
    name: "Harold Miller",
    hometown: "Cedar Rapids, IA",
    vocation: "Jazz Trombonist & Grain Farmer"
  },
  {
    label: "Clara (Nursing & Quilting)",
    name: "Clara Tremblay",
    hometown: "Portland, ME",
    vocation: "Pediatric Nurse & Master Quilter"
  }
];

export const LivePreviewCard: React.FC<LivePreviewCardProps> = ({
  initialName = "Arthur",
  initialHometown = "Williston, ND",
  initialVocation = "Railroad Machinist & Master Carpenter",
  onGeneratePacket,
  className = ""
}) => {
  const [name, setName] = useState<string>(initialName);
  const [hometown, setHometown] = useState<string>(initialHometown);
  const [vocation, setVocation] = useState<string>(initialVocation);
  const [activeView, setActiveView] = useState<'worksheet' | 'reminiscence' | 'tactile'>('worksheet');

  const displayName = name.trim() || 'Resident';
  const displayHometown = hometown.trim() || 'Hometown Roots';
  const displayVocation = vocation.trim() || 'Life Craft & Vocation';

  // Extract clean keywords for dynamic word-grid & matching
  const dynamicKeywords = useMemo(() => {
    const rawWords: string[] = [];
    const voc = vocation.toUpperCase();
    const town = hometown.toUpperCase();

    if (voc.includes('CARPENTER') || voc.includes('WOOD')) {
      rawWords.push('TIMBER', 'CHISEL', 'DOVETAIL', 'PLANE', 'CEDAR');
    }
    if (voc.includes('MACHIN') || voc.includes('RAIL') || voc.includes('ENGINE')) {
      rawWords.push('LATHE', 'BRASS', 'ENGINE', 'MICROMETER', 'STEAM');
    }
    if (voc.includes('TEACH') || voc.includes('SCHOOL') || voc.includes('BIOLOGY')) {
      rawWords.push('LESSON', 'CHALK', 'STUDENT', 'MICROSCOPE', 'BOTANY');
    }
    if (voc.includes('NURSE') || voc.includes('HEALTH') || voc.includes('CARE')) {
      rawWords.push('HEART', 'COMFORT', 'STETHOSCOPE', 'CARE', 'WARMTH');
    }
    if (voc.includes('FARM') || voc.includes('GRAIN') || voc.includes('MUSIC') || voc.includes('JAZZ')) {
      rawWords.push('HARVEST', 'BRASS', 'MELODY', 'TROMBONE', 'FIELD');
    }

    // Hometown anchor
    const cleanTown = town.split(',')[0].replace(/[^A-Z]/g, '');
    if (cleanTown.length >= 3 && cleanTown.length <= 9) {
      rawWords.unshift(cleanTown);
    }

    if (rawWords.length === 0) {
      rawWords.push('DIGNITY', 'LEGACY', 'HOME', 'CRAFT', 'HONOR');
    }

    return Array.from(new Set(rawWords)).slice(0, 5);
  }, [vocation, hometown]);

  // Handle Preset selection
  const handleSelectPreset = (preset: typeof PRESET_RESIDENTS[0]) => {
    setName(preset.name);
    setHometown(preset.hometown);
    setVocation(preset.vocation);
  };

  const handleGenerate = () => {
    const profile = { name: displayName, hometown: displayHometown, vocation: displayVocation };
    if (onGeneratePacket) {
      onGeneratePacket(profile);
    } else {
      const targetUrl = `builder.html?name=${encodeURIComponent(displayName)}&hometown=${encodeURIComponent(displayHometown)}&vocation=${encodeURIComponent(displayVocation)}`;
      window.location.href = targetUrl;
    }
  };

  return (
    <div className={`w-full max-w-xl mx-auto ${className}`}>
      {/* Outer Card Container with Warm Accessible Theme */}
      <div className="bg-[#122a2e] border-2 border-[#4fb3bf]/40 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-md">
        
        {/* Header / Sandbox Title */}
        <div className="bg-[#0b1b1e] px-5 py-4 border-b border-[#4fb3bf]/20 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4fb3bf] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#4fb3bf]"></span>
            </span>
            <h3 className="text-sm font-semibold tracking-wide uppercase text-[#e8f2f3] font-['Cognicopia_UI',sans-serif]">
              Live Packet Sandbox
            </h3>
          </div>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#4fb3bf]/15 text-[#7fcbd3] border border-[#4fb3bf]/30">
            Zero-Latency Client-Side SVG
          </span>
        </div>

        {/* Input Controls Panel */}
        <div className="p-5 bg-[#0e2225] border-b border-[#4fb3bf]/15 space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Input 1: Resident Name */}
            <div>
              <label htmlFor="sandbox-name" className="block text-xs font-semibold text-[#a7bcbf] mb-1">
                1. Resident Name
              </label>
              <input
                id="sandbox-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Arthur Smith"
                className="w-full px-3 py-2 text-sm rounded-lg bg-[#06191d] text-[#e8f2f3] border border-[#4fb3bf]/30 focus:border-[#7fcbd3] focus:ring-1 focus:ring-[#7fcbd3] outline-none transition placeholder-[#a7bcbf]/50"
              />
            </div>

            {/* Input 2: Hometown Roots */}
            <div>
              <label htmlFor="sandbox-hometown" className="block text-xs font-semibold text-[#a7bcbf] mb-1">
                2. Hometown &amp; Roots
              </label>
              <input
                id="sandbox-hometown"
                type="text"
                value={hometown}
                onChange={(e) => setHometown(e.target.value)}
                placeholder="e.g. Williston, ND"
                className="w-full px-3 py-2 text-sm rounded-lg bg-[#06191d] text-[#e8f2f3] border border-[#4fb3bf]/30 focus:border-[#7fcbd3] focus:ring-1 focus:ring-[#7fcbd3] outline-none transition placeholder-[#a7bcbf]/50"
              />
            </div>

            {/* Input 3: Former Vocation */}
            <div>
              <label htmlFor="sandbox-vocation" className="block text-xs font-semibold text-[#a7bcbf] mb-1">
                3. Past Craft / Vocation
              </label>
              <input
                id="sandbox-vocation"
                type="text"
                value={vocation}
                onChange={(e) => setVocation(e.target.value)}
                placeholder="e.g. Railroad Machinist"
                className="w-full px-3 py-2 text-sm rounded-lg bg-[#06191d] text-[#e8f2f3] border border-[#4fb3bf]/30 focus:border-[#7fcbd3] focus:ring-1 focus:ring-[#7fcbd3] outline-none transition placeholder-[#a7bcbf]/50"
              />
            </div>
          </div>

          {/* Quick Preset Selector Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] font-medium text-[#a7bcbf] mr-1">Quick Try:</span>
            {PRESET_RESIDENTS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => handleSelectPreset(preset)}
                className={`text-[11px] px-2.5 py-1 rounded-md transition border ${
                  name === preset.name
                    ? 'bg-[#4fb3bf] text-[#05222a] border-[#4fb3bf] font-bold shadow-sm'
                    : 'bg-[#06191d] text-[#a7bcbf] border-[#4fb3bf]/25 hover:border-[#4fb3bf] hover:text-[#e8f2f3]'
                }`}
              >
                {preset.name.split(' ')[0]} ({preset.vocation.split('&')[0].trim().split(' ')[0]})
              </button>
            ))}
          </div>
        </div>

        {/* View Mode Tabs (Worksheet vs. Reminiscence vs. Tactile Match) */}
        <div className="px-5 pt-3 pb-2 bg-[#0b1b1e] flex items-center justify-between border-b border-[#4fb3bf]/15">
          <div className="flex space-x-1" role="tablist" aria-label="Activity View Mode">
            <button
              type="button"
              role="tab"
              aria-selected={activeView === 'worksheet'}
              onClick={() => setActiveView('worksheet')}
              className={`px-3 py-1 text-xs font-medium rounded-t-md transition ${
                activeView === 'worksheet'
                  ? 'bg-white text-[#05222a] font-bold shadow-sm'
                  : 'text-[#a7bcbf] hover:text-[#e8f2f3]'
              }`}
            >
              1. Word Search Preview
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeView === 'reminiscence'}
              onClick={() => setActiveView('reminiscence')}
              className={`px-3 py-1 text-xs font-medium rounded-t-md transition ${
                activeView === 'reminiscence'
                  ? 'bg-white text-[#05222a] font-bold shadow-sm'
                  : 'text-[#a7bcbf] hover:text-[#e8f2f3]'
              }`}
            >
              2. Reminiscence Card
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeView === 'tactile'}
              onClick={() => setActiveView('tactile')}
              className={`px-3 py-1 text-xs font-medium rounded-t-md transition ${
                activeView === 'tactile'
                  ? 'bg-white text-[#05222a] font-bold shadow-sm'
                  : 'text-[#a7bcbf] hover:text-[#e8f2f3]'
              }`}
            >
              3. Tactile Tracing
            </button>
          </div>
          <span className="hidden sm:inline-block text-[11px] text-[#a7bcbf]/80">
            18pt+ Floor • Zero Grayscale
          </span>
        </div>

        {/* Live Vector SVG Sheet Rendering Container */}
        <div className="p-4 sm:p-6 bg-[#081517] flex justify-center items-center">
          <div className="w-full bg-white rounded-lg shadow-xl p-4 sm:p-6 text-black border-4 border-black transition-all duration-150">
            
            {/* VIEW 1: WORD SEARCH WORKSHEET */}
            {activeView === 'worksheet' && (
              <svg
                viewBox="0 0 540 420"
                className="w-full h-auto select-none"
                xmlns="http://www.w3.org/2000/svg"
                role="img"
                aria-label={`Personalized Activity Worksheet for ${displayName}`}
              >
                {/* Header Stamp */}
                <rect x="0" y="0" width="540" height="420" fill="#ffffff" />
                <rect x="12" y="12" width="516" height="396" fill="none" stroke="#000000" strokeWidth="3" />
                
                {/* Header Information */}
                <text x="30" y="38" fontFamily="'Atkinson Hyperlegible', sans-serif" fontSize="13" fontWeight="bold" fill="#000000">
                  COGNICOPIA ENRICHMENT ACTIVITY • CLINICAL MEMORY CARE
                </text>
                <text x="510" y="38" fontFamily="'Atkinson Hyperlegible', sans-serif" fontSize="13" fontWeight="bold" fill="#000000" textAnchor="end">
                  PAGE 1 OF 50
                </text>
                <line x1="30" y1="46" x2="510" y2="46" stroke="#000000" strokeWidth="2" />

                {/* Patient & Vocational Anchor */}
                <text x="30" y="74" fontFamily="'Atkinson Hyperlegible', sans-serif" fontSize="22" fontWeight="bold" fill="#000000">
                  {displayName} · {displayHometown}
                </text>
                <text x="30" y="96" fontFamily="'Atkinson Hyperlegible', sans-serif" fontSize="15" fill="#000000">
                  Historical Craft: {displayVocation}
                </text>

                {/* Instructions */}
                <rect x="30" y="110" width="480" height="34" fill="none" stroke="#000000" strokeWidth="1.5" strokeDasharray="4,3" />
                <text x="40" y="132" fontFamily="'Atkinson Hyperlegible', sans-serif" fontSize="14" fontWeight="bold" fill="#000000">
                  DIRECTIONS: Find and circle the words from {displayName}&apos;s trade and hometown.
                </text>

                {/* Interactive Simulated 5x5 High-Contrast Word Search Grid */}
                <g transform="translate(30, 160)">
                  {[
                    ['L', 'A', 'T', 'H', 'E', '•', 'T'],
                    ['T', 'I', 'M', 'B', 'E', 'R', '•'],
                    ['S', 'T', 'E', 'A', 'M', '•', 'O'],
                    ['C', 'H', 'I', 'S', 'E', 'L', 'O'],
                    ['W', 'I', 'L', 'L', 'I', 'S', 'L']
                  ].map((row, rIdx) =>
                    row.map((cell, cIdx) => (
                      <g key={`${rIdx}-${cIdx}`} transform={`translate(${cIdx * 38}, ${rIdx * 38})`}>
                        <rect x="0" y="0" width="34" height="34" fill="none" stroke="#000000" strokeWidth="2" rx="4" />
                        <text
                          x="17"
                          y="24"
                          fontFamily="'Atkinson Hyperlegible', monospace"
                          fontSize="20"
                          fontWeight="bold"
                          fill="#000000"
                          textAnchor="middle"
                        >
                          {cell}
                        </text>
                      </g>
                    ))
                  )}

                  {/* Highlight ellipse showing success/engagement */}
                  <rect
                    x="2"
                    y="39"
                    width="224"
                    height="32"
                    rx="16"
                    fill="none"
                    stroke="#000000"
                    strokeWidth="3"
                    strokeDasharray="6,4"
                  />
                </g>

                {/* Word Bank Box */}
                <g transform="translate(320, 160)">
                  <rect x="0" y="0" width="190" height="186" fill="none" stroke="#000000" strokeWidth="2.5" />
                  <rect x="0" y="0" width="190" height="28" fill="#000000" />
                  <text x="95" y="19" fontFamily="'Atkinson Hyperlegible', sans-serif" fontSize="13" fontWeight="bold" fill="#ffffff" textAnchor="middle">
                    WORD BANK ({dynamicKeywords.length})
                  </text>

                  {dynamicKeywords.map((word, wIdx) => (
                    <g key={word} transform={`translate(16, ${48 + wIdx * 28})`}>
                      <circle cx="8" cy="4" r="5" fill={wIdx === 1 ? '#000000' : 'none'} stroke="#000000" strokeWidth="2" />
                      <text x="24" y="9" fontFamily="'Atkinson Hyperlegible', sans-serif" fontSize="16" fontWeight="bold" fill="#000000">
                        {word}
                      </text>
                      {wIdx === 1 && (
                        <line x1="20" y1="5" x2="160" y2="5" stroke="#000000" strokeWidth="2" />
                      )}
                    </g>
                  ))}
                </g>

                {/* Tactile Sensory Prompt at Bottom */}
                <rect x="30" y="365" width="480" height="30" fill="none" stroke="#000000" strokeWidth="1.5" />
                <text x="40" y="385" fontFamily="'Atkinson Hyperlegible', sans-serif" fontSize="13" fill="#000000">
                  💡 Facilitator Cue: Place a smooth wooden block or steel bolt on the desk to evoke muscle memory.
                </text>
              </svg>
            )}

            {/* VIEW 2: DIGNIFIED REMINISCENCE PROMPT */}
            {activeView === 'reminiscence' && (
              <svg
                viewBox="0 0 540 420"
                className="w-full h-auto select-none"
                xmlns="http://www.w3.org/2000/svg"
                role="img"
                aria-label={`Reminiscence Prompt for ${displayName}`}
              >
                <rect x="0" y="0" width="540" height="420" fill="#ffffff" />
                <rect x="12" y="12" width="516" height="396" fill="none" stroke="#000000" strokeWidth="3" />
                
                {/* Header */}
                <text x="30" y="38" fontFamily="'Atkinson Hyperlegible', sans-serif" fontSize="13" fontWeight="bold" fill="#000000">
                  CONVERSATIONAL REMINISCENCE • HISTORICAL DIGNITY PILLAR
                </text>
                <text x="510" y="38" fontFamily="'Atkinson Hyperlegible', sans-serif" fontSize="13" fontWeight="bold" fill="#000000" textAnchor="end">
                  PAGE 2 OF 50
                </text>
                <line x1="30" y1="46" x2="510" y2="46" stroke="#000000" strokeWidth="2" />

                {/* Subject */}
                <text x="30" y="76" fontFamily="'Atkinson Hyperlegible', sans-serif" fontSize="22" fontWeight="bold" fill="#000000">
                  {displayName}&apos;s Trade Reflections
                </text>
                <text x="30" y="100" fontFamily="'Atkinson Hyperlegible', sans-serif" fontSize="15" fill="#000000">
                  Anchored in: {displayVocation} &bull; {displayHometown}
                </text>

                {/* Large Print Conversational Prompt Frame */}
                <rect x="30" y="120" width="480" height="150" fill="none" stroke="#000000" strokeWidth="2" rx="6" />
                <text x="50" y="152" fontFamily="'Atkinson Hyperlegible', sans-serif" fontSize="18" fontWeight="bold" fill="#000000">
                  &ldquo;Tell us about the workshops and yards back in {displayHometown}.&rdquo;
                </text>
                <text x="50" y="184" fontFamily="'Atkinson Hyperlegible', sans-serif" fontSize="16" fill="#000000">
                  What did the sound of the shop whistle or bells signal in the morning?
                </text>
                <text x="50" y="212" fontFamily="'Atkinson Hyperlegible', sans-serif" fontSize="16" fill="#000000">
                  Which tool did you keep in your handiest pocket because you used it daily?
                </text>
                <text x="50" y="244" fontFamily="'Atkinson Hyperlegible', sans-serif" fontSize="15" fontStyle="italic" fill="#000000">
                  (Take as much time as you like; every memory shared is valuable.)
                </text>

                {/* Free Reflection Guidelines */}
                <line x1="50" y1="300" x2="490" y2="300" stroke="#000000" strokeWidth="1.5" />
                <line x1="50" y1="334" x2="490" y2="334" stroke="#000000" strokeWidth="1.5" />
                <line x1="50" y1="368" x2="490" y2="368" stroke="#000000" strokeWidth="1.5" />

                <text x="50" y="394" fontFamily="'Atkinson Hyperlegible', sans-serif" fontSize="12" fill="#000000">
                  Memory Care Clinical Note: Tap into autobiographical emotional memory to reduce agitation.
                </text>
              </svg>
            )}

            {/* VIEW 3: TACTILE MATCHING & TRACING */}
            {activeView === 'tactile' && (
              <svg
                viewBox="0 0 540 420"
                className="w-full h-auto select-none"
                xmlns="http://www.w3.org/2000/svg"
                role="img"
                aria-label={`Tactile Tracing for ${displayName}`}
              >
                <rect x="0" y="0" width="540" height="420" fill="#ffffff" />
                <rect x="12" y="12" width="516" height="396" fill="none" stroke="#000000" strokeWidth="3" />
                
                {/* Header */}
                <text x="30" y="38" fontFamily="'Atkinson Hyperlegible', sans-serif" fontSize="13" fontWeight="bold" fill="#000000">
                  TACTILE TRACING &amp; MOTOR PATHWAYS • HIGH MOTOR BANDWIDTH
                </text>
                <text x="510" y="38" fontFamily="'Atkinson Hyperlegible', sans-serif" fontSize="13" fontWeight="bold" fill="#000000" textAnchor="end">
                  PAGE 3 OF 50
                </text>
                <line x1="30" y1="46" x2="510" y2="46" stroke="#000000" strokeWidth="2" />

                <text x="30" y="74" fontFamily="'Atkinson Hyperlegible', sans-serif" fontSize="20" fontWeight="bold" fill="#000000">
                  Connect the Tools of {displayName}&apos;s Craft
                </text>
                <text x="30" y="96" fontFamily="'Atkinson Hyperlegible', sans-serif" fontSize="14" fill="#000000">
                  Trace the guided path from left to right using a pencil or fingertip.
                </text>

                {/* Row 1: Hand Tool */}
                <g transform="translate(30, 116)">
                  <rect x="0" y="0" width="160" height="64" fill="none" stroke="#000000" strokeWidth="2.5" rx="6" />
                  <text x="80" y="38" fontFamily="'Atkinson Hyperlegible', sans-serif" fontSize="17" fontWeight="bold" fill="#000000" textAnchor="middle">
                    Hand Plane
                  </text>
                  
                  {/* Tracing Stroke Path */}
                  <path d="M 165 32 Q 240 10 315 32" fill="none" stroke="#000000" strokeWidth="4" strokeDasharray="8,6" />
                  
                  <rect x="320" y="0" width="160" height="64" fill="none" stroke="#000000" strokeWidth="2.5" rx="6" />
                  <text x="400" y="38" fontFamily="'Atkinson Hyperlegible', sans-serif" fontSize="17" fontWeight="bold" fill="#000000" textAnchor="middle">
                    Cedar Timber
                  </text>
                </g>

                {/* Row 2: Precision Tool */}
                <g transform="translate(30, 196)">
                  <rect x="0" y="0" width="160" height="64" fill="none" stroke="#000000" strokeWidth="2.5" rx="6" />
                  <text x="80" y="38" fontFamily="'Atkinson Hyperlegible', sans-serif" fontSize="17" fontWeight="bold" fill="#000000" textAnchor="middle">
                    Micrometer
                  </text>
                  
                  {/* Tracing Stroke Path */}
                  <path d="M 165 32 Q 240 54 315 32" fill="none" stroke="#000000" strokeWidth="4" strokeDasharray="8,6" />
                  
                  <rect x="320" y="0" width="160" height="64" fill="none" stroke="#000000" strokeWidth="2.5" rx="6" />
                  <text x="400" y="38" fontFamily="'Atkinson Hyperlegible', sans-serif" fontSize="17" fontWeight="bold" fill="#000000" textAnchor="middle">
                    Brass Bearing
                  </text>
                </g>

                {/* Row 3: Hometown Station */}
                <g transform="translate(30, 276)">
                  <rect x="0" y="0" width="160" height="64" fill="none" stroke="#000000" strokeWidth="2.5" rx="6" />
                  <text x="80" y="38" fontFamily="'Atkinson Hyperlegible', sans-serif" fontSize="17" fontWeight="bold" fill="#000000" textAnchor="middle">
                    Steam Whistle
                  </text>
                  
                  {/* Tracing Stroke Path */}
                  <path d="M 165 32 Q 240 10 315 32" fill="none" stroke="#000000" strokeWidth="4" strokeDasharray="8,6" />
                  
                  <rect x="320" y="0" width="160" height="64" fill="none" stroke="#000000" strokeWidth="2.5" rx="6" />
                  <text x="400" y="38" fontFamily="'Atkinson Hyperlegible', sans-serif" fontSize="17" fontWeight="bold" fill="#000000" textAnchor="middle">
                    {displayHometown.split(',')[0]} Depot
                  </text>
                </g>

                <text x="40" y="380" fontFamily="'Atkinson Hyperlegible', sans-serif" fontSize="13" fill="#000000">
                  Tactile tokens: Resident may place a checker piece on the left circle, then slide to the right target.
                </text>
              </svg>
            )}

          </div>
        </div>

        {/* Live Vector Details Footer */}
        <div className="px-5 py-3 bg-[#0b1b1e] border-t border-[#4fb3bf]/15 flex items-center justify-between text-xs text-[#a7bcbf]">
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4 text-[#4fb3bf]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Laser-Ready Black &amp; White • 100% Offline Compatible</span>
          </div>
          <span className="font-mono text-[#7fcbd3]">Master SVG Vector #150</span>
        </div>

        {/* PROMINENT PRIMARY CTA: GENERATE FULL 50-PAGE PACKET */}
        <div className="p-5 bg-gradient-to-b from-[#122a2e] to-[#071618] border-t border-[#4fb3bf]/25 text-center">
          <button
            type="button"
            onClick={handleGenerate}
            className="w-full py-4 px-6 rounded-xl font-bold text-base sm:text-lg bg-[#4fb3bf] hover:bg-[#7fcbd3] active:bg-[#3ba0ac] text-[#05222a] shadow-lg shadow-[#4fb3bf]/20 hover:shadow-xl hover:shadow-[#4fb3bf]/30 transition-all duration-200 transform hover:-translate-y-0.5 flex items-center justify-center space-x-2 group cursor-pointer"
          >
            <span>Generate Full 50-Page Packet for {displayName}</span>
            <svg
              className="w-5 h-5 transition-transform duration-200 group-hover:translate-x-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
          <p className="mt-2.5 text-xs text-[#a7bcbf]">
            Instant browser compile • Full 50-page personalized workbook • Print-ready on any office printer
          </p>
        </div>

      </div>
    </div>
  );
};

export default LivePreviewCard;
