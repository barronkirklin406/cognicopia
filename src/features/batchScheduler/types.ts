/**
 * @file types.ts
 * @description Type definitions for the Cognicopia Bulk Facility Batch Scheduler.
 * Enables facility directors to select multiple resident profiles, apply thematic
 * templates, and generate a month's worth of individualized activity packets in bulk.
 */

import { CognitiveTier, MotorCapabilityLevel, ResidentProfile } from '../../engine/packetGenerator.js';

export type BatchJobStatus = 'queued' | 'generating_svg' | 'compiling_pdf' | 'ready' | 'failed' | 'paused';

export interface ThemeTemplate {
  id: string;
  title: string;
  subtitle: string;
  season: 'spring' | 'summer' | 'autumn' | 'winter' | 'all-season';
  icon: string;
  description: string;
  recommendedEra: string; // e.g. "1950s"
  tactileItemPairing: string; // e.g. "smooth wooden token, garden seed packet"
  vocabulary: string[];
  reminiscencePrompts: Array<{
    invitation: string;
    followUp: string;
    sensoryCue: string;
  }>;
  triviaQuestions: Array<{
    prompt: string;
    options: [string, string];
    answer: string;
  }>;
  matchingPairs: Array<{
    left: string;
    right: string;
    symbol: string;
  }>;
}

export interface BatchScheduleConfig {
  batchName: string;
  facilityName: string;
  timeFrame: 'single_day' | 'one_week' | 'four_weeks_month';
  selectedThemeId: string;
  activitiesPerResident: {
    coverPage: boolean;
    wordSearch: boolean;
    reminiscence: boolean;
    trivia: boolean;
    matching: boolean;
  };
  outputFormat: 'single_master_pdf' | 'individual_pdfs';
  paperSize: 'letter' | 'a4';
  stampPersonalizedHeader: boolean;
}

export interface BatchJob {
  id: string;
  residentId: string;
  residentName: string;
  unitNumber?: string;
  wing?: string;
  cognitiveTier: CognitiveTier;
  motorCapabilityLevel: MotorCapabilityLevel;
  pastVocation: string;
  status: BatchJobStatus;
  progressPercent: number;
  currentPage: number;
  totalPages: number;
  error?: string;
  generatedDate: string;
  svgPages: string[];
  pdfBlob?: Blob;
  pdfDataUri?: string;
  fileName: string;
}

export interface BatchSchedulerProgress {
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  currentJobIndex: number;
  currentResidentName: string;
  overallPercent: number;
  startTime: number;
  elapsedMs: number;
  estimatedRemainingMs: number;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error';
}

export interface BatchExportResult {
  success: boolean;
  totalPackets: number;
  totalPages: number;
  masterPdfBlob?: Blob;
  individualBlobs?: Array<{ residentName: string; blob: Blob; fileName: string }>;
  elapsedSeconds: number;
  downloadUrl?: string;
}
