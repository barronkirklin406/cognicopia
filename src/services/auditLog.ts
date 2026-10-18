/* =====================================================================
   COGNICOPIA AUDIT LOG & COMPLIANCE SUMMARY SERVICE
   Aggregates non-PHI metrics for state inspection audit readiness.
   
   This service aggregates data from:
   - Facility scheduling data (cognicopia_facility_sched_*)
   - Audit trail in facility data
   - Packet generation events (when logged)
   
   All data is stored locally and never leaves the browser.
   No resident names or PHI are exposed in aggregated reports.
   
   Built into assets/services/auditLog.js (globalThis.CogniAuditLog) by
   scripts/build-services.mjs.
   @global CogniAuditLog
   ===================================================================== */

export const VERSION = "1.0.0";
export const STORE_KEY = "cognicopia_audit_log";

/* ---------- Timeframe types ---------- */
export type Timeframe = "7days" | "30days" | "month" | "custom";
export interface DateRange { start: string; end: string; }

/* ---------- Pathway mapping (acuity tier to clinical pathway) ---------- */
export type Pathway = "vascular" | "lewy_body" | "ftd" | "general";
export interface PathwayMapping { tier: number; pathway: Pathway; label: string; }

export const PATHWAYS: readonly PathwayMapping[] = [
  { tier: 1, pathway: "vascular", label: "Vascular Dementia Pathway" },
  { tier: 2, pathway: "lewy_body", label: "Lewy Body Dementia Pathway" },
  { tier: 3, pathway: "ftd", label: "Frontotemporal Dementia Pathway" },
  { tier: 4, pathway: "general", label: "General / Mixed Acuity" }
];

export const pathwayOf = (tier: number): PathwayMapping => {
  const t = Math.max(1, Math.min(4, Math.round(tier)));
  return PATHWAYS[t - 1];
};

/* ---------- Calming activity identifiers ---------- */
export const CALMING_ACTIVITIES = [
  "silhouette-match", "line-tracing", "letter-tracing", "number-tracing",
  "chair-yoga", "lyric-sheet", "seated-rhythm", "orientation-board"
] as const;

export const isCalming = (activityId: string): boolean => {
  return CALMING_ACTIVITIES.includes(activityId as any);
};

/* ---------- Aggregated metrics ---------- */
export interface Metrics {
  totalSessions: number;
  totalPackets: number;
  totalEngagementMinutes: number;
  totalCalmingInterventions: number;
  pathwayBreakdown: Record<Pathway, number>;
  pillarBreakdown: Record<string, number>;
  deescalationSheets: number;
  dateRange: DateRange;
  generatedAt: string;
}

export interface AuditTableRow {
  dateRange: string;
  totalSessions: number;
  primaryPathways: string;
  deescalationSheets: number;
  auditStatus: "compliant" | "review" | "incomplete";
}

/* ---------- Session record (from facility scheduling) ---------- */
export interface SessionRecord {
  id: string;
  date: string;
  time: string;
  groupId: string;
  groupName: string;
  wingId: string;
  wingName: string;
  acuityTier: number;
  activityId: string;
  activityName: string;
  pillar: string;
  minutes: number;
  isCalming: boolean;
  packetGenerated: boolean;
  packetPages: number;
}

/* ---------- Local storage for session logs ---------- */
export interface SessionLog {
  sessions: SessionRecord[];
  packetEvents: PacketEvent[];
}

export interface PacketEvent {
  id: string;
  timestamp: string;
  groupId: string;
  groupName: string;
  acuityTier: number;
  activityId: string;
  pages: number;
  isEmergency: boolean;
}

/* ---------- Data aggregation ---------- */
export function aggregateMetrics(
  sessions: SessionRecord[],
  packetEvents: PacketEvent[],
  timeframe: Timeframe,
  customRange?: DateRange
): Metrics {
  const range = getDateRange(timeframe, customRange);
  const filteredSessions = filterByDate(sessions, range);
  const filteredPackets = filterPacketsByDate(packetEvents, range);
  
  const totalSessions = filteredSessions.length;
  const totalPackets = filteredPackets.length;
  const totalEngagementMinutes = filteredSessions.reduce((sum, s) => sum + s.minutes, 0);
  const totalCalmingInterventions = filteredSessions.filter(s => s.isCalming).length;
  const deescalationSheets = filteredPackets.filter(p => p.isEmergency).length;
  
  // Pathway breakdown
  const pathwayBreakdown: Record<Pathway, number> = {
    vascular: 0,
    lewy_body: 0,
    ftd: 0,
    general: 0
  };
  
  filteredSessions.forEach(s => {
    const pathway = pathwayOf(s.acuityTier).pathway;
    pathwayBreakdown[pathway]++;
  });
  
  // Pillar breakdown
  const pillarBreakdown: Record<string, number> = {};
  filteredSessions.forEach(s => {
    pillarBreakdown[s.pillar] = (pillarBreakdown[s.pillar] || 0) + 1;
  });
  
  return {
    totalSessions,
    totalPackets,
    totalEngagementMinutes,
    totalCalmingInterventions,
    pathwayBreakdown,
    pillarBreakdown,
    deescalationSheets,
    dateRange: range,
    generatedAt: new Date().toISOString()
  };
}

export function buildAuditTable(
  metrics: Metrics,
  facilityName: string
): AuditTableRow[] {
  const rows: AuditTableRow[] = [];
  
  // Build one row for the selected timeframe
  const primaryPathways = Object.entries(metrics.pathwayBreakdown)
    .filter(([_, count]) => count > 0)
    .map(([pathway, count]) => `${formatPathway(pathway)} (${count})`)
    .join(", ") || "None";
  
  const auditStatus = determineAuditStatus(metrics);
  
  rows.push({
    dateRange: formatDateRange(metrics.dateRange),
    totalSessions: metrics.totalSessions,
    primaryPathways,
    deescalationSheets: metrics.deescalationSheets,
    auditStatus
  });
  
  return rows;
}

/* ---------- Helper functions ---------- */
function getDateRange(timeframe: Timeframe, custom?: DateRange): DateRange {
  const now = new Date();
  const end = now.toISOString().split("T")[0];
  let start: string;
  
  switch (timeframe) {
    case "7days":
      const sevenDays = new Date(now);
      sevenDays.setDate(sevenDays.getDate() - 7);
      start = sevenDays.toISOString().split("T")[0];
      break;
    case "30days":
      const thirtyDays = new Date(now);
      thirtyDays.setDate(thirtyDays.getDate() - 30);
      start = thirtyDays.toISOString().split("T")[0];
      break;
    case "month":
      start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      break;
    case "custom":
      start = custom?.start || end;
      const customEnd = custom?.end || end;
      return { start, end: customEnd };
    default:
      start = end;
  }
  
  return { start, end };
}

function filterByDate(sessions: SessionRecord[], range: DateRange): SessionRecord[] {
  return sessions.filter(s => s.date >= range.start && s.date <= range.end);
}

function filterPacketsByDate(packets: PacketEvent[], range: DateRange): PacketEvent[] {
  return packets.filter(p => p.timestamp >= range.start && p.timestamp <= range.end);
}

function formatPathway(pathway: string): string {
  const mapping = PATHWAYS.find(p => p.pathway === pathway);
  return mapping ? mapping.label : pathway;
}

function formatDateRange(range: DateRange): string {
  const start = new Date(range.start).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const end = new Date(range.end).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return start === end ? start : `${start} – ${end}`;
}

function determineAuditStatus(metrics: Metrics): "compliant" | "review" | "incomplete" {
  // Basic compliance checks
  if (metrics.totalSessions === 0) return "incomplete";
  if (metrics.totalEngagementMinutes < 60) return "review"; // Less than 1 hour of engagement
  if (metrics.totalCalmingInterventions === 0 && metrics.totalSessions > 10) return "review";
  return "compliant";
}

/* ---------- Session logging (for packet generation events) ---------- */
export function logPacketEvent(event: Omit<PacketEvent, "id" | "timestamp">): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  
  try {
    const key = STORE_KEY;
    const raw = window.localStorage.getItem(key);
    const log: SessionLog = raw ? JSON.parse(raw) : { sessions: [], packetEvents: [] };
    
    const newEvent: PacketEvent = {
      id: `pkt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      ...event
    };
    
    log.packetEvents.push(newEvent);
    
    // Keep only last 1000 events
    if (log.packetEvents.length > 1000) {
      log.packetEvents = log.packetEvents.slice(-1000);
    }
    
    window.localStorage.setItem(key, JSON.stringify(log));
  } catch (e) {
    // Silently fail if storage is not available
  }
}

export function readSessionLog(): SessionLog {
  if (typeof window === "undefined" || !window.localStorage) {
    return { sessions: [], packetEvents: [] };
  }
  
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : { sessions: [], packetEvents: [] };
  } catch (e) {
    return { sessions: [], packetEvents: [] };
  }
}

/* ---------- Import facility scheduling data ---------- */
export function importFacilitySessions(facilityData: any, wingId?: string): SessionRecord[] {
  if (!facilityData || !facilityData.wings) return [];
  
  const sessions: SessionRecord[] = [];
  const wings = wingId 
    ? facilityData.wings.filter((w: any) => w.id === wingId)
    : facilityData.wings;
  
  wings.forEach((wing: any) => {
    if (!wing.groups) return;
    
    wing.groups.forEach((group: any) => {
      // Sessions would be stored in wing-month records
      // This is a placeholder for when session data is available
      // For now, we'll generate sample records from the group structure
    });
  });
  
  return sessions;
}

/* ---------- Public API ---------- */
export const CogniAuditLog = {
  VERSION,
  aggregateMetrics,
  buildAuditTable,
  logPacketEvent,
  readSessionLog,
  importFacilitySessions,
  PATHWAYS,
  isCalming,
  pathwayOf
};
