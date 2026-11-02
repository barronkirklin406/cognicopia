/**
 * @file tokenService.ts
 * @description Secure token generation, magic link encoding/decoding,
 * and resident profile synchronization for the Cognicopia Family Bridge.
 */

import {
  FamilyBridgeToken,
  MagicLinkPayload,
  FamilyContribution,
  SyncResult
} from './types.js';
import { ResidentProfile } from '../../engine/packetGenerator.js';

const STORAGE_TOKENS_KEY = 'cogni_family_tokens';
const STORAGE_CONTRIBUTIONS_KEY = 'cogni_family_contributions';
const STORAGE_RESIDENTS_KEY = 'cogni_residents';

/**
 * Base64URL safe encoding/decoding helper
 */
export function base64UrlEncode(str: string): string {
  try {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch (e) {
    return encodeURIComponent(str);
  }
}

export function base64UrlDecode(str: string): string {
  try {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch (e) {
    return decodeURIComponent(str);
  }
}

/**
 * Generates an 8-character cryptographic alphanumeric salt
 */
function generateRandomId(prefix = 'fb'): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint8Array(8);
    crypto.getRandomValues(arr);
    const hex = Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
    return `${prefix}_${hex}`;
  }
  return `${prefix}_${Math.random().toString(36).substring(2, 10)}${Date.now().toString(36).substring(4)}`;
}

export class FamilyBridgeTokenService {
  /**
   * Generates a tokenized magic link for a given resident.
   */
  public static createMagicLink(params: {
    residentId: string;
    residentName: string;
    facilityName: string;
    unitOrWing?: string;
    expirationDays?: number | null; // null for perpetual
    customWelcomeNote?: string;
    promptCategories?: Array<'photos' | 'recipes' | 'landmarks' | 'career' | 'music' | 'sayings'>;
    baseUrl?: string;
  }): { token: string; url: string; tokenRecord: FamilyBridgeToken; payload: MagicLinkPayload } {
    const tokenId = generateRandomId('bridge');
    const now = Date.now();
    const expiresAt = params.expirationDays ? now + params.expirationDays * 24 * 60 * 60 * 1000 : null;

    const payload: MagicLinkPayload = {
      token: tokenId,
      residentId: params.residentId,
      residentName: params.residentName,
      facilityName: params.facilityName || 'Cognicopia Care Facility',
      unitOrWing: params.unitOrWing,
      createdAt: now,
      expiresAt,
      promptCategories: params.promptCategories || ['photos', 'recipes', 'landmarks', 'career', 'music', 'sayings'],
      customWelcomeNote: params.customWelcomeNote
    };

    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const origin = params.baseUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://cognicopia.org');
    const url = `${origin}/family-bridge.html?token=${tokenId}&payload=${encodedPayload}`;

    const tokenRecord: FamilyBridgeToken = {
      token: tokenId,
      residentId: params.residentId,
      residentName: params.residentName,
      facilityName: params.facilityName || 'Cognicopia Care Facility',
      createdAt: new Date(now).toISOString(),
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      status: 'active',
      submissionCount: 0,
      url
    };

    // Store token record in client storage
    this.saveTokenRecord(tokenRecord);

    return {
      token: tokenId,
      url,
      tokenRecord,
      payload
    };
  }

  /**
   * Decodes and validates a magic link token or payload from URL query parameters.
   */
  public static parseTokenFromUrl(searchParamsOrUrl: string | URLSearchParams): {
    isValid: boolean;
    isExpired: boolean;
    payload: MagicLinkPayload | null;
    error?: string;
  } {
    let params: URLSearchParams;
    if (typeof searchParamsOrUrl === 'string') {
      const search = searchParamsOrUrl.includes('?') ? searchParamsOrUrl.split('?')[1] : searchParamsOrUrl;
      params = new URLSearchParams(search);
    } else {
      params = searchParamsOrUrl;
    }

    const token = params.get('token');
    const payloadStr = params.get('payload');

    if (!token && !payloadStr) {
      return { isValid: false, isExpired: false, payload: null, error: 'No magic link token or payload provided.' };
    }

    let payload: MagicLinkPayload | null = null;

    if (payloadStr) {
      try {
        const decodedJson = base64UrlDecode(payloadStr);
        payload = JSON.parse(decodedJson) as MagicLinkPayload;
      } catch (e) {
        console.warn('Failed to parse payload parameter, falling back to local storage lookup');
      }
    }

    // Fallback: look up in local storage if only token ID was supplied
    if (!payload && token) {
      const record = this.getTokenRecord(token);
      if (record) {
        payload = {
          token: record.token,
          residentId: record.residentId,
          residentName: record.residentName,
          facilityName: record.facilityName,
          createdAt: new Date(record.createdAt).getTime(),
          expiresAt: record.expiresAt ? new Date(record.expiresAt).getTime() : null,
          promptCategories: ['photos', 'recipes', 'landmarks', 'career', 'music', 'sayings']
        };
      }
    }

    if (!payload) {
      return { isValid: false, isExpired: false, payload: null, error: 'Could not resolve token payload.' };
    }

    // Check expiration
    if (payload.expiresAt && Date.now() > payload.expiresAt) {
      return { isValid: false, isExpired: true, payload, error: 'This Family Bridge link has expired.' };
    }

    return {
      isValid: true,
      isExpired: false,
      payload
    };
  }

  /**
   * Generates 1-click SMS text template for facility directors to text to family.
   */
  public static generateSmsTemplate(residentName: string, facilityName: string, magicLink: string): string {
    return `Hi from ${facilityName}! We're creating personalized memory activity books for ${residentName}. Could you share a few favorite memories, recipes, and childhood places here? It takes just 3 minutes: ${magicLink}`;
  }

  /**
   * Generates 1-click Email template for facility directors.
   */
  public static generateEmailTemplate(residentName: string, facilityName: string, magicLink: string): { subject: string; body: string } {
    return {
      subject: `Help us personalize cognitive activities for ${residentName} at ${facilityName}`,
      body: `Hello,\n\nWe hope this note finds you well. At ${facilityName}, we are using Cognicopia to design custom, dignified cognitive activity packets (word games, music memories, and reminiscence prompts) tailored specifically to ${residentName}'s life story.\n\nWe would love your help! You can share cherished family photos, favorite recipes, hometown landmarks, or favorite songs through our secure Family Bridge:\n\n👉 Open Family Bridge: ${magicLink}\n\nYour memories will be woven directly into ${residentName}'s personalized activity packets. It takes only a few minutes and means the world to our care team.\n\nWarm regards,\nThe Activities & Memory Care Team at ${facilityName}`
    };
  }

  /**
   * Merges a Family Contribution directly into a ResidentProfile for packet generation.
   */
  public static mergeContributionIntoProfile(profile: ResidentProfile, contribution: FamilyContribution): SyncResult {
    const fieldsUpdated: string[] = [];
    const newWordsAddedToLexicon: string[] = [];

    // 1. Merge recipes into corePassions and on-hand items
    if (contribution.recipes && contribution.recipes.length > 0) {
      fieldsUpdated.push('recipes');
      contribution.recipes.forEach(r => {
        if (r.recipeName && !profile.corePassions.includes(r.recipeName)) {
          profile.corePassions.push(r.recipeName);
          newWordsAddedToLexicon.push(r.recipeName);
        }
        if (r.sensorySmellOrTaste) {
          const words = r.sensorySmellOrTaste.split(/[,;]+/).map(s => s.trim()).filter(Boolean);
          words.forEach(w => {
            if (!profile.corePassions.includes(w) && w.length > 3) {
              profile.corePassions.push(w);
              newWordsAddedToLexicon.push(w);
            }
          });
        }
      });
    }

    // 2. Merge hometown landmarks
    if (contribution.landmarks && contribution.landmarks.length > 0) {
      fieldsUpdated.push('landmarks');
      if (!profile.hometown) {
        profile.hometown = { place: contribution.landmarks[0].landmarkName, environment: 'small-town' };
      }
      contribution.landmarks.forEach(lm => {
        if (lm.landmarkName && !profile.corePassions.includes(lm.landmarkName)) {
          profile.corePassions.push(lm.landmarkName);
          newWordsAddedToLexicon.push(lm.landmarkName);
        }
      });
    }

    // 3. Merge career memory & tools
    if (contribution.career) {
      fieldsUpdated.push('career');
      if (!profile.vocationDetails) {
        profile.vocationDetails = {};
      }
      if (contribution.career.favoriteTools && contribution.career.favoriteTools.length > 0) {
        profile.vocationDetails.toolsOfTheTrade = [
          ...(profile.vocationDetails.toolsOfTheTrade || []),
          ...contribution.career.favoriteTools
        ];
        contribution.career.favoriteTools.forEach(t => {
          if (!profile.corePassions.includes(t)) {
            profile.corePassions.push(t);
            newWordsAddedToLexicon.push(t);
          }
        });
      }
      if (contribution.career.proudestProjectOrMoment) {
        profile.vocationDetails.proudAchievements = contribution.career.proudestProjectOrMoment;
      }
    }

    // 4. Merge music & hymns
    if (contribution.music) {
      fieldsUpdated.push('music');
      if (!profile.musicPreferences) {
        profile.musicPreferences = {};
      }
      if (contribution.music.favoriteHymns && contribution.music.favoriteHymns.length > 0) {
        profile.musicPreferences.favoriteSongs = [
          ...(profile.musicPreferences.favoriteSongs || []),
          ...contribution.music.favoriteHymns
        ];
        contribution.music.favoriteHymns.forEach(h => newWordsAddedToLexicon.push(h));
      }
      if (contribution.music.favoriteArtistsOrBands && contribution.music.favoriteArtistsOrBands.length > 0) {
        profile.musicPreferences.favoriteArtists = [
          ...(profile.musicPreferences.favoriteArtists || []),
          ...contribution.music.favoriteArtistsOrBands
        ];
        contribution.music.favoriteArtistsOrBands.forEach(a => newWordsAddedToLexicon.push(a));
      }
    }

    // 5. Special sayings & pets
    if (contribution.specialSayings && contribution.specialSayings.length > 0) {
      fieldsUpdated.push('specialSayings');
      contribution.specialSayings.forEach(s => {
        if (!profile.corePassions.includes(s) && s.length < 25) {
          profile.corePassions.push(s);
        }
      });
    }

    return {
      success: true,
      residentId: profile.id,
      fieldsUpdated,
      newWordsAddedToLexicon,
      message: `Successfully merged ${fieldsUpdated.length} biographical categories and ${newWordsAddedToLexicon.length} custom vocabulary cues into ${profile.preferredName}'s profile.`
    };
  }

  // =========================================================================
  // Local Storage Persistence Helpers
  // =========================================================================

  public static saveTokenRecord(record: FamilyBridgeToken): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const existing = this.getAllTokens();
      const idx = existing.findIndex(t => t.token === record.token);
      if (idx >= 0) {
        existing[idx] = record;
      } else {
        existing.unshift(record);
      }
      window.localStorage.setItem(STORAGE_TOKENS_KEY, JSON.stringify(existing));
    } catch (e) {
      console.warn('Could not save token to localStorage:', e);
    }
  }

  public static getTokenRecord(token: string): FamilyBridgeToken | null {
    const list = this.getAllTokens();
    return list.find(t => t.token === token) || null;
  }

  public static getAllTokens(): FamilyBridgeToken[] {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    try {
      const raw = window.localStorage.getItem(STORAGE_TOKENS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  public static saveContribution(contribution: FamilyContribution): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const existing = this.getAllContributions();
      const idx = existing.findIndex(c => c.id === contribution.id);
      if (idx >= 0) {
        existing[idx] = contribution;
      } else {
        existing.unshift(contribution);
      }
      window.localStorage.setItem(STORAGE_CONTRIBUTIONS_KEY, JSON.stringify(existing));

      // Update submission count on token
      const tokens = this.getAllTokens();
      const token = tokens.find(t => t.token === contribution.token);
      if (token) {
        token.submissionCount = (token.submissionCount || 0) + 1;
        token.status = 'submitted';
        this.saveTokenRecord(token);
      }
    } catch (e) {
      console.warn('Could not save contribution to localStorage:', e);
    }
  }

  public static getAllContributions(): FamilyContribution[] {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    try {
      const raw = window.localStorage.getItem(STORAGE_CONTRIBUTIONS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  public static getContributionsForResident(residentId: string): FamilyContribution[] {
    return this.getAllContributions().filter(c => c.residentId === residentId);
  }
}
