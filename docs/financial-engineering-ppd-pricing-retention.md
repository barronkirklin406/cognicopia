# Financial Engineering, PPD Pricing Architecture & Customer Retention Analytics
**Product:** Cognicopia Enterprise SaaS  
**Target Sector:** Senior Living Operators, Memory Care Communities, Skilled Nursing Facilities (SNFs), CCRCs  
**Author:** Chief Financial Officer & Product Analytics Specialist  
**Core Financial Metrics:** Per Patient Day ($PPD$), Customer Acquisition Cost ($CAC$), Lifetime Value ($LTV$), Net Revenue Retention ($NRR$), Customer Health Score ($CHS$)  

---

## SECTION 1: FINANCIAL STRATEGY & ENTERPRISE UNIT ECONOMICS

In senior living long-term care operations, software pricing anchored to traditional "per named seat" or "per user" SaaS metrics triggers immediate friction. Frontline caregiver turnover averages 65%–85%, and facility controllers budget operating expenditures strictly on a **Per Patient Day ($PPD$)** or **Average Daily Census ($ADC$)** basis.

### 1.1 Enterprise SaaS Unit Economics ($LTV:CAC$)

Cognicopia’s Zero-Cloud client-side architecture dramatically suppresses cloud hosting overhead (zero server-side rendering Lambdas, zero persistent multi-tenant cloud databases, zero video/document streaming servers). This delivers a SaaS Gross Margin exceeding **92%**.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     ENTERPRISE SAAS UNIT ECONOMICS                          │
├───────────────────────────────────┬─────────────────────────────────────────┤
│ Metric                            │ Value / Performance Target              │
├───────────────────────────────────┼─────────────────────────────────────────┤
│ Average Annual Contract Value     │ $1,188 – $3,588 / facility / year       │
│ Gross Margin                      │ 92.4% (Zero-Cloud Client Compute)       │
│ Blended Customer Acquisition Cost │ $480.00 (Self-Serve AD -> ED Approval) │
│ Customer Lifetime (Average)       │ 4.8 Years (Sticky Facility Workflow)    │
│ Customer Lifetime Value ($LTV$)   │ $5,270.00 – $15,920.00                  │
│ $LTV : CAC$ Ratio                 │ 10.9x – 33.1x (Benchmark: > 3.0x)       │
│ CAC Payback Period                │ 3.2 Months (Benchmark: < 12 Months)     │
│ Net Revenue Retention ($NRR$)     │ 118% (Expansion via multi-wing / sites) │
│ Annual Gross Logo Churn Target    │ < 4.5%                                  │
└───────────────────────────────────┴─────────────────────────────────────────┘
```

---

## SECTION 2: PER PATIENT DAY ($PPD$) PRICING ARCHITECTURE

Facility controllers evaluate all dietary, medical, housekeeping, and recreation supplies against licensed bed capacity and Average Daily Census ($ADC$). The standard memory care recreation supply budget ranges between **$0.35 and $0.75 PPD**. Cognicopia prices between **$0.05 and $0.10 PPD**, allowing facilities to absorb the software directly into existing recreation operating budgets without special board or corporate CAPEX allocations.

### 2.1 The Mathematical Controller Model
Let:
- $B$ = Licensed Bed Capacity
- $O$ = Anticipated Occupancy Rate ($0.85 \le O \le 0.95$)
- $ADC$ = Average Daily Census = $B \times O$
- $D_m$ = Days in Billing Month ($30.416$ average)
- $P_{\text{monthly}}$ = Contracted Monthly Subscription Fee

The effective Per Patient Day rate ($PPD$) is derived by:
$$PPD = \frac{P_{\text{monthly}}}{ADC \times D_m} = \frac{P_{\text{monthly}}}{B \times O \times 30.416}$$

Conversely, when a regional controller sets a target PPD ceiling (e.g., $PPD_{\text{target}} = \$0.065$), the allowable monthly software license is:
$$P_{\text{monthly}} = PPD_{\text{target}} \times (B \times O) \times 30.416$$

---

### 2.2 Scaled Bed Capacity Pricing Matrix

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 PPD PRICING TIER SCHEDULE                                   │
├───────────────┬──────────────┬──────────────┬──────────────────┬──────────────┬─────────────┤
│ Facility Tier │ Bed Capacity │ Typical ADC  │ Monthly License  │ Annual Fee   │ Effective   │
│               │ (Licensed)   │ (90% Occ.)   │ (Net-30 / P2P)   │ (15% Disc.)  │ $PPD$       │
├───────────────┼──────────────┼──────────────┼──────────────────┼──────────────┼─────────────┤
│ Small Memory  │ 16 – 28 Beds │ 22 Residents │ $49.00 / month   │ $499 / year  │ $0.073 PPD  │
│ Community Pod │              │              │                  │              │             │
├───────────────┼──────────────┼──────────────┼──────────────────┼──────────────┼─────────────┤
│ Standard Care │ 30 – 50 Beds │ 38 Residents │ $79.00 / month   │ $799 / year  │ $0.068 PPD  │
│ Community     │              │              │                  │              │             │
├───────────────┼──────────────┼──────────────┼──────────────────┼──────────────┼─────────────┤
│ Large Memory  │ 52 – 80 Beds │ 62 Residents │ $119.00 / month  │ $1,199 / year│ $0.063 PPD  │
│ Wing / AL-MC  │              │              │                  │              │             │
├───────────────┼──────────────┼──────────────┼──────────────────┼──────────────┼─────────────┤
│ Campus CCRC / │ 82–150+ Beds │ 115 Resident │ $189.00 / month  │ $1,899 / year│ $0.054 PPD  │
│ Multi-Wing    │              │              │                  │              │             │
├───────────────┼──────────────┼──────────────┼──────────────────┼──────────────┼─────────────┤
│ Enterprise    │ 10+ Sites    │ Portfolio    │ Custom Master    │ Master GPO   │ < $0.050    │
│ Multi-Site    │ (Consolidated│ Consolidated │ Invoicing        │ Discount     │ PPD         │
└───────────────┴──────────────┴──────────────┴──────────────────┴──────────────┴─────────────┘
```

---

## SECTION 3: INTERACTIVE ROI & TIME-SAVINGS CALCULATOR

Senior living operators run on tight operating margins (often 8%–14% EBITDAR). An effective business case must prove hard-dollar labor recapture and tangible risk reduction.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         LABOR RECOVERY & ROI MODEL                          │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Activity Director Preparation Hours Saved:                               │
│    • Weekly manual research & puzzle scouring:        6.5 hours / week      │
│    • Individualized packet layout & printing:         5.0 hours / week      │
│    • Monthly 12-Month Life Planner calendar creation: 3.5 hours / week      │
│    • Family tour & newsletter preparation:            2.5 hours / week      │
│    Total Weekly Time Recovered:                      17.5 hours / week      │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. Financial Value of Recovered Labor:                                      │
│    • Blended Loaded Hourly Wage (Life Enrichment):    $24.50 / hour         │
│    • Monthly Recovered Labor Value (17.5 hrs x 4.33): $1,856.40 / month     │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. Cost Offsets & Consolidation:                                            │
│    • Eliminated Disparate P-Card Subscriptions:       $45.00 / month        │
│    • Subtotal Monthly Gross Value:                    $1,901.40 / month     │
│    • Less Cognicopia Monthly License (Standard Tier): -$79.00 / month       │
├─────────────────────────────────────────────────────────────────────────────┤
│ 4. Net Monthly Bottom-Line Benefit:                  +$1,822.40 / month     │
│    ANNUALIZED NET OPERATIONAL RETURN:                +$21,868.80 / year     │
│    NET ROI MULTIPLE:                                  24.1x Return          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Non-Labor Value Multipliers (Executive Director Valuation)
1. **CMS Tag F679 Deficiency Avoidance:** The average Class B/C CMS deficiency citation in skilled nursing carries state CMPs (Civil Monetary Penalties) ranging from **$3,500 to $22,000**, plus mandatory plans of correction. Documented 100% compliance provides institutional insurance.
2. **Census Stability (Move-Out Prevention):** Average memory care monthly resident rent is **$5,800/month**. If personalized engagement packets satisfy family concerns and prevent even one premature move-out every 24 months, the preserved revenue is **$69,600**.

---

## SECTION 4: PRIVACY-PRESERVING TELEMETRY ENGINE SPECIFICATION

To optimize customer success and predict churn without compromising Cognicopia’s **Zero-Cloud ePHI Commitment**, the telemetry architecture is decoupled from resident identities.

```
[ Client Browser Application ]
             │
             ├─► Action: "Rendered 5-page Packet"
             ├─► Action: "Clicked Instant Soothe"
             ├─► Action: "Exported Monthly Calendar"
             │
             ▼
   [ Anonymizing Event Sanitizer ]
   • Discard all resident names, room numbers, hometowns, life stories
   • Keep ONLY operational metadata: (Event Name, Duration, Page Count)
   • Attach Nonce + Daily Rotating Hash
             │
             ▼
   [ Cryptographic Differential Privacy Mask ]
   • Truncate timestamps to nearest hour
   • Tokenize facility license reference (`lic_hash = HMAC(LicenseKey, Salt)`)
             │
             ▼ (HTTPS POST /api/telemetry/pulse)
   [ Customer Success Metrics Aggregator (Cold Warehouse) ]
```

### 4.1 Telemetry Metric Payload Specification
```typescript
export interface FacilityPulseEvent {
  facilityLicenseHash: string;      // Pseudonymous facility identifier
  eventTimestampHour: string;       // YYYY-MM-DDTHH:00:00Z (Hourly truncated)
  clientVersion: string;            // App build version
  metric: 
    | 'APP_LOADED'
    | 'FIRST_PACKET_GENERATED'      // Time-to-first-value marker
    | 'PACKET_PRINT_COMPLETED'      // Volume utilization
    | 'BATCH_BUNDLE_COMPILED'       // High-efficiency marker
    | 'INSTANT_SOOTHE_TRIGGERED'    // Clinical distress de-escalation marker
    | 'CALENDAR_PLANNER_EXPORTED'   // Administrative adoption marker
    | 'ROSTER_CSV_IMPORTED';        // Full onboarding marker
  pageCount: number;                // Aggregate volume
  sessionDurationBucket: '<5m' | '5-15m' | '15-30m' | '>30m';
}
```

---

## SECTION 5: AUTOMATED CUSTOMER HEALTH SCORE (CHS) & EARLY-WARNING CHURN SYSTEM

Customer churn in enterprise senior care correlates with activity director turnover, lack of onboarding habituation within the first 14 days, or seasonal disengagement.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      CUSTOMER HEALTH SCORE (CHS) MODEL                      │
├─────────────────────────────────────┬────────┬──────────────────────────────┤
│ Behavioral Dimension                │ Weight │ Evaluation Metric            │
├─────────────────────────────────────┼────────┼──────────────────────────────┤
│ 1. Habitual Frequency (Weekly Cadence)│  30%   │ Active on >= 3 days per week │
│ 2. Volume Breadth (Monthly Packets) │  25%   │ >= 0.75 packets per ADC / mo │
│ 3. Feature Depth (Pillars Used)     │  20%   │ Uses Soothe + Plan + Packets │
│ 4. Time-to-First-Value (Onboarding) │  15%   │ 1st packet generated < 48 hrs│
│ 5. Staff Handoff Continuity         │  10%   │ Multiple workstations active │
├─────────────────────────────────────┴────────┴──────────────────────────────┤
│ Total Health Score: 0 – 100 Points                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.1 Health Score Stratification & Automated Intervention Triggers

```
[ Customer Health Score: 0 - 100 ]
             │
   ┌─────────┼─────────────────────────┐
   ▼         ▼                         ▼
[ 80 - 100 ] [ 50 - 79 ]             [ 0 - 49 ]
  GREEN        YELLOW                  RED
  Champion     At-Risk                 Critical Hazard
   │           │                       │
   │           ├─► Flag: No packets in 10 days
   │           ├─► Flag: Only 1 feature used
   │           │
   │           ▼
   │         [ Automated CS Playbook: Yellow ]
   │         • Email to AD with 1-click seasonal templates
   │         • CS outreach offering 15-min calendar setup assist
   │
   └───────────────────────────────────► [ Automated CS Playbook: Red ]
                                         • Churn alert dispatched to VP Sales
                                         • Suspect Activity Director turnover
                                         • Direct phone outreach to Executive Director
                                         • Offer turnkey staff re-onboarding session
```

#### The "Turnover Detection" Trigger:
If a facility generates 150+ packets/month for 4 consecutive months and then experiences **zero activity for 12 business days**, the CHS immediately transitions to **RED: Probable Employee Departure**.  
*Action:* Sales director contacts the Executive Director:  
*"Hi [ED Name], we noticed activity at Station 1 paused lately. In memory care, that usually means a change in your Life Enrichment team. We can jump on a 20-minute Zoom with your interim coordinator today to keep your daily resident packets flowing without disruption."*
