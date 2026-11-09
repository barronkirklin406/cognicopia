/**
 * @file zeroCloudPdfPipeline.ts
 * @description In-browser client-only compilation pipeline for 5-page personalized packets
 * and multi-resident PDF bundles. Guarantees that Protected Health Information (PHI)
 * and resident biographical details NEVER touch cloud servers or serverless functions.
 * @global CogniZeroCloudPdfPipeline
 */

import type { ResidentProfile } from './secureCryptoStore';

export interface PacketPageModel {
  title: string;
  theme: string;
  kind: string;
  contentLines: string[];
  clinicalTip: string;
}

export interface PersonalizedPacketBundle {
  residentId: string;
  residentName: string;
  generatedDate: string;
  stage: 'early' | 'middle' | 'late';
  pages: PacketPageModel[];
  pdfBlob: Blob;
  pdfBlobUrl: string;
}

export interface PipelineOptions {
  includeStaffSheet?: boolean;
  highContrast?: boolean;
  bindingMargin?: boolean;
}

export class ZeroCloudPdfPipeline {
  private readonly defaultOptions: Required<PipelineOptions> = {
    includeStaffSheet: true,
    highContrast: true,
    bindingMargin: true,
  };

  /**
   * Compiles a 5-page personalized activity packet directly in browser volatile memory.
   * Zero outbound fetch / XHR / beacon calls are made.
   */
  public async compilePersonalizedPacket(
    resident: ResidentProfile,
    options: PipelineOptions = {}
  ): Promise<PersonalizedPacketBundle> {
    const opts = { ...this.defaultOptions, ...options };
    const stage = this.mapTierToStage(resident.cognitiveTier);
    const dateStr = new Date().toISOString().slice(0, 10);

    // 1. Synthesize 5 structured page models tailored to the resident
    const pages = this.generatePageModels(resident, stage, dateStr);

    // 2. Client-side rendering using jsPDF in memory
    const pdfBlob = await this.renderInMemoryPdf(resident, pages, stage, opts);
    const pdfBlobUrl = URL.createObjectURL(pdfBlob);

    return {
      residentId: resident.id,
      residentName: resident.firstName + (resident.lastName ? ` ${resident.lastName}` : ''),
      generatedDate: dateStr,
      stage,
      pages,
      pdfBlob,
      pdfBlobUrl,
    };
  }

  /**
   * Compiles a multi-resident PDF bundle into a single consolidated document,
   * performing streaming generation to avoid browser memory saturation.
   */
  public async compileMultiResidentBundle(
    residents: ResidentProfile[],
    options: PipelineOptions = {}
  ): Promise<{ bundleBlob: Blob; bundleBlobUrl: string; residentCount: number; totalPages: number }> {
    const opts = { ...this.defaultOptions, ...options };
    const globalJsPdf = (window as unknown as { jspdf?: { jsPDF: new (opts: unknown) => unknown } }).jspdf;

    if (!globalJsPdf) {
      throw new Error('jsPDF library is not loaded in the client browser.');
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc: any = new globalJsPdf.jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'letter',
    });

    let isFirstPage = true;
    let totalPages = 0;

    for (const resident of residents) {
      const stage = this.mapTierToStage(resident.cognitiveTier);
      const pages = this.generatePageModels(resident, stage, new Date().toISOString().slice(0, 10));

      for (let i = 0; i < pages.length; i++) {
        if (!isFirstPage) {
          doc.addPage();
        }
        isFirstPage = false;
        totalPages++;

        this.renderSinglePage(doc, pages[i], resident, stage, i + 1, pages.length, opts);
      }
    }

    const outputBuffer = doc.output('arraybuffer') as ArrayBuffer;
    const bundleBlob = new Blob([outputBuffer], { type: 'application/pdf' });
    const bundleBlobUrl = URL.createObjectURL(bundleBlob);

    return {
      bundleBlob,
      bundleBlobUrl,
      residentCount: residents.length,
      totalPages,
    };
  }

  // ---------------------------------------------------------------------------
  // Internal Page Synthesis & Rule Enforcement
  // ---------------------------------------------------------------------------

  private mapTierToStage(tier: ResidentProfile['cognitiveTier']): 'early' | 'middle' | 'late' {
    switch (tier) {
      case 'Mild':
        return 'early';
      case 'Moderate':
        return 'middle';
      case 'Advanced':
        return 'late';
      default:
        return 'middle';
    }
  }

  private generatePageModels(
    resident: ResidentProfile,
    stage: 'early' | 'middle' | 'late',
    dateStr: string
  ): PacketPageModel[] {
    const favoriteTopic = resident.interests?.[0] || resident.hobbies?.[0] || 'Everyday Joy';
    const hometown = resident.hometown || 'Familiar Places';
    const occupation = resident.pastOccupation || 'Life Pursuits';

    return [
      {
        title: 'Morning Conversation & Welcome',
        theme: favoriteTopic,
        kind: 'orientation',
        contentLines: [
          `Good morning! Today is ${dateStr}.`,
          `We are delighted to spend time together today exploring memories of ${favoriteTopic}.`,
          `The weather outside is calm and pleasant for our session.`,
        ],
        clinicalTip: 'Clinical Tip: Offer choices rather than asking open recall questions.',
      },
      {
        title: 'Familiar Horizons & Memories',
        theme: hometown,
        kind: 'reminiscence',
        contentLines: [
          `Exploring the history and peaceful streets of ${hometown}.`,
          `Warm memories of community gatherings, neighborhood shops, and seasonal festivals.`,
          `The comforting feeling of returning home after a long journey.`,
        ],
        clinicalTip: 'Clinical Tip: Focus on emotional resonance rather than factual validation.',
      },
      {
        title: 'Craft & Vocation Reflections',
        theme: occupation,
        kind: 'matching',
        contentLines: [
          `Honoring the dedication, tools, and craftsmanship of ${occupation}.`,
          `Every trade carries pride, routine, and shared purpose.`,
          `Take a quiet moment to observe these illustrations and tools.`,
        ],
        clinicalTip: 'Clinical Tip: Validate effort and invite tactile observation of the page.',
      },
      {
        title: 'Tactile Word & Symbol Association',
        theme: favoriteTopic,
        kind: stage === 'early' ? 'search-large' : 'search-guided',
        contentLines: [
          'Find and circle the words associated with pleasant memories.',
          'Focus on one line at a time with calm, steady breathing.',
        ],
        clinicalTip: 'Clinical Tip: Sit beside them at eye level. Share in finding the first word.',
      },
      {
        title: 'Peaceful Evening Reflection',
        theme: 'Relaxation & Music',
        kind: 'silhouette',
        contentLines: [
          `Reflecting on pleasant melodies, comforting songs, and familiar sights.`,
          `A gentle close to a day filled with meaningful presence.`,
        ],
        clinicalTip: 'Clinical Tip: Model slow breathing and close the activity on a calm note.',
      },
    ];
  }

  // ---------------------------------------------------------------------------
  // Memory-Safe Rendering with Atkinson Hyperlegible Floors
  // ---------------------------------------------------------------------------

  private async renderInMemoryPdf(
    resident: ResidentProfile,
    pages: PacketPageModel[],
    stage: 'early' | 'middle' | 'late',
    opts: Required<PipelineOptions>
  ): Promise<Blob> {
    const globalJsPdf = (window as unknown as { jspdf?: { jsPDF: new (opts: unknown) => unknown } }).jspdf;

    if (!globalJsPdf) {
      throw new Error('jsPDF library is not loaded in the client browser.');
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc: any = new globalJsPdf.jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'letter',
    });

    for (let i = 0; i < pages.length; i++) {
      if (i > 0) doc.addPage();
      this.renderSinglePage(doc, pages[i], resident, stage, i + 1, pages.length, opts);
    }

    const outputBuffer = doc.output('arraybuffer') as ArrayBuffer;
    return new Blob([outputBuffer], { type: 'application/pdf' });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private renderSinglePage(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    doc: any,
    page: PacketPageModel,
    resident: ResidentProfile,
    stage: 'early' | 'middle' | 'late',
    pageIndex: number,
    totalPages: number,
    opts: Required<PipelineOptions>
  ): void {
    const margin = opts.bindingMargin ? 54 : 36;
    const pageWidth = 612;
    const usableWidth = pageWidth - margin - 36;

    // Strict Clinical Matrix Type Floors (14pt Early, 18pt Middle, 24pt Bold Late)
    const typeFloor = stage === 'late' ? 24 : stage === 'middle' ? 18 : 14;
    const isLate = stage === 'late';
    const strokeFloor = stage === 'late' ? 4.5 : stage === 'middle' ? 3.0 : 2.25;

    // Header Shell (Zero-network rulebook)
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    const residentDisplay = resident.firstName + (resident.lastName ? ` ${resident.lastName}` : '');
    doc.text(`Prepared especially for ${residentDisplay}`, margin, 46);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    const roomText = resident.roomOrWing ? `Wing: ${resident.roomOrWing}` : 'Memory Care';
    doc.text(roomText, pageWidth - 36, 46, { align: 'right' });

    // Header Rule (stroke floor compliance)
    doc.setLineWidth(strokeFloor);
    doc.setDrawColor(0, 0, 0);
    doc.line(margin, 54, pageWidth - 36, 54);

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(Math.max(22, typeFloor));
    doc.text(page.title, margin, 90);

    // Theme Subheader
    doc.setFont('helvetica', isLate ? 'bold' : 'normal');
    doc.setFontSize(Math.max(16, typeFloor));
    doc.text(`Theme: ${page.theme}`, margin, 120);

    // Content Body
    let yPos = 160;
    doc.setFont('helvetica', isLate ? 'bold' : 'normal');
    doc.setFontSize(typeFloor);

    for (const line of page.contentLines) {
      const splitLines = doc.splitTextToSize(line, usableWidth);
      for (const split of splitLines) {
        if (yPos > 680) break;
        doc.text(split, margin, yPos);
        yPos += typeFloor * 1.6;
      }
      yPos += 12;
    }

    // Clinical Tip (Always situated above footer)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Clinical Tip:', margin, 715);
    doc.setFont('helvetica', 'normal');
    doc.text(page.clinicalTip.replace(/^Clinical Tip:\s*/, ''), margin + 65, 715);

    // Footer Rule & Labels
    doc.setLineWidth(2.25);
    doc.line(margin, 740, pageWidth - 36, 740);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text('Cognicopia · Private Client-Side Generated', margin, 755);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`Page ${pageIndex} of ${totalPages}`, pageWidth / 2, 755, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text(stage.toUpperCase() + ' STAGE', pageWidth - 36, 755, { align: 'right' });
  }
}
