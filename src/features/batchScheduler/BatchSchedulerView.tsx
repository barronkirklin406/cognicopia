/**
 * @file BatchSchedulerView.tsx
 * @description Executive dashboard for Memory Care Activity Directors to schedule,
 * customize, and generate bulk monthly individualized activity packets for dozens of residents.
 */

import React, { useState, useEffect } from 'react';
import {
  BatchJob,
  BatchScheduleConfig,
  BatchSchedulerProgress,
  ThemeTemplate
} from './types.js';
import { THEME_TEMPLATES, getThemeById } from './themeTemplates.js';
import { BatchPdfExporter } from './batchPdfExporter.js';
import { BatchQueueUI } from './BatchQueueUI.js';
import { DEFAULT_RESIDENTS } from '../familyBridge/DirectorMagicLinkModal.js';
import { ResidentProfile } from '../../engine/packetGenerator.js';

export const BatchSchedulerView: React.FC = () => {
  // Facility & Config state
  const [facilityName, setFacilityName] = useState('St. Jude Memory Care');
  const [batchName, setBatchName] = useState('Spring 2026 Monthly Curriculum');
  const [selectedThemeId, setSelectedThemeId] = useState('spring_gardening');
  const [timeFrame, setTimeFrame] = useState<'single_day' | 'one_week' | 'four_weeks_month'>('four_weeks_month');

  // Included activity checklist
  const [includeCover, setIncludeCover] = useState(true);
  const [includeWordSearch, setIncludeWordSearch] = useState(true);
  const [includeReminiscence, setIncludeReminiscence] = useState(true);
  const [includeTrivia, setIncludeTrivia] = useState(true);
  const [includeMatching, setIncludeMatching] = useState(true);

  // Resident roster & selection
  const [roster, setRoster] = useState<ResidentProfile[]>(DEFAULT_RESIDENTS);
  const [selectedResidentIds, setSelectedResidentIds] = useState<string[]>(DEFAULT_RESIDENTS.map(r => r.id));
  const [filterWing, setFilterWing] = useState<string>('all');
  const [filterTier, setFilterTier] = useState<string>('all');

  // Batch queue state
  const [jobs, setJobs] = useState<BatchJob[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<BatchSchedulerProgress>({
    totalJobs: 0,
    completedJobs: 0,
    failedJobs: 0,
    currentJobIndex: 0,
    currentResidentName: '',
    overallPercent: 0,
    startTime: 0,
    elapsedMs: 0,
    estimatedRemainingMs: 0,
    status: 'idle'
  });

  // Master PDF state
  const [masterPdfBlob, setMasterPdfBlob] = useState<Blob | null>(null);

  // Initialize queue on first load or theme change
  useEffect(() => {
    populateQueueFromSelectedResidents();
  }, [selectedResidentIds, selectedThemeId]);

  const populateQueueFromSelectedResidents = () => {
    const selectedResidents = roster.filter(r => selectedResidentIds.includes(r.id));
    const newJobs: BatchJob[] = selectedResidents.map(r => ({
      id: `job_${r.id}_${Date.now()}`,
      residentId: r.id,
      residentName: r.preferredName,
      unitNumber: r.unitNumber,
      wing: r.wing,
      cognitiveTier: r.cognitiveTier,
      motorCapabilityLevel: r.motorCapabilityLevel,
      pastVocation: r.pastVocation,
      status: 'queued',
      progressPercent: 0,
      currentPage: 0,
      totalPages: (includeCover ? 1 : 0) + (includeWordSearch ? 1 : 0) + (includeReminiscence ? 1 : 0) + (includeTrivia ? 1 : 0) + (includeMatching ? 1 : 0),
      generatedDate: new Date().toISOString().slice(0, 10),
      svgPages: [],
      fileName: `${r.preferredName.replace(/\s+/g, '_')}_${selectedThemeId}.pdf`
    }));
    setJobs(newJobs);
  };

  const toggleResidentSelection = (id: string) => {
    setSelectedResidentIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectAllRoster = () => {
    setSelectedResidentIds(roster.map(r => r.id));
  };

  const clearSelection = () => {
    setSelectedResidentIds([]);
  };

  // Build active batch config
  const getConfig = (): BatchScheduleConfig => ({
    batchName,
    facilityName,
    timeFrame,
    selectedThemeId,
    activitiesPerResident: {
      coverPage: includeCover,
      wordSearch: includeWordSearch,
      reminiscence: includeReminiscence,
      trivia: includeTrivia,
      matching: includeMatching
    },
    outputFormat: 'single_master_pdf',
    paperSize: 'letter',
    stampPersonalizedHeader: true
  });

  // Run the batch compilation in sequential async ticks
  const handleStartBatch = async () => {
    if (jobs.length === 0 || isProcessing) return;

    setIsProcessing(true);
    const config = getConfig();
    const updatedJobs = [...jobs];
    const startTime = Date.now();
    const allSvgPagesForMaster: string[] = [];

    setProgress({
      totalJobs: jobs.length,
      completedJobs: 0,
      failedJobs: 0,
      currentJobIndex: 0,
      currentResidentName: jobs[0]?.residentName || '',
      overallPercent: 0,
      startTime,
      elapsedMs: 0,
      estimatedRemainingMs: jobs.length * 1500,
      status: 'running'
    });

    for (let i = 0; i < updatedJobs.length; i++) {
      const job = updatedJobs[i];
      const resident = roster.find(r => r.id === job.residentId) || DEFAULT_RESIDENTS[0];

      // Update status to generating
      job.status = 'generating_svg';
      setJobs([...updatedJobs]);
      setProgress(prev => ({
        ...prev,
        currentJobIndex: i,
        currentResidentName: job.residentName,
        overallPercent: ((i) / updatedJobs.length) * 100
      }));

      // Short delay for fluid UI rendering
      await new Promise(r => setTimeout(r, 200));

      try {
        // Compile individualized SVG pages
        const compiled = BatchPdfExporter.compileResidentPacket(resident, config);
        job.svgPages = compiled.svgPages;
        job.totalPages = compiled.totalPages;
        allSvgPagesForMaster.push(...compiled.svgPages);

        job.status = 'compiling_pdf';
        setJobs([...updatedJobs]);
        await new Promise(r => setTimeout(r, 150));

        // Create individual PDF Blob
        const pdfBlob = await BatchPdfExporter.exportSvgsToPdf(job.svgPages, job.fileName);
        job.pdfBlob = pdfBlob;
        job.status = 'ready';
        job.progressPercent = 100;
      } catch (err: any) {
        console.error(`Batch job failed for ${job.residentName}:`, err);
        job.status = 'failed';
        job.error = err.message || 'Compilation error';
      }

      setJobs([...updatedJobs]);
    }

    // Now compile the Consolidated Master PDF
    try {
      const masterBlob = await BatchPdfExporter.exportSvgsToPdf(
        allSvgPagesForMaster,
        `${facilityName.replace(/\s+/g, '_')}_Master_Batch.pdf`
      );
      setMasterPdfBlob(masterBlob);
    } catch (e) {
      console.warn('Could not compile master bundle:', e);
    }

    setIsProcessing(false);
    setProgress(prev => ({
      ...prev,
      completedJobs: updatedJobs.filter(j => j.status === 'ready').length,
      failedJobs: updatedJobs.filter(j => j.status === 'failed').length,
      overallPercent: 100,
      status: 'completed'
    }));
  };

  const handlePauseBatch = () => {
    setIsProcessing(false);
  };

  const handleDownloadMasterPdf = () => {
    if (masterPdfBlob) {
      BatchPdfExporter.triggerDownload(
        masterPdfBlob,
        `${facilityName.replace(/\s+/g, '_')}_${selectedThemeId}_Master_Print_Packet.pdf`
      );
    } else {
      // Fallback: compile from all ready jobs
      const allReadyPages: string[] = [];
      jobs.filter(j => j.status === 'ready').forEach(j => allReadyPages.push(...j.svgPages));
      if (allReadyPages.length > 0) {
        BatchPdfExporter.exportSvgsToPdf(allReadyPages, 'master_batch.pdf').then(blob => {
          BatchPdfExporter.triggerDownload(blob, 'cognicopia_facility_master_batch.pdf');
        });
      }
    }
  };

  const handleDownloadSingleJobPdf = (job: BatchJob) => {
    if (job.pdfBlob) {
      BatchPdfExporter.triggerDownload(job.pdfBlob, job.fileName);
    } else if (job.svgPages.length > 0) {
      BatchPdfExporter.exportSvgsToPdf(job.svgPages, job.fileName).then(blob => {
        BatchPdfExporter.triggerDownload(blob, job.fileName);
      });
    }
  };

  const handleReorderJobs = (newJobs: BatchJob[]) => {
    setJobs(newJobs);
  };

  const handleRemoveJob = (id: string) => {
    setJobs(prev => prev.filter(j => j.id !== id));
  };

  // Filter roster
  const filteredRoster = roster.filter(r => {
    if (filterWing !== 'all' && !r.wing?.toLowerCase().includes(filterWing.toLowerCase())) {
      return false;
    }
    if (filterTier !== 'all' && String(r.cognitiveTier) !== filterTier) {
      return false;
    }
    return true;
  });

  const selectedTheme = getThemeById(selectedThemeId);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 font-sans text-neutral-900">
      {/* Top Banner */}
      <div className="bg-neutral-900 text-white rounded-2xl p-6 md:p-8 shadow-lg mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-neutral-800 text-emerald-400 text-xs font-semibold uppercase tracking-wider rounded-full mb-3">
            <span>🖨️</span> Facility Operations Dashboard
          </div>
          <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight">
            Bulk Facility Batch Scheduler
          </h1>
          <p className="text-neutral-300 text-sm md:text-base mt-2 max-w-2xl leading-relaxed">
            Generate a full month or week of individualized, clinical-grade cognitive activity packets
            for dozens of memory care residents in a single automated batch click.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <a
            href="family-bridge.html"
            className="px-5 py-3 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold rounded-xl border border-neutral-700 flex items-center justify-center gap-2 transition"
          >
            <span>🌉</span> Family Bridge Intake
          </a>
          <a
            href="builder.html"
            className="px-5 py-3 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl shadow-md flex items-center justify-center gap-2 transition"
          >
            <span>✏️</span> Single Packet Builder
          </a>
        </div>
      </div>

      {/* Grid Layout: Config Column (Left) & Batch Queue Column (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT COLUMN: THEME & ROSTER SELECTOR (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* STEP 1: THEMATIC CURRICULUM SELECTOR */}
          <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded">
                  Step 1
                </span>
                <h2 className="text-lg font-bold text-neutral-900 mt-1">Select Thematic Curriculum</h2>
              </div>
              <span className="text-xs text-neutral-500">6 Curated Themes</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              {THEME_TEMPLATES.map(theme => {
                const isSelected = selectedThemeId === theme.id;
                return (
                  <div
                    key={theme.id}
                    onClick={() => setSelectedThemeId(theme.id)}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-emerald-700 bg-emerald-50/50 shadow-xs'
                        : 'border-neutral-200 hover:border-neutral-300 bg-white'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{theme.icon}</span>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-sm text-neutral-900 leading-snug">{theme.title}</h4>
                        <p className="text-xs text-neutral-500 mt-1 line-clamp-2">{theme.description}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Selected Theme Detail Card */}
            <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 text-xs text-neutral-700 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-neutral-900">Active Theme Focus:</span>
                <span className="text-emerald-800 font-semibold">{selectedTheme.recommendedEra} Era</span>
              </div>
              <p>
                <strong>Sensory Pairing:</strong> {selectedTheme.tactileItemPairing}
              </p>
              <div className="flex flex-wrap gap-1 pt-1">
                {selectedTheme.vocabulary.slice(0, 8).map(w => (
                  <span key={w} className="bg-white border border-neutral-300 px-2 py-0.5 rounded text-[11px] font-mono">
                    {w}
                  </span>
                ))}
                <span className="text-neutral-400 text-[11px] self-center">+{selectedTheme.vocabulary.length - 8} more</span>
              </div>
            </div>
          </div>

          {/* STEP 2: RESIDENT ROSTER MULTI-SELECT */}
          <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded">
                  Step 2
                </span>
                <h2 className="text-lg font-bold text-neutral-900 mt-1">Select Facility Residents</h2>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={selectAllRoster}
                  className="font-bold text-emerald-800 hover:text-emerald-950 px-2 py-1 rounded bg-emerald-50"
                >
                  Select All ({roster.length})
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="font-medium text-neutral-600 hover:text-neutral-900 px-2 py-1"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Wing / Tier Filters */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 mb-1">Filter by Wing</label>
                <select
                  value={filterWing}
                  onChange={e => setFilterWing(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-neutral-300 bg-white"
                >
                  <option value="all">All Wings ({roster.length})</option>
                  <option value="West">West Wing</option>
                  <option value="South">South Courtyard</option>
                  <option value="North">North Wing</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 mb-1">Filter by Cognitive Tier</label>
                <select
                  value={filterTier}
                  onChange={e => setFilterTier(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-neutral-300 bg-white"
                >
                  <option value="all">All Cognitive Tiers</option>
                  <option value="1">Tier 1 (Early Stage)</option>
                  <option value="2">Tier 2 (Moderate)</option>
                  <option value="3">Tier 3 (Assisted / Sensory)</option>
                </select>
              </div>
            </div>

            {/* Resident Cards Grid */}
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {filteredRoster.map(resident => {
                const isSelected = selectedResidentIds.includes(resident.id);
                return (
                  <div
                    key={resident.id}
                    onClick={() => toggleResidentSelection(resident.id)}
                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/40'
                        : 'border-neutral-200 hover:border-neutral-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} // handled by parent onClick
                        className="w-4 h-4 rounded text-emerald-700 focus:ring-emerald-500 cursor-pointer"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-neutral-900">{resident.preferredName}</h4>
                          <span className="text-xs text-neutral-500">
                            (Rm {resident.unitNumber || 'N/A'})
                          </span>
                        </div>
                        <p className="text-xs text-neutral-600">
                          {resident.pastVocation} • {resident.wing}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded bg-neutral-100 text-neutral-800">
                        Tier {resident.cognitiveTier}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* STEP 3: SCHEDULE & WORKSHEET CONFIGURATION */}
          <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded">
              Step 3
            </span>
            <h2 className="text-lg font-bold text-neutral-900 mt-1 mb-4">Curriculum Duration &amp; Content Modules</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Schedule Time Frame</label>
                <select
                  value={timeFrame}
                  onChange={e => setTimeFrame(e.target.value as any)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-neutral-300 bg-white"
                >
                  <option value="four_weeks_month">Full Month Curriculum (4-Week Rotation)</option>
                  <option value="one_week">1-Week Intensive Packet</option>
                  <option value="single_day">Single Daily Activity Session</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Batch Title for Cover</label>
                <input
                  type="text"
                  value={batchName}
                  onChange={e => setBatchName(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-neutral-300"
                />
              </div>
            </div>

            {/* Activities Checklist */}
            <div className="pt-2 border-t border-neutral-100">
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 mb-2">
                Worksheets Included in Each Resident's Packet
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeCover}
                    onChange={e => setIncludeCover(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-700"
                  />
                  <span>Branded Cover Sheet</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeWordSearch}
                    onChange={e => setIncludeWordSearch(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-700"
                  />
                  <span>Large-Print Word Search</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeReminiscence}
                    onChange={e => setIncludeReminiscence(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-700"
                  />
                  <span>Reminiscence Prompt Cards</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeTrivia}
                    onChange={e => setIncludeTrivia(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-700"
                  />
                  <span>Personalized Trivia / Thought</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeMatching}
                    onChange={e => setIncludeMatching(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-700"
                  />
                  <span>Tactile Tracing &amp; Matching</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: BATCH QUEUE & PRODUCTION MONITOR (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          <BatchQueueUI
            jobs={jobs}
            progress={progress}
            isProcessing={isProcessing}
            onReorderJobs={handleReorderJobs}
            onRemoveJob={handleRemoveJob}
            onStartBatch={handleStartBatch}
            onPauseBatch={handlePauseBatch}
            onDownloadMasterPdf={handleDownloadMasterPdf}
            onDownloadSingleJobPdf={handleDownloadSingleJobPdf}
          />

          {/* Clinical Production Guardrails Box */}
          <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-6 text-xs text-neutral-600 space-y-2">
            <h4 className="font-bold text-neutral-800 text-sm flex items-center gap-2">
              <span>🛡️</span> Gerontological Printing Guardrails
            </h4>
            <p>
              Every page generated in this batch complies strictly with Cognicopia's 150 Master SVG Architecture:
            </p>
            <ul className="list-disc pl-4 space-y-1 text-neutral-700">
              <li><strong>Zero Grayscale Halftones:</strong> 100% pure black on pure white to prevent visual distortion or shadows in cataract patients.</li>
              <li><strong>18pt+ Typography Floor:</strong> Atkinson Hyperlegible high-legibility letterforms.</li>
              <li><strong>0.75" Binding Gutter:</strong> Formatted for standard 3-ring binder punching or comb binding.</li>
              <li><strong>Offline-First:</strong> Assembled entirely client-side with zero external cloud or PHI leaks.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
