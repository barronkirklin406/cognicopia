/**
 * @file types.ts
 * @description Type definitions for the Cognicopia Family Bridge Portal.
 * Enables distant family members to securely contribute photos, recipes,
 * hometown landmarks, and career memories to personalize cognitive care packets.
 */

import { ResidentProfile } from '../../engine/packetGenerator.js';

export interface PhotoAttachment {
  id: string;
  dataUrl: string; // Base64 data URL (downscaled for fast local storage)
  caption: string;
  approxYear?: string;
  peoplePictured?: string;
}

export interface RecipeEntry {
  id: string;
  recipeName: string;
  dishType: 'main' | 'dessert' | 'baked' | 'holiday' | 'beverage' | 'other';
  memorableOccasion: string; // e.g. "Sunday dinner after church", "Christmas eve"
  keyIngredients: string;
  sensorySmellOrTaste: string; // e.g. "Cinnamon, toasted pecans, sweet butter"
  storySnippet?: string;
}

export interface LandmarkEntry {
  id: string;
  landmarkName: string;
  category: 'main_street' | 'park_nature' | 'church_community' | 'theater_entertainment' | 'diner_cafe' | 'workplace' | 'school' | 'other';
  locationDescription: string; // e.g. "Corner of 4th and Main next to the soda fountain"
  cherishedMemory: string;
}

export interface CareerMemory {
  pastTrades: string[];
  favoriteTools: string[];
  proudestProjectOrMoment: string;
  workplaceCatchphrase?: string;
  colleagueOrShopNames?: string;
}

export interface MusicAndMelody {
  favoriteHymns: string[];
  favoriteArtistsOrBands: string[];
  radioShowsOrDances: string[];
  memorableSongTitle?: string;
}

export interface FamilyContribution {
  id: string;
  token: string;
  residentId: string;
  residentName: string;
  contributorName: string;
  contributorRelationship: string; // e.g. "Daughter", "Grandson", "Spouse", "Sister"
  contributorEmail?: string;
  contributorPhone?: string;
  submittedAt: string; // ISO string
  approvedByDirector: boolean;
  approvedAt?: string;

  // Rich Biographical Submissions
  photos: PhotoAttachment[];
  recipes: RecipeEntry[];
  landmarks: LandmarkEntry[];
  career: CareerMemory;
  music: MusicAndMelody;
  specialSayings: string[];
  childhoodPetsAndNicknames?: string;
  additionalNotes?: string;
}

export interface MagicLinkPayload {
  token: string;
  residentId: string;
  residentName: string;
  facilityName: string;
  unitOrWing?: string;
  createdAt: number; // Unix timestamp
  expiresAt: number | null; // Unix timestamp or null for no expiration
  promptCategories: Array<'photos' | 'recipes' | 'landmarks' | 'career' | 'music' | 'sayings'>;
  customWelcomeNote?: string;
}

export interface FamilyBridgeToken {
  token: string;
  residentId: string;
  residentName: string;
  facilityName: string;
  createdAt: string;
  expiresAt: string | null;
  status: 'active' | 'submitted' | 'expired' | 'revoked';
  submissionCount: number;
  url: string;
}

export interface SyncResult {
  success: boolean;
  residentId: string;
  fieldsUpdated: string[];
  newWordsAddedToLexicon: string[];
  message: string;
}
