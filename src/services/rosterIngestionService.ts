/**
 * @file rosterIngestionService.ts
 * @description Zero-cloud client-side CSV roster ingestion service for senior living EHRs
 * (PointClickCare, MatrixCare, Yardi). Parses, strips unneeded ePHI (SSNs, medical codes),
 * maps cognitive tiers to clinical stages, and commits encrypted profiles to IndexedDB.
 * @global CogniRosterIngestionService
 */

import type { ResidentProfile, SecureCryptoStore } from './secureCryptoStore';

export interface CsvMappingConfig {
  firstNameCol?: string;
  lastNameCol?: string;
  roomWingCol?: string;
  birthYearCol?: string;
  tierCol?: string;
  hometownCol?: string;
  occupationCol?: string;
  interestsCol?: string;
}

export interface IngestionResult {
  totalRows: number;
  importedCount: number;
  skippedCount: number;
  errors: string[];
  profiles: ResidentProfile[];
}

export class RosterIngestionService {
  private readonly store: SecureCryptoStore;

  constructor(store: SecureCryptoStore) {
    this.store = store;
  }

  /**
   * Ingests a raw CSV file directly in browser memory without sending data to any cloud endpoint.
   */
  public async ingestCsv(
    csvText: string,
    mapping: CsvMappingConfig = {}
  ): Promise<IngestionResult> {
    const lines = csvText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      return {
        totalRows: 0,
        importedCount: 0,
        skippedCount: 0,
        errors: ['CSV file is empty or missing headers.'],
        profiles: [],
      };
    }

    const headers = this.parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
    const headerMap = this.resolveHeaderIndices(headers, mapping);

    const profiles: ResidentProfile[] = [];
    const errors: string[] = [];
    let skippedCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const row = this.parseCsvLine(lines[i]);
      if (row.length === 0 || row.every((c) => !c)) {
        skippedCount++;
        continue;
      }

      try {
        const firstName = this.getCol(row, headerMap.firstName);
        if (!firstName) {
          skippedCount++;
          errors.push(`Row ${i + 1}: Missing required first name.`);
          continue;
        }

        const lastName = this.getCol(row, headerMap.lastName);
        const roomOrWing = this.getCol(row, headerMap.roomWing);
        const birthYearStr = this.getCol(row, headerMap.birthYear);
        const rawTier = this.getCol(row, headerMap.tier);
        const hometown = this.getCol(row, headerMap.hometown);
        const pastOccupation = this.getCol(row, headerMap.occupation);
        const rawInterests = this.getCol(row, headerMap.interests);

        const birthYear = birthYearStr && /^\d{4}$/.test(birthYearStr) ? parseInt(birthYearStr, 10) : undefined;
        const cognitiveTier = this.mapCognitiveTier(rawTier);
        const interests = rawInterests
          ? rawInterests
              .split(/[;,|]/)
              .map((s) => s.trim())
              .filter(Boolean)
          : [];

        const id = `res_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

        const profile: ResidentProfile = {
          id,
          firstName,
          lastName: lastName || undefined,
          roomOrWing: roomOrWing || undefined,
          birthYear,
          cognitiveTier,
          hometown: hometown || undefined,
          pastOccupation: pastOccupation || undefined,
          interests,
          updatedAt: Date.now(),
        };

        profiles.push(profile);

        // Commit directly into local encrypted store if store is unlocked
        if (this.store.isUnlocked()) {
          await this.store.saveResident(profile);
        }
      } catch (err) {
        skippedCount++;
        errors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return {
      totalRows: lines.length - 1,
      importedCount: profiles.length,
      skippedCount,
      errors,
      profiles,
    };
  }

  private mapCognitiveTier(raw?: string): 'Mild' | 'Moderate' | 'Advanced' {
    if (!raw) return 'Moderate';
    const s = raw.toLowerCase().trim();
    if (s.includes('early') || s.includes('mci') || s.includes('gds 3') || s.includes('gds 4') || s.includes('mild')) {
      return 'Mild';
    }
    if (s.includes('late') || s.includes('adv') || s.includes('gds 6') || s.includes('gds 7') || s.includes('acute')) {
      return 'Advanced';
    }
    return 'Moderate';
  }

  private resolveHeaderIndices(
    headers: string[],
    m: CsvMappingConfig
  ): Record<string, number> {
    const findIdx = (explicit?: string, fallbacks: string[] = []): number => {
      if (explicit) {
        const idx = headers.indexOf(explicit.toLowerCase().trim());
        if (idx >= 0) return idx;
      }
      for (const fb of fallbacks) {
        const idx = headers.findIndex((h) => h.includes(fb));
        if (idx >= 0) return idx;
      }
      return -1;
    };

    return {
      firstName: findIdx(m.firstNameCol, ['firstname', 'first name', 'first', 'givenname']),
      lastName: findIdx(m.lastNameCol, ['lastname', 'last name', 'last', 'surname']),
      roomWing: findIdx(m.roomWingCol, ['room', 'wing', 'unit', 'bed', 'location']),
      birthYear: findIdx(m.birthYearCol, ['birthyear', 'birth year', 'dob', 'born', 'year']),
      tier: findIdx(m.tierCol, ['tier', 'stage', 'level', 'care level', 'gds', 'cognitive']),
      hometown: findIdx(m.hometownCol, ['hometown', 'home town', 'city', 'origin']),
      occupation: findIdx(m.occupationCol, ['occupation', 'career', 'job', 'profession', 'trade']),
      interests: findIdx(m.interestsCol, ['interest', 'hobbies', 'likes', 'preferences']),
    };
  }

  private getCol(row: string[], idx: number): string | undefined {
    if (idx < 0 || idx >= row.length) return undefined;
    const val = row[idx].trim();
    return val ? val : undefined;
  }

  private parseCsvLine(text: string): string[] {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '"') {
        if (inQuotes && text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    result.push(cur.trim());
    return result;
  }
}
