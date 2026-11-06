/**
 * @file Hero.tsx
 * @description Cognicopia Hero section featuring a realistic 3D isometric EliteBook laptop mockup
 * showcasing the Activity / Profile Builder with family relationship personalization (prominently featuring daughter "SARAH").
 */

import React from 'react';

export interface HeroProps {
  onStartTrial?: () => void;
  onExploreTablet?: () => void;
  trialsRemaining?: number;
}

export const Hero: React.FC<HeroProps> = ({
  onStartTrial,
  onExploreTablet,
  trialsRemaining = 25
}) => {
  return (
    <section className="relative overflow-hidden bg-[#faf7f2] py-12 md:py-20 px-4 sm:px-6 lg:px-8" aria-labelledby="heroTitle">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
        
        {/* Left Column: Value Proposition & Trial CTA */}
        <div className="lg:col-span-5 flex flex-col justify-center text-left">
          <div className="inline-flex items-center gap-2 mb-4">
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[#e0f0f1] text-[#0e3c43] border border-[#b2d8dc]">
              Clinical Memory Care
            </span>
            <span className="text-xs font-semibold text-[#5a6578]">Zero-Cloud · 100% Offline PWA</span>
          </div>

          <h1 id="heroTitle" className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold text-[#1a202c] leading-tight mb-5">
            Activities built from <span className="text-[#0e3c43] underline decoration-[#f5b800] decoration-4 underline-offset-4">one resident’s own life.</span>
          </h1>

          <p className="text-lg text-[#343b49] leading-relaxed mb-8">
            Fill in what you know about them &mdash; their hometown, their family’s names, their work, and the songs they loved. Cognicopia dynamically generates dignity-first printable packets with large 18pt+ type and standard 0.75″ binder margins.
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mb-6">
            <a
              href="#make"
              onClick={onStartTrial}
              className="inline-flex items-center justify-center px-7 py-3.5 rounded-xl font-bold text-base text-white bg-[#0e3c43] hover:bg-[#134d56] transition-all shadow-md focus:outline-none focus:ring-4 focus:ring-[#f5b800]"
            >
              Start Free Trial &mdash; 25 Activities Free
            </a>

            <a
              href="./tablet.html"
              onClick={onExploreTablet}
              className="inline-flex items-center justify-center px-6 py-3.5 rounded-xl font-bold text-base text-[#0e3c43] bg-white border-2 border-[#0e3c43] hover:bg-[#f0f7f8] transition-all"
            >
              Tablet Activities
            </a>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-bold bg-[#e8f4f5] text-[#0e3c43] border border-[#cae5e8]">
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M13 2 4 14h6l-1 8 9-12h-6z" />
              </svg>
              Free Trial: {trialsRemaining} / 25 Generations Remaining
            </span>
            <span className="text-xs text-[#5a6578]">No credit card required</span>
          </div>
        </div>

        {/* Right Column: 3D Isometric EliteBook Laptop Mockup */}
        <div className="lg:col-span-7 flex justify-center items-center">
          <div className="elite-laptop-stage w-full max-w-[620px] select-none" style={{ perspective: '1400px' }}>
            
            {/* 3D Rotated Laptop Container */}
            <div
              className="elite-laptop-3d relative transition-transform duration-500 ease-out hover:scale-[1.01]"
              style={{
                transformStyle: 'preserve-3d',
                transform: 'rotateY(-14deg) rotateX(10deg) rotateZ(1deg)',
                filter: 'drop-shadow(-20px 32px 38px rgba(14,60,67,0.28))'
              }}
            >
              
              {/* LAPTOP LID / SCREEN CHASSIS (HP EliteBook Style Platinum Finish) */}
              <div className="elite-lid relative bg-gradient-to-b from-[#e5e9ee] via-[#cfd6df] to-[#b3bcc7] p-[10px] pb-[14px] rounded-t-[18px] rounded-b-[4px] border border-[#a4adb8] shadow-[inset_0_1px_1px_rgba(255,255,255,0.9),inset_0_-1px_2px_rgba(0,0,0,0.3)]">
                
                {/* Slim Matte-Black Display Bezel */}
                <div className="elite-bezel relative bg-[#0e1217] rounded-[10px] p-[8px] pb-[10px] shadow-[inset_0_0_0_1px_#272f3a,0_2px_6px_rgba(0,0,0,0.6)]">
                  
                  {/* Top WebCam & Dual Microphones */}
                  <div className="flex items-center justify-center gap-2 mb-1.5">
                    <span className="w-1 h-1 rounded-full bg-[#1e2530]" />
                    <span className="w-2 h-2 rounded-full bg-[#1b222d] border border-[#2d3748] flex items-center justify-center">
                      <span className="w-0.5 h-0.5 rounded-full bg-[#0e3c43]" />
                    </span>
                    <span className="w-1 h-1 rounded-full bg-[#1e2530]" />
                  </div>

                  {/* HIGH-RES SCREEN CANVAS: Activity & Profile Builder UI */}
                  <div className="elite-screen relative bg-[#f7f5f0] rounded-[6px] overflow-hidden border border-[#d6cfc2] shadow-inner text-[#1a202c]">
                    
                    {/* Screen Top App Bar */}
                    <div className="bg-[#0e3c43] text-white px-3 py-1.5 flex items-center justify-between text-xs border-b border-[#09262b]">
                      <div className="flex items-center gap-2">
                        <span className="font-serif font-bold text-sm tracking-wide">COGNICOPIA™</span>
                        <span className="text-[10px] opacity-75 font-mono">Activity Builder v2.4</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="bg-[#f5b800] text-[#08262c] text-[10px] font-bold px-2 py-0.5 rounded">
                          0.75″ Binder Margin
                        </span>
                        <span className="bg-[#17545d] text-white text-[10px] font-bold px-2.5 py-0.5 rounded cursor-pointer">
                          Print PDF
                        </span>
                      </div>
                    </div>

                    {/* App Interior: Two-Column Resident Profile + Personalized Puzzle Preview */}
                    <div className="grid grid-cols-12 p-3 gap-3 bg-[#f7f5f0]">
                      
                      {/* Left Sub-Column: Resident Profile Metadata */}
                      <div className="col-span-5 bg-white p-2.5 rounded-lg border border-[#e4ded5] shadow-xs text-left">
                        <div className="border-b border-[#eee8dd] pb-1.5 mb-2">
                          <p className="text-[9px] font-bold text-[#8a3a20] uppercase tracking-wider">Target Resident</p>
                          <p className="font-serif font-bold text-xs text-[#0e3c43]">Margaret “Peggy”</p>
                          <p className="text-[10px] text-[#555]">Born 1938 · Cedar Falls, IA</p>
                        </div>

                        <div className="space-y-1.5 text-[10px]">
                          <div>
                            <span className="font-bold text-[#333]">Work: </span>
                            <span className="text-[#444]">Music Teacher (32 yrs)</span>
                          </div>
                          {/* PROMINENT FAMILY METADATA HIGHLIGHT: DAUGHTER SARAH */}
                          <div className="bg-[#eaf4f5] p-1.5 rounded border border-[#bce0e4]">
                            <span className="font-bold text-[#0e3c43] flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#0e3c43]" />
                              Daughter: <strong className="text-[#0e3c43] text-[11px]">SARAH</strong>
                            </span>
                            <span className="text-[9px] text-[#476a70] block">Visits Sundays · Sings hymns</span>
                          </div>
                          <div>
                            <span className="font-bold text-[#333]">Son: </span>
                            <span className="text-[#444]">David (Architect)</span>
                          </div>
                          <div>
                            <span className="font-bold text-[#333]">Favorites: </span>
                            <span className="text-[#444]">Roses, Piano, Lakes</span>
                          </div>
                        </div>

                        <div className="mt-2.5 pt-1.5 border-t border-[#eee8dd] flex items-center justify-between text-[9px] text-[#666]">
                          <span>Stage: Moderate</span>
                          <span className="font-bold text-[#0e3c43]">18pt Large Print</span>
                        </div>
                      </div>

                      {/* Right Sub-Column: Activity Sheet Preview with "SARAH" in Puzzle & Fill-in */}
                      <div className="col-span-7 bg-white p-2.5 rounded-lg border-2 border-[#1a202c] shadow-sm flex flex-col justify-between">
                        
                        {/* Printable Sheet Header */}
                        <div>
                          <div className="flex justify-between items-baseline border-b border-[#1a202c] pb-1 mb-1.5">
                            <span className="font-serif font-bold text-[11px] text-[#000000]">Words from Margaret’s Life</span>
                            <span className="text-[9px] font-mono text-[#000000]">Page 1 of 5</span>
                          </div>
                          <p className="text-[9px] text-[#000000] font-semibold mb-2">
                            Circle the words from your family and hometown:
                          </p>
                        </div>

                        {/* High-Contrast Word Search Grid (Featuring SARAH horizontally and FAMILY vertically) */}
                        <div className="bg-white border border-[#000000] p-1 rounded inline-block mx-auto mb-2">
                          <div className="grid grid-cols-6 gap-0.5 text-center font-mono font-bold text-[11px] leading-none">
                            {/* Row 1: S A R A H highlighted */}
                            <span className="w-5 h-5 flex items-center justify-center bg-[#f5b800] text-[#08262c] rounded-xs font-black">S</span>
                            <span className="w-5 h-5 flex items-center justify-center bg-[#f5b800] text-[#08262c] rounded-xs font-black">A</span>
                            <span className="w-5 h-5 flex items-center justify-center bg-[#f5b800] text-[#08262c] rounded-xs font-black">R</span>
                            <span className="w-5 h-5 flex items-center justify-center bg-[#f5b800] text-[#08262c] rounded-xs font-black">A</span>
                            <span className="w-5 h-5 flex items-center justify-center bg-[#f5b800] text-[#08262c] rounded-xs font-black">H</span>
                            <span className="w-5 h-5 flex items-center justify-center text-[#444]">M</span>
                            {/* Row 2: F O R T U N */}
                            <span className="w-5 h-5 flex items-center justify-center text-[#0e3c43] font-black">F</span>
                            <span className="w-5 h-5 flex items-center justify-center text-[#444]">O</span>
                            <span className="w-5 h-5 flex items-center justify-center text-[#444]">R</span>
                            <span className="w-5 h-5 flex items-center justify-center text-[#444]">T</span>
                            <span className="w-5 h-5 flex items-center justify-center text-[#444]">U</span>
                            <span className="w-5 h-5 flex items-center justify-center text-[#444]">N</span>
                            {/* Row 3: A P I A N O */}
                            <span className="w-5 h-5 flex items-center justify-center text-[#0e3c43] font-black">A</span>
                            <span className="w-5 h-5 flex items-center justify-center text-[#000] font-bold">P</span>
                            <span className="w-5 h-5 flex items-center justify-center text-[#000] font-bold">I</span>
                            <span className="w-5 h-5 flex items-center justify-center text-[#000] font-bold">A</span>
                            <span className="w-5 h-5 flex items-center justify-center text-[#000] font-bold">N</span>
                            <span className="w-5 h-5 flex items-center justify-center text-[#000] font-bold">O</span>
                            {/* Row 4: M C E D A R */}
                            <span className="w-5 h-5 flex items-center justify-center text-[#0e3c43] font-black">M</span>
                            <span className="w-5 h-5 flex items-center justify-center text-[#000] font-bold">C</span>
                            <span className="w-5 h-5 flex items-center justify-center text-[#000] font-bold">E</span>
                            <span className="w-5 h-5 flex items-center justify-center text-[#000] font-bold">D</span>
                            <span className="w-5 h-5 flex items-center justify-center text-[#000] font-bold">A</span>
                            <span className="w-5 h-5 flex items-center justify-center text-[#000] font-bold">R</span>
                          </div>
                        </div>

                        {/* Word Bank with SARAH (Daughter) highlighted */}
                        <div className="bg-[#f0f4f5] p-1.5 rounded border border-[#d2e2e4] text-[9.5px]">
                          <p className="font-bold text-[#0e3c43] mb-0.5">Primary Word Bank:</p>
                          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-left font-semibold text-[#1a202c]">
                            <span className="text-[#0e3c43] font-bold flex items-center gap-1">
                              ✓ <strong>SARAH</strong> <small className="text-[8px] font-normal text-[#555]">(Daughter)</small>
                            </span>
                            <span>✓ FAMILY</span>
                            <span>✓ PIANO</span>
                            <span>✓ CEDAR</span>
                          </div>
                        </div>

                        {/* Cognitive Recall Fill-in Callout */}
                        <div className="mt-1.5 pt-1 border-t border-[#e5e5e5] text-left text-[9px] text-[#222]">
                          <span className="font-bold">Finish the Thought: </span>
                          <span>Peggy’s daughter is named <span className="underline font-bold text-[#0e3c43]">SARAH</span></span>
                        </div>

                      </div>
                    </div>

                    {/* Bottom Status Ribbon */}
                    <div className="bg-[#ece7df] px-3 py-1 flex items-center justify-between text-[9px] text-[#555] border-t border-[#ddd6cb]">
                      <span>✓ High-Contrast Vector SVG</span>
                      <span>✓ 100% Offline Generation</span>
                      <span>✓ Adult Dignity Standard</span>
                    </div>

                  </div>
                </div>

                {/* HP EliteBook Display Chin Logo Accent */}
                <div className="flex justify-center mt-1">
                  <span className="h-0.5 w-6 rounded-full bg-[#8c96a3]" />
                </div>
              </div>

              {/* DUAL-PIVOT HINGE */}
              <div className="elite-hinge h-1.5 mx-8 bg-gradient-to-r from-[#9aa4b0] via-[#5b6470] to-[#9aa4b0] rounded-b-[2px] shadow-inner" />

              {/* LAPTOP KEYBOARD BASE / DECK (Forward Projecting 3D Base) */}
              <div className="elite-base relative h-4 mx-[-2.5%] bg-gradient-to-b from-[#e8ecf1] via-[#cfd6df] to-[#9fa8b5] rounded-b-[20px] border-t border-[#f4f7f9] shadow-[0_12px_24px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.9)]">
                {/* Center Finger Notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-1.5 bg-[#a4adb8] rounded-b-md shadow-inner" />
              </div>

              {/* Floating Quality Callout Badge */}
              <div className="absolute -bottom-4 -left-3 bg-white px-3.5 py-2 rounded-xl border border-[#e4ded5] shadow-lg flex items-center gap-2.5 z-10">
                <span className="w-3 h-3 rounded-full bg-[#1b7e53] flex items-center justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-white" />
                </span>
                <div className="text-left">
                  <p className="text-xs font-bold text-[#1a202c] leading-tight">Personalized with “SARAH”</p>
                  <p className="text-[10px] text-[#555] leading-tight">Daughter &amp; family relationship metadata</p>
                </div>
              </div>

            </div>
          </div>
        </div>

      </div>
    </section>
  );
};

export default Hero;
