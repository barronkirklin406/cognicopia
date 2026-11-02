import React from 'react';
import { LivePreviewCard, ResidentSandboxState } from './LivePreviewCard';

export interface HeroProps {
  onStartTrial?: () => void;
  onExploreTablet?: () => void;
  onCustomGenerate?: (profile: ResidentSandboxState) => void;
  className?: string;
}

export const Hero: React.FC<HeroProps> = ({
  onStartTrial,
  onExploreTablet,
  onCustomGenerate,
  className = ""
}) => {
  const handleStartTrial = () => {
    if (onStartTrial) {
      onStartTrial();
    } else {
      window.location.href = 'builder.html';
    }
  };

  const handleTablet = () => {
    if (onExploreTablet) {
      onExploreTablet();
    } else {
      window.location.href = 'tablet.html';
    }
  };

  return (
    <section
      className={`relative overflow-hidden bg-gradient-to-b from-[#0b1719] via-[#0f2023] to-[#071618] text-[#e8f2f3] py-12 lg:py-20 px-4 sm:px-6 lg:px-8 ${className}`}
      aria-labelledby="hero-heading"
    >
      {/* Background Decorative Ambient Glows */}
      <div className="absolute top-0 right-1/4 -translate-y-1/2 w-96 h-96 bg-[#4fb3bf]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-10 w-80 h-80 bg-[#1c5963]/15 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* Split Screen Grid Layout: Left Copy / Right Live Sandbox */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          
          {/* LEFT COLUMN: Value Proposition & High-Converting Directives */}
          <div className="lg:col-span-6 space-y-6 text-left">
            
            {/* Top Clinical Badge */}
            <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-[#122a2e] border border-[#4fb3bf]/30 text-xs sm:text-sm font-medium text-[#7fcbd3] shadow-sm">
              <span className="w-2 h-2 rounded-full bg-[#4fb3bf] animate-pulse"></span>
              <span>Cognitive Stimulation Therapy (CST) &amp; Reminiscence</span>
            </div>

            {/* Main Headline */}
            <h1
              id="hero-heading"
              className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-[#e8f2f3] leading-[1.18] font-['Cognicopia_UI',sans-serif]"
            >
              Activities built from <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#4fb3bf] to-[#a8e6cf]">
                one resident&apos;s own life.
              </span>
            </h1>

            {/* Lede / Description */}
            <p className="text-base sm:text-lg text-[#a7bcbf] leading-relaxed max-w-xl">
              Generic word searches and children&apos;s coloring sheets frustrate older adults. 
              Cognicopia weaves a resident&apos;s true career, hometown roots, and formative era 
              music into clinical-grade, large-print packets that spark genuine long-term memory retrieval.
            </p>

            {/* 4 Foundational Human Pillars Checklist */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="flex items-start space-x-2.5">
                <div className="flex-shrink-0 w-5 h-5 rounded-md bg-[#4fb3bf]/20 border border-[#4fb3bf]/40 flex items-center justify-center text-[#7fcbd3] mt-0.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#e8f2f3] uppercase tracking-wide">1. What Can They Do?</h4>
                  <p className="text-xs text-[#a7bcbf]">18pt+ font floor, high visual contrast, tactile motor paths</p>
                </div>
              </div>

              <div className="flex items-start space-x-2.5">
                <div className="flex-shrink-0 w-5 h-5 rounded-md bg-[#4fb3bf]/20 border border-[#4fb3bf]/40 flex items-center justify-center text-[#7fcbd3] mt-0.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#e8f2f3] uppercase tracking-wide">2. What Do They Care About?</h4>
                  <p className="text-xs text-[#a7bcbf]">1940s–70s music, beloved hobbies, regional geography</p>
                </div>
              </div>

              <div className="flex items-start space-x-2.5">
                <div className="flex-shrink-0 w-5 h-5 rounded-md bg-[#4fb3bf]/20 border border-[#4fb3bf]/40 flex items-center justify-center text-[#7fcbd3] mt-0.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#e8f2f3] uppercase tracking-wide">3. What&apos;s On Hand?</h4>
                  <p className="text-xs text-[#a7bcbf]">Tangible pairings with tokens, smooth stones &amp; pencils</p>
                </div>
              </div>

              <div className="flex items-start space-x-2.5">
                <div className="flex-shrink-0 w-5 h-5 rounded-md bg-[#4fb3bf]/20 border border-[#4fb3bf]/40 flex items-center justify-center text-[#7fcbd3] mt-0.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#e8f2f3] uppercase tracking-wide">4. Professional Identity</h4>
                  <p className="text-xs text-[#a7bcbf]">Honors former vocations (machinists, nurses, teachers)</p>
                </div>
              </div>
            </div>

            {/* Primary Action Buttons */}
            <div className="pt-4 flex flex-col sm:flex-row items-stretch sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
              <button
                type="button"
                onClick={handleStartTrial}
                className="px-6 py-3.5 rounded-xl text-base font-bold bg-[#4fb3bf] hover:bg-[#7fcbd3] text-[#05222a] shadow-lg shadow-[#4fb3bf]/20 hover:shadow-xl hover:shadow-[#4fb3bf]/30 transition-all duration-200 transform hover:-translate-y-0.5 cursor-pointer text-center"
              >
                Start Free Trial &mdash; 25 Free Packets
              </button>

              <button
                type="button"
                onClick={handleTablet}
                className="px-6 py-3.5 rounded-xl text-base font-semibold bg-[#122a2e] hover:bg-[#18363b] text-[#e8f2f3] border border-[#4fb3bf]/30 hover:border-[#4fb3bf]/60 transition-all duration-200 cursor-pointer text-center"
              >
                Interactive Tablet Mode
              </button>
            </div>

            {/* Trust and Clinical Safeguard Badges */}
            <div className="pt-2 flex flex-wrap items-center gap-y-2 gap-x-4 text-xs text-[#a7bcbf]">
              <span className="flex items-center space-x-1.5">
                <svg className="w-4 h-4 text-[#4fb3bf]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>No Credit Card Required</span>
              </span>
              <span className="flex items-center space-x-1.5">
                <svg className="w-4 h-4 text-[#4fb3bf]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>100% Offline PWA &amp; Private</span>
              </span>
              <span className="flex items-center space-x-1.5">
                <svg className="w-4 h-4 text-[#4fb3bf]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Toner-Friendly Pure B&amp;W</span>
              </span>
            </div>

          </div>

          {/* RIGHT COLUMN: Live Packet Sandbox Interactive Preview */}
          <div className="lg:col-span-6 flex justify-center">
            <LivePreviewCard
              initialName="Arthur"
              initialHometown="Williston, ND"
              initialVocation="Railroad Machinist & Master Carpenter"
              onGeneratePacket={onCustomGenerate}
            />
          </div>

        </div>

      </div>
    </section>
  );
};

export default Hero;
