import React from "react";

export default function AccessibilityStatement(): React.JSX.Element {
  return (
    <div className="min-h-screen bg-[#0e3c43] text-black py-10 px-4 sm:px-6 lg:px-8 font-sans">
      {/* Top Breadcrumb Navigation */}
      <nav
        aria-label="Breadcrumb"
        className="max-w-4xl mx-auto mb-6 flex items-center justify-center gap-3 text-sm text-center"
      >
        <a
          href="/"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-900/60 text-white font-semibold hover:bg-emerald-800 transition"
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          <span>Return to Activity Tools</span>
        </a>
        <span className="text-white/60">/</span>
        <a
          href="/resources"
          className="text-white font-semibold hover:underline"
        >
          Resource &amp; Clinical Hub
        </a>
        <span className="text-white/60">/</span>
        <span className="text-white font-bold" aria-current="page">
          Accessibility Statement
        </span>
      </nav>

      {/* Main Cozy Green & Plaid Container */}
      <main
        id="main-content"
        className="relative max-w-4xl mx-auto rounded-[32px] border-4 border-[#1c442e] shadow-2xl p-6 sm:p-10 md:p-14 text-center text-black"
        style={{
          backgroundColor: "#d6e2cc",
          backgroundImage: `
            repeating-linear-gradient(45deg, rgba(32, 70, 48, 0.04) 0 1px, transparent 1px 16px),
            repeating-linear-gradient(-45deg, rgba(32, 70, 48, 0.04) 0 1px, transparent 1px 16px),
            linear-gradient(90deg, rgba(28, 68, 46, 0.09) 0 2px, transparent 2px 36px, rgba(180, 142, 85, 0.08) 36px 39px, transparent 39px 72px),
            linear-gradient(0deg, rgba(28, 68, 46, 0.09) 0 2px, transparent 2px 36px, rgba(180, 142, 85, 0.08) 36px 39px, transparent 39px 72px),
            repeating-linear-gradient(0deg, rgba(45, 95, 65, 0.06) 0 36px, rgba(215, 230, 205, 0.35) 36px 72px),
            repeating-linear-gradient(90deg, rgba(45, 95, 65, 0.06) 0 36px, rgba(215, 230, 205, 0.35) 36px 72px),
            linear-gradient(160deg, #dce7d3 0%, #d4e0ca 50%, #cad8bf 100%)
          `,
          boxShadow:
            "0 0 0 3px #d5e1cc, 0 0 0 7px #235338, 0 24px 70px rgba(0, 0, 0, 0.55)",
        }}
      >
        {/* Header Badge */}
        <div className="inline-block px-5 py-2 rounded-full border-2 border-black bg-white/70 mb-4 mx-auto text-center">
          <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-black">
            Cognicopia Trust Center &middot; Clinical Accessibility Mandate
          </span>
        </div>

        {/* Primary Page Heading */}
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-black tracking-tight leading-tight mb-4 text-center mx-auto">
          Accessibility Statement &amp; Dementia Dignity Standard
        </h1>

        {/* Currency & Commitment Timestamp */}
        <p className="text-base sm:text-lg font-bold text-black max-w-2xl mx-auto mb-8 pb-4 border-b-2 border-black/30 text-center">
          Active Continuous Standard &middot; Reviewed &amp; Updated November 2026 &middot; Target: WCAG 2.1 Level AAA &amp; WCAG 2.2 AA
        </p>

        {/* Section 1: Clinical Mission & Dignity */}
        <section
          aria-labelledby="heading-mission"
          className="bg-white/65 border-2 border-[#1c442e] rounded-2xl p-6 sm:p-8 mb-8 shadow-sm text-center mx-auto"
        >
          <h2
            id="heading-mission"
            className="text-2xl sm:text-3xl font-extrabold text-black mb-4 text-center mx-auto"
          >
            Our Clinical Mandate: Dignity, Calm, and Zero Friction
          </h2>
          <p className="text-lg sm:text-xl font-medium text-black leading-relaxed mb-4 text-center mx-auto max-w-3xl">
            At Cognicopia, accessibility is not a secondary feature or compliance afterthought—it is our core clinical foundation. Our software and print engines are intentionally designed for individuals experiencing cognitive decline, Alzheimer&apos;s, vascular dementia, Lewy body dementia, Parkinsonian tremors, and stroke recovery, as well as the devoted activity directors, therapists, nurses, and family members who facilitate their care.
          </p>
          <p className="text-lg sm:text-xl font-medium text-black leading-relaxed text-center mx-auto max-w-3xl">
            We reject infantilizing design and patronizing simplifications. Every digital interface, sensory workflow, and printable activity packet honors the resident as an accomplished adult with rich life history, providing effortless visual navigation and zero guessing frustration.
          </p>
        </section>

        {/* Section 2: Commitments Grid */}
        <section
          aria-labelledby="heading-measures"
          className="bg-white/65 border-2 border-[#1c442e] rounded-2xl p-6 sm:p-8 mb-8 shadow-sm text-center mx-auto"
        >
          <h2
            id="heading-measures"
            className="text-2xl sm:text-3xl font-extrabold text-black mb-6 text-center mx-auto"
          >
            Core Architectural &amp; Clinical Accessibility Standards
          </h2>

          <div className="space-y-6 text-center mx-auto max-w-3xl">
            {/* Standard 1 */}
            <div className="bg-white/50 border border-[#235338] rounded-xl p-5 text-center mx-auto">
              <h3 className="text-xl sm:text-2xl font-bold text-black mb-2 text-center mx-auto">
                1. Pure High-Contrast &amp; Low-Vision Ergonomics (WCAG 2.1 AAA)
              </h3>
              <p className="text-lg font-medium text-black leading-relaxed text-center mx-auto">
                We standardize on <strong>Atkinson Hyperlegible</strong>, a typeface engineered by the Braille Institute to prevent letterform confusion for seniors with cataracts or macular degeneration. Digital text maintains a minimum <strong>7.0:1 contrast ratio</strong> (exceeding standard 4.5:1), and print packets render exclusively in deep, toner-efficient pure black on white.
              </p>
            </div>

            {/* Standard 2 */}
            <div className="bg-white/50 border border-[#235338] rounded-xl p-5 text-center mx-auto">
              <h3 className="text-xl sm:text-2xl font-bold text-black mb-2 text-center mx-auto">
                2. Generous Touch Targets (52px &times; 52px Minimum)
              </h3>
              <p className="text-lg font-medium text-black leading-relaxed text-center mx-auto">
                Every button, category pill, and interactive target spans at least <strong>52 &times; 52 pixels</strong>. This substantially exceeds WCAG 2.2 Target Size benchmarks to provide comfortable, tremor-forgiving interaction on facility iPads, Microsoft Surface tablets, and touchscreens.
              </p>
            </div>

            {/* Standard 3 */}
            <div className="bg-white/50 border border-[#235338] rounded-xl p-5 text-center mx-auto">
              <h3 className="text-xl sm:text-2xl font-bold text-black mb-2 text-center mx-auto">
                3. The 0.75-Inch Binding Gutter &amp; Large-Print Standard
              </h3>
              <p className="text-lg font-medium text-black leading-relaxed text-center mx-auto">
                Every generated PDF activity sheet strictly enforces <strong>0.75-inch (54pt) binding margins</strong>, ensuring that pages inserted into 3-ring memory care binders never cut off words, puzzle grids, or checkboxes. Large-print options scale up to <strong>26pt+ bold typography</strong>.
              </p>
            </div>

            {/* Standard 4 */}
            <div className="bg-white/50 border border-[#235338] rounded-xl p-5 text-center mx-auto">
              <h3 className="text-xl sm:text-2xl font-bold text-black mb-2 text-center mx-auto">
                4. Dual-Band Keyboard Focus &amp; Linear Navigation
              </h3>
              <p className="text-lg font-medium text-black leading-relaxed text-center mx-auto">
                All application functions are 100% operable via keyboard without a pointing device. Focus rings use a distinctive dual-contrast border (white inner and dark outer ring) ensuring unmistakable visibility across both light surfaces and Night Shift mode.
              </p>
            </div>

            {/* Standard 5 */}
            <div className="bg-white/50 border border-[#235338] rounded-xl p-5 text-center mx-auto">
              <h3 className="text-xl sm:text-2xl font-bold text-black mb-2 text-center mx-auto">
                5. Errorless Learning &amp; Autonomic Sensory Safeguards
              </h3>
              <p className="text-lg font-medium text-black leading-relaxed text-center mx-auto">
                Visual interfaces eliminate flashing elements and respect <code>prefers-reduced-motion</code> operating system settings. Activities employ errorless learning sequences with pre-printed trace lines to prevent anxiety, guessing fatigue, and catastrophic agitation.
              </p>
            </div>

            {/* Standard 6 */}
            <div className="bg-white/50 border border-[#235338] rounded-xl p-5 text-center mx-auto">
              <h3 className="text-xl sm:text-2xl font-bold text-black mb-2 text-center mx-auto">
                6. Zero Color Reliance &amp; Comprehensive Media Transcripts
              </h3>
              <p className="text-lg font-medium text-black leading-relaxed text-center mx-auto">
                Information is never conveyed through color alone. Status tags, care tiers, and progress indicators are always paired with explicit textual labels and distinct geometric icons. All media training lessons feature synchronized live captions and full transcripts.
              </p>
            </div>
          </div>
        </section>

        {/* Section 3: Honest Boundaries & Ongoing Audits */}
        <section
          aria-labelledby="heading-gaps"
          className="bg-white/65 border-2 border-[#1c442e] rounded-2xl p-6 sm:p-8 mb-8 shadow-sm text-center mx-auto"
        >
          <h2
            id="heading-gaps"
            className="text-2xl sm:text-3xl font-extrabold text-black mb-4 text-center mx-auto"
          >
            Transparent Accountability &amp; Continuous Testing
          </h2>
          <p className="text-lg sm:text-xl font-medium text-black leading-relaxed mb-4 text-center mx-auto max-w-3xl">
            We practice radical transparency. Every production build runs automated regression tests measuring DOM contrast ratios, focus order, and touch geometry. However, because real memory care environments present nuanced challenges, we continuously audit our tools with occupational therapists, activity professionals, and screen-reader users.
          </p>
          <p className="text-lg sm:text-xl font-medium text-black leading-relaxed text-center mx-auto max-w-3xl">
            Certain legacy customization dialogs feature rich parameter controls. While they pass automated WCAG AA/AAA tests, we are actively streamlining keyboard shortcuts to ensure rapid, fatigue-free navigation for staff operating on handheld tablets.
          </p>
        </section>

        {/* Section 4: Direct Feedback & Alternate Formats */}
        <section
          aria-labelledby="heading-feedback"
          className="bg-white/65 border-2 border-[#1c442e] rounded-2xl p-6 sm:p-8 mb-8 shadow-sm text-center mx-auto"
        >
          <h2
            id="heading-feedback"
            className="text-2xl sm:text-3xl font-extrabold text-black mb-4 text-center mx-auto"
          >
            Direct Caregiver Support &amp; Alternate Format Requests
          </h2>
          <p className="text-lg sm:text-xl font-medium text-black leading-relaxed mb-4 text-center mx-auto max-w-3xl">
            If you or a resident encounter any barrier, or if your facility requires activity sheets or clinical documentation in an alternative format—such as customized ultra-large print (36pt+), high-contrast tactile outlines, or verbal guidance scripts—we are here to support you immediately.
          </p>
          <p className="text-lg sm:text-xl font-semibold text-black leading-relaxed mb-6 text-center mx-auto max-w-3xl">
            Contact our senior engineering and clinical accessibility team directly at:
            <br />
            <a
              href="mailto:cognicopia@outlook.com?subject=Accessibility%20Support%20Request"
              className="inline-block mt-2 text-xl sm:text-2xl font-black text-black underline underline-offset-4 decoration-2 hover:decoration-4 transition"
            >
              cognicopia@outlook.com
            </a>
          </p>
          <p className="text-base sm:text-lg font-medium text-black text-center mx-auto">
            We personally review every communication and provide tailored accessibility accommodations within one business day.
          </p>
        </section>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 border-t-2 border-black/20 mx-auto text-center">
          <a
            href="mailto:cognicopia@outlook.com?subject=Accessibility%20Inquiry"
            className="w-full sm:w-auto inline-flex items-center justify-center min-h-[54px] px-8 py-3.5 rounded-xl border-2 border-black bg-white text-black text-lg font-bold shadow-md hover:bg-slate-100 transition text-center"
          >
            Ask an Accessibility Question
          </a>
          <a
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center min-h-[54px] px-8 py-3.5 rounded-xl border-2 border-black bg-[#1c442e] text-white text-lg font-bold shadow-md hover:bg-[#153423] transition text-center"
          >
            Return to Activity Tools
          </a>
        </div>
      </main>
    </div>
  );
}
