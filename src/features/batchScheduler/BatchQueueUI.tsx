/**
 * @file BatchQueueUI.tsx
 * @description Interactive drag-and-drop batch queue UI with live progress indicators,
 * real-time status badges, and bulk PDF export triggers.
 */

import React, { useState } from 'react';
import { BatchJob, BatchSchedulerProgress } from './types.js';
import { BatchPdfExporter } from './batchPdfExporter.js';

interface BatchQueueUIProps {
  jobs: BatchJob[];
  progress: BatchSchedulerProgress;
  isProcessing: boolean;
  onReorderJobs: (newJobs: BatchJob[]) => void;
  onRemoveJob: (id: string) => void;
  onStartBatch: () => void;
  onPauseBatch: () => void;
  onDownloadMasterPdf: () => void;
  onDownloadSingleJobPdf: (job: BatchJob) => void;
}

export const BatchQueueUI: React.FC<BatchQueueUIProps> = ({
  jobs,
  progress,
  isProcessing,
  onReorderJobs,
  onRemoveJob,
  onStartBatch,
  onPauseBatch,
  onDownloadMasterPdf,
  onDownloadSingleJobPdf
}) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Drag-and-drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const reordered = [...jobs];
    const [moved] = reordered.splice(draggedIndex, 1);
    reordered.splice(index, 0, moved);
    setDraggedIndex(index);
    onReorderJobs(reordered);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const moveUp = (index: number) => {
    if (index <= 0) return;
    const reordered = [...jobs];
    const temp = reordered[index - 1];
    reordered[index - 1] = reordered[index];
    reordered[index] = temp;
    onReorderJobs(reordered);
  };

  const moveDown = (index: number) => {
    if (index >= jobs.length - 1) return;
    const reordered = [...jobs];
    const temp = reordered[index + 1];
    reordered[index + 1] = reordered[index];
    reordered[index] = temp;
    onReorderJobs(reordered);
  };

  const readyJobsCount = jobs.filter(j => j.status === 'ready').length;
  const isAllReady = jobs.length > 0 && readyJobsCount === jobs.length;

  return (
    <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden">
      {/* Queue Header & Actions */}
      <div className="p-6 border-b border-neutral-200 bg-neutral-50/70 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">🗂️</span>
            <h3 className="text-lg font-bold text-neutral-900">
              Bulk Production Queue ({jobs.length} Residents)
            </h3>
          </div>
          <p className="text-xs text-neutral-600">
            Drag to prioritize printing order. Individualized SVGs will be compiled and formatted with 18pt+ typography floor.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isProcessing ? (
            <button
              type="button"
              onClick={onPauseBatch}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition"
            >
              <span>⏸</span> Pause Batch
            </button>
          ) : (
            <button
              type="button"
              disabled={jobs.length === 0 || isAllReady}
              onClick={onStartBatch}
              className={`px-5 py-2.5 text-xs font-bold rounded-lg shadow-sm flex items-center gap-2 transition ${
                jobs.length === 0 || isAllReady
                  ? 'bg-neutral-200 text-neutral-500 cursor-not-allowed'
                  : 'bg-emerald-700 hover:bg-emerald-800 text-white'
              }`}
            >
              <span>⚡</span> Generate All {jobs.length} Packets
            </button>
          )}

          {readyJobsCount > 0 && (
            <button
              type="button"
              onClick={onDownloadMasterPdf}
              className="px-4 py-2.5 bg-neutral-900 hover:bg-black text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition"
            >
              <span>📄</span> Download Master PDF ({readyJobsCount} Packets)
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar Display */}
      {(isProcessing || progress.status === 'completed' || readyJobsCount > 0) && (
        <div className="px-6 py-4 bg-emerald-50/60 border-b border-emerald-100">
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-950 mb-1.5">
            <span className="flex items-center gap-1.5">
              <span className={isProcessing ? 'animate-spin' : ''}>⚙️</span>
              {isProcessing
                ? `Compiling Packet for: ${progress.currentResidentName || 'Processing...'}`
                : isAllReady
                ? '✓ All Facility Packets Successfully Compiled & Ready to Print'
                : `Progress: ${readyJobsCount} of ${jobs.length} Complete`}
            </span>
            <span className="font-mono text-emerald-800">{Math.round(progress.overallPercent)}%</span>
          </div>

          <div className="w-full bg-emerald-200/70 h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-emerald-600 h-full rounded-full transition-all duration-300 ease-out"
              style={{ width: `${Math.max(progress.overallPercent, (readyJobsCount / Math.max(jobs.length, 1)) * 100)}%` }}
            />
          </div>

          <div className="flex justify-between items-center text-[11px] text-emerald-800/80 mt-1.5">
            <span>
              Completed: <strong>{readyJobsCount}</strong> / {jobs.length}
            </span>
            <span>
              Format: <strong>Letter (612x792 pt)</strong> • High-Contrast Vector
            </span>
          </div>
        </div>
      )}

      {/* Reorderable Queue List */}
      <div className="divide-y divide-neutral-200 max-h-[460px] overflow-y-auto">
        {jobs.length === 0 ? (
          <div className="p-12 text-center text-neutral-500">
            <span className="text-3xl mb-2 block">📋</span>
            <p className="font-semibold text-neutral-700 text-sm">Batch Queue is Empty</p>
            <p className="text-xs text-neutral-500 mt-1">
              Select residents from the facility roster above and click "Add to Batch" to stage printing.
            </p>
          </div>
        ) : (
          jobs.map((job, idx) => {
            const isCurrent = isProcessing && progress.currentResidentName === job.residentName;

            return (
              <div
                key={job.id}
                draggable={!isProcessing}
                onDragStart={e => handleDragStart(e, idx)}
                onDragOver={e => handleDragOver(e, idx)}
                onDragEnd={handleDragEnd}
                className={`p-4 flex items-center justify-between gap-4 transition-colors ${
                  isCurrent
                    ? 'bg-amber-50/80 border-l-4 border-amber-500'
                    : job.status === 'ready'
                    ? 'bg-white hover:bg-emerald-50/30'
                    : 'bg-white hover:bg-neutral-50'
                }`}
              >
                {/* Drag Handle & Ordering */}
                <div className="flex items-center gap-3">
                  <div
                    className="cursor-grab active:cursor-grabbing text-neutral-400 hover:text-neutral-700 text-sm font-mono select-none px-1"
                    title="Drag to reorder"
                  >
                    ⠿ {idx + 1}
                  </div>

                  {/* Resident Info Badge */}
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-neutral-900">{job.residentName}</h4>
                      <span className="text-xs text-neutral-500">
                        ({job.wing || 'Memory Care'}, Rm {job.unitNumber || 'N/A'})
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-neutral-500 mt-0.5">
                      <span className="bg-neutral-100 px-2 py-0.5 rounded text-[11px] font-medium text-neutral-700">
                        Tier {job.cognitiveTier}
                      </span>
                      <span>•</span>
                      <span>{job.pastVocation || 'General'}</span>
                    </div>
                  </div>
                </div>

                {/* Status Indicator & Actions */}
                <div className="flex items-center gap-3">
                  {/* Status Badge */}
                  {job.status === 'queued' && (
                    <span className="px-2.5 py-1 bg-neutral-100 text-neutral-700 text-xs font-semibold rounded-full">
                      Queued
                    </span>
                  )}
                  {job.status === 'generating_svg' && (
                    <span className="px-2.5 py-1 bg-amber-100 text-amber-900 text-xs font-semibold rounded-full animate-pulse flex items-center gap-1">
                      <span>⚡</span> SVG Vector
                    </span>
                  )}
                  {job.status === 'compiling_pdf' && (
                    <span className="px-2.5 py-1 bg-blue-100 text-blue-900 text-xs font-semibold rounded-full animate-pulse flex items-center gap-1">
                      <span>📄</span> Compiling PDF
                    </span>
                  )}
                  {job.status === 'ready' && (
                    <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full flex items-center gap-1">
                      <span>✓</span> Ready ({job.totalPages || 5} pgs)
                    </span>
                  )}
                  {job.status === 'failed' && (
                    <span className="px-2.5 py-1 bg-red-100 text-red-800 text-xs font-bold rounded-full">
                      Error
                    </span>
                  )}

                  {/* Single Download button */}
                  {job.status === 'ready' && (
                    <button
                      type="button"
                      onClick={() => onDownloadSingleJobPdf(job)}
                      className="text-xs text-emerald-800 hover:text-emerald-950 font-bold px-2 py-1 rounded hover:bg-emerald-100 transition"
                      title="Download this resident's packet"
                    >
                      Download PDF ↓
                    </button>
                  )}

                  {/* Up / Down Controls */}
                  {!isProcessing && (
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveUp(idx)}
                        className="text-[10px] text-neutral-500 hover:text-black disabled:opacity-30 leading-none p-1"
                        title="Move Up"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        disabled={idx === jobs.length - 1}
                        onClick={() => moveDown(idx)}
                        className="text-[10px] text-neutral-500 hover:text-black disabled:opacity-30 leading-none p-1"
                        title="Move Down"
                      >
                        ▼
                      </button>
                    </div>
                  )}

                  {/* Remove from queue */}
                  {!isProcessing && (
                    <button
                      type="button"
                      onClick={() => onRemoveJob(job.id)}
                      className="text-neutral-400 hover:text-red-600 p-1 rounded text-sm transition"
                      title="Remove from batch"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Queue Footer */}
      <div className="p-4 bg-neutral-50 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between text-xs text-neutral-600 gap-2">
        <span className="flex items-center gap-1.5">
          <span>🖨️</span> Facility Print Ready: 0.5" Margins + 0.75" Binding Gutter
        </span>
        <span className="text-neutral-500">
          Estimated Print Batch Time: ~{Math.ceil(jobs.length * 1.5)} seconds
        </span>
      </div>
    </div>
  );
};
