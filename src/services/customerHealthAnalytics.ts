/**
 * @file customerHealthAnalytics.ts
 * @description Enterprise SaaS financial engineering, PPD pricing calculations,
 * privacy-preserving telemetry tracking, and automated Customer Health Scoring (CHS).
 * Designed for senior living enterprise contract administration and churn mitigation.
 * @global CogniCustomerHealthAnalytics
 */

export interface FacilityCapacityProfile {
  licensedBeds: number;
  occupancyRate: number; // e.g. 0.90 for 90%
  facilityTier: 'small' | 'standard' | 'large' | 'campus';
  contractType: 'monthly' | 'annual';
}

export interface PpdPricingResult {
  licensedBeds: number;
  averageDailyCensus: number;
  monthlyFee: number;
  annualFee: number;
  effectivePpd: number;
  annualSavingsPercent: number;
}

export interface LaborRoiParameters {
  weeklyHoursResearching: number;
  weeklyHoursFormatting: number;
  weeklyHoursCalendar: number;
  weeklyHoursFamilyTourPrep: number;
  loadedHourlyWage: number; // e.g., $24.50
  eliminatedSoftwareSpendMonthly: number; // e.g., $45
  monthlyLicenseFee: number; // e.g., $79
}

export interface LaborRoiResult {
  totalHoursSavedWeekly: number;
  totalHoursSavedMonthly: number;
  grossLaborSavingsMonthly: number;
  netFinancialBenefitMonthly: number;
  annualizedNetReturn: number;
  roiMultiple: number; // e.g., 24.1x
}

export interface TelemetryPulseEvent {
  metric:
    | 'APP_LOADED'
    | 'FIRST_PACKET_GENERATED'
    | 'PACKET_PRINT_COMPLETED'
    | 'BATCH_BUNDLE_COMPILED'
    | 'INSTANT_SOOTHE_TRIGGERED'
    | 'CALENDAR_PLANNER_EXPORTED'
    | 'ROSTER_CSV_IMPORTED';
  pageCount: number;
  timestampMs: number;
  durationSeconds: number;
}

export interface CustomerHealthScoreResult {
  score: number; // 0 to 100
  status: 'GREEN' | 'YELLOW' | 'RED';
  activeDaysLast30Days: number;
  totalPacketsLast30Days: number;
  featuresUsedCount: number;
  daysSinceLastActivity: number;
  turnoverRiskDetected: boolean;
  renewalRecommendation: string;
  actionablePlaybook: string;
}

export class CustomerHealthAnalytics {
  private readonly facilitySalt: string;
  private readonly pulseStorageKey: string = 'cognicopia_telemetry_pulses';

  constructor(facilitySalt: string = 'cogni_telemetry_salt_v1') {
    this.facilitySalt = facilitySalt;
  }

  /** The salt this instance was made with (read-only). */
  get salt(): string {
    return this.facilitySalt;
  }

  // ---------------------------------------------------------------------------
  // 1. PPD Pricing Engine
  // ---------------------------------------------------------------------------

  public calculatePpdPricing(profile: FacilityCapacityProfile): PpdPricingResult {
    const beds = Math.max(1, profile.licensedBeds);
    const occ = Math.max(0.1, Math.min(1.0, profile.occupancyRate || 0.9));
    const adc = Math.round(beds * occ);
    const daysInMonth = 30.416;

    let monthlyFee = 79.0;
    if (beds <= 28) monthlyFee = 49.0;
    else if (beds <= 50) monthlyFee = 79.0;
    else if (beds <= 80) monthlyFee = 119.0;
    else monthlyFee = 189.0;

    const annualFee = Math.round(monthlyFee * 12 * 0.85); // 15% annual discount
    const billFee = profile.contractType === 'annual' ? annualFee / 12 : monthlyFee;
    const effectivePpd = parseFloat((billFee / (adc * daysInMonth)).toFixed(4));

    return {
      licensedBeds: beds,
      averageDailyCensus: adc,
      monthlyFee,
      annualFee,
      effectivePpd,
      annualSavingsPercent: 15,
    };
  }

  // ---------------------------------------------------------------------------
  // 2. Labor Savings & ROI Calculator
  // ---------------------------------------------------------------------------

  public calculateRoi(params: LaborRoiParameters): LaborRoiResult {
    const weeklyHours =
      params.weeklyHoursResearching +
      params.weeklyHoursFormatting +
      params.weeklyHoursCalendar +
      params.weeklyHoursFamilyTourPrep;

    const monthlyHours = weeklyHours * 4.333;
    const grossLaborMonthly = monthlyHours * params.loadedHourlyWage;
    const totalGrossBenefit = grossLaborMonthly + params.eliminatedSoftwareSpendMonthly;
    const netMonthly = totalGrossBenefit - params.monthlyLicenseFee;
    const annualizedReturn = netMonthly * 12;
    const roiMultiple = params.monthlyLicenseFee > 0 ? parseFloat((totalGrossBenefit / params.monthlyLicenseFee).toFixed(1)) : 0;

    return {
      totalHoursSavedWeekly: parseFloat(weeklyHours.toFixed(1)),
      totalHoursSavedMonthly: Math.round(monthlyHours),
      grossLaborSavingsMonthly: Math.round(grossLaborMonthly),
      netFinancialBenefitMonthly: Math.round(netMonthly),
      annualizedNetReturn: Math.round(annualizedReturn),
      roiMultiple,
    };
  }

  // ---------------------------------------------------------------------------
  // 3. Privacy-Preserving Telemetry Logging
  // ---------------------------------------------------------------------------

  /**
   * Records an operational milestone without tracking any resident names, dates of birth,
   * or cognitive notes. Only raw functional volumes and quantised metrics are stored.
   */
  public logOperationalPulse(
    metric: TelemetryPulseEvent['metric'],
    pageCount: number = 1,
    durationSeconds: number = 0
  ): void {
    const event: TelemetryPulseEvent = {
      metric,
      pageCount: Math.max(1, pageCount),
      timestampMs: Date.now(),
      durationSeconds: Math.round(durationSeconds),
    };

    try {
      const stored = localStorage.getItem(this.pulseStorageKey);
      const list: TelemetryPulseEvent[] = stored ? JSON.parse(stored) : [];
      list.push(event);

      // Keep last 3,000 pulses in local rolling telemetry ring
      if (list.length > 3000) list.shift();
      localStorage.setItem(this.pulseStorageKey, JSON.stringify(list));
    } catch (e) {
      console.warn('Could not persist telemetry pulse:', e);
    }
  }

  // ---------------------------------------------------------------------------
  // 4. Customer Health Scoring (CHS) Engine
  // ---------------------------------------------------------------------------

  /**
   * Evaluates the local usage history and calculates an objective 0-100 Customer Health Score.
   * Identifies silent churn risks (e.g., sudden frontline activity director turnover).
   */
  public evaluateCustomerHealth(licensedBeds: number = 40): CustomerHealthScoreResult {
    let pulses: TelemetryPulseEvent[] = [];
    try {
      const stored = localStorage.getItem(this.pulseStorageKey);
      if (stored) pulses = JSON.parse(stored);
    } catch {
      pulses = [];
    }

    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 86400 * 1000;
    const recentPulses = pulses.filter((p) => p.timestampMs >= thirtyDaysAgo);

    // Dimension 1: Active Days (30% weight)
    const activeDaysSet = new Set(recentPulses.map((p) => new Date(p.timestampMs).toISOString().slice(0, 10)));
    const activeDaysCount = activeDaysSet.size;
    // Ideal: 12-16 active days per month
    const frequencyScore = Math.min(30, Math.round((activeDaysCount / 14) * 30));

    // Dimension 2: Volume Breadth (25% weight)
    const totalPages = recentPulses.reduce((sum, p) => sum + p.pageCount, 0);
    const expectedMonthlyPages = licensedBeds * 4; // ~4 pages per bed per month minimum
    const volumeScore = Math.min(25, Math.round((totalPages / Math.max(1, expectedMonthlyPages)) * 25));

    // Dimension 3: Feature Depth (20% weight)
    const featuresUsed = new Set(recentPulses.map((p) => p.metric));
    const depthScore = Math.min(20, featuresUsed.size * 5);

    // Dimension 4: Recency & Continuity (25% weight)
    const lastPulseMs = pulses.length > 0 ? pulses[pulses.length - 1].timestampMs : 0;
    const daysSinceLastActivity = lastPulseMs > 0 ? Math.floor((now - lastPulseMs) / (86400 * 1000)) : 99;

    let recencyScore = 25;
    if (daysSinceLastActivity > 14) recencyScore = 0;
    else if (daysSinceLastActivity > 7) recencyScore = 10;
    else if (daysSinceLastActivity > 3) recencyScore = 18;

    const totalScore = Math.max(0, Math.min(100, frequencyScore + volumeScore + depthScore + recencyScore));

    // Sudden turnover detector: Previously high usage, but quiet for > 10 days
    const hadHighPriorUsage = pulses.length > 100;
    const turnoverRiskDetected = hadHighPriorUsage && daysSinceLastActivity >= 10;

    let status: 'GREEN' | 'YELLOW' | 'RED' = 'GREEN';
    let recommendation = 'Account is healthy. Approach for multi-wing expansion or multi-year renewal.';
    let playbook = 'Automated check-in; share seasonal activity pack updates.';

    if (totalScore < 50 || turnoverRiskDetected) {
      status = 'RED';
      recommendation = 'Critical churn risk. Frontline coordinator turnover suspected.';
      playbook = 'Direct phone call to Executive Director to offer turnkey re-onboarding for interim staff.';
    } else if (totalScore < 80) {
      status = 'YELLOW';
      recommendation = 'Moderate adoption risk. Utilization below licensed bed potential.';
      playbook = 'Dispatch email with 1-click batch calendar templates and invite Activity Director to 15-min coaching.';
    }

    return {
      score: totalScore,
      status,
      activeDaysLast30Days: activeDaysCount,
      totalPacketsLast30Days: totalPages,
      featuresUsedCount: featuresUsed.size,
      daysSinceLastActivity,
      turnoverRiskDetected,
      renewalRecommendation: recommendation,
      actionablePlaybook: playbook,
    };
  }
}
