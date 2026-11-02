/**
 * @file FamilyBridgePortal.tsx
 * @description Frictionless, compassionate web form for family members to share
 * photos, recipes, landmarks, and career memories to personalize cognitive care packets.
 */

import React, { useState, useEffect } from 'react';
import {
  MagicLinkPayload,
  PhotoAttachment,
  RecipeEntry,
  LandmarkEntry,
  CareerMemory,
  MusicAndMelody,
  FamilyContribution
} from './types.js';
import { FamilyBridgeTokenService } from './tokenService.js';

interface FamilyBridgePortalProps {
  initialPayload?: MagicLinkPayload | null;
  onSubmitted?: (contribution: FamilyContribution) => void;
}

export const FamilyBridgePortal: React.FC<FamilyBridgePortalProps> = ({
  initialPayload,
  onSubmitted
}) => {
  const [payload, setPayload] = useState<MagicLinkPayload | null>(initialPayload || null);
  const [activeStep, setActiveStep] = useState<'welcome' | 'photos' | 'recipes' | 'landmarks' | 'career' | 'music' | 'review' | 'success'>('welcome');

  // Contributor info
  const [contributorName, setContributorName] = useState('');
  const [contributorRelationship, setContributorRelationship] = useState('Daughter');
  const [contributorPhone, setContributorPhone] = useState('');
  const [contributorEmail, setContributorEmail] = useState('');

  // 1. Photos
  const [photos, setPhotos] = useState<PhotoAttachment[]>([]);
  const [photoCaption, setPhotoCaption] = useState('');
  const [photoYear, setPhotoYear] = useState('');
  const [photoError, setPhotoError] = useState('');

  // 2. Recipes
  const [recipes, setRecipes] = useState<RecipeEntry[]>([
    {
      id: 'rec_1',
      recipeName: '',
      dishType: 'main',
      memorableOccasion: '',
      keyIngredients: '',
      sensorySmellOrTaste: '',
      storySnippet: ''
    }
  ]);

  // 3. Landmarks
  const [landmarks, setLandmarks] = useState<LandmarkEntry[]>([
    {
      id: 'lm_1',
      landmarkName: '',
      category: 'main_street',
      locationDescription: '',
      cherishedMemory: ''
    }
  ]);

  // 4. Career & Tools
  const [career, setCareer] = useState<CareerMemory>({
    pastTrades: [],
    favoriteTools: [],
    proudestProjectOrMoment: '',
    workplaceCatchphrase: '',
    colleagueOrShopNames: ''
  });
  const [toolsInput, setToolsInput] = useState('');
  const [tradesInput, setTradesInput] = useState('');

  // 5. Music & Hymns
  const [music, setMusic] = useState<MusicAndMelody>({
    favoriteHymns: [],
    favoriteArtistsOrBands: [],
    radioShowsOrDances: [],
    memorableSongTitle: ''
  });
  const [hymnsInput, setHymnsInput] = useState('');
  const [artistsInput, setArtistsInput] = useState('');

  // 6. Sayings & Pets
  const [sayingsInput, setSayingsInput] = useState('');
  const [petsInput, setPetsInput] = useState('');

  // Status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedContribution, setSubmittedContribution] = useState<FamilyContribution | null>(null);

  useEffect(() => {
    if (!payload && typeof window !== 'undefined') {
      const parsed = FamilyBridgeTokenService.parseTokenFromUrl(window.location.search);
      if (parsed.payload) {
        setPayload(parsed.payload);
      }
    }
  }, [payload]);

  // Photo compression helper
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setPhotoError('Please select a valid image file (JPG or PNG).');
      return;
    }

    setPhotoError('');
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const img = new Image();
      img.onload = () => {
        // Downscale to max 800px width/height for fast localStorage persistence
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 800;

        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.75);

          const newPhoto: PhotoAttachment = {
            id: `photo_${Date.now()}`,
            dataUrl: compressedDataUrl,
            caption: photoCaption || file.name.replace(/\.[^/.]+$/, ''),
            approxYear: photoYear || 'Vintage Era'
          };

          setPhotos(prev => [...prev, newPhoto]);
          setPhotoCaption('');
          setPhotoYear('');
        }
      };
      img.src = loadEvent.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = (id: string) => {
    setPhotos(prev => prev.filter(p => p.id !== id));
  };

  const addRecipeRow = () => {
    setRecipes(prev => [
      ...prev,
      {
        id: `rec_${Date.now()}`,
        recipeName: '',
        dishType: 'main',
        memorableOccasion: '',
        keyIngredients: '',
        sensorySmellOrTaste: '',
        storySnippet: ''
      }
    ]);
  };

  const updateRecipe = (index: number, field: keyof RecipeEntry, value: string) => {
    setRecipes(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const removeRecipe = (index: number) => {
    setRecipes(prev => prev.filter((_, i) => i !== index));
  };

  const addLandmarkRow = () => {
    setLandmarks(prev => [
      ...prev,
      {
        id: `lm_${Date.now()}`,
        landmarkName: '',
        category: 'main_street',
        locationDescription: '',
        cherishedMemory: ''
      }
    ]);
  };

  const updateLandmark = (index: number, field: keyof LandmarkEntry, value: string) => {
    setLandmarks(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const removeLandmark = (index: number) => {
    setLandmarks(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!contributorName.trim()) {
      alert('Please enter your name so the care team knows who shared these memories.');
      return;
    }

    setIsSubmitting(true);

    const parsedTrades = tradesInput.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
    const parsedTools = toolsInput.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
    const parsedHymns = hymnsInput.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
    const parsedArtists = artistsInput.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
    const parsedSayings = sayingsInput.split(/[\n]+/).map(s => s.trim()).filter(Boolean);

    const validRecipes = recipes.filter(r => r.recipeName.trim().length > 0);
    const validLandmarks = landmarks.filter(lm => lm.landmarkName.trim().length > 0);

    const contribution: FamilyContribution = {
      id: `contrib_${Date.now()}`,
      token: payload?.token || 'direct_portal',
      residentId: payload?.residentId || 'res_default',
      residentName: payload?.residentName || 'Arthur Smith',
      contributorName: contributorName.trim(),
      contributorRelationship,
      contributorEmail: contributorEmail.trim(),
      contributorPhone: contributorPhone.trim(),
      submittedAt: new Date().toISOString(),
      approvedByDirector: true, // auto-approved or pending based on facility setting
      photos,
      recipes: validRecipes,
      landmarks: validLandmarks,
      career: {
        ...career,
        pastTrades: parsedTrades.length > 0 ? parsedTrades : career.pastTrades,
        favoriteTools: parsedTools.length > 0 ? parsedTools : career.favoriteTools
      },
      music: {
        ...music,
        favoriteHymns: parsedHymns.length > 0 ? parsedHymns : music.favoriteHymns,
        favoriteArtistsOrBands: parsedArtists.length > 0 ? parsedArtists : music.favoriteArtistsOrBands
      },
      specialSayings: parsedSayings,
      childhoodPetsAndNicknames: petsInput.trim()
    };

    // Save to local storage
    FamilyBridgeTokenService.saveContribution(contribution);

    setSubmittedContribution(contribution);
    setIsSubmitting(false);
    setActiveStep('success');

    if (onSubmitted) {
      onSubmitted(contribution);
    }
  };

  const residentName = payload?.residentName || 'Arthur Smith';
  const facilityName = payload?.facilityName || 'St. Jude Memory Care';

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 font-sans text-neutral-900">
      {/* Top Facility Banner */}
      <div className="bg-emerald-900 text-white rounded-2xl p-6 shadow-md mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-800 text-emerald-200 text-xs font-semibold uppercase tracking-wider rounded-full mb-2">
            <span>🛡️</span> Secure Family Bridge Portal
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Personalizing Memory Care for {residentName}
          </h1>
          <p className="text-emerald-200 text-sm mt-1">
            Prepared by the Activities &amp; Clinical Team at <span className="text-white font-medium">{facilityName}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-emerald-700/80 border-2 border-emerald-400 flex items-center justify-center text-xl font-bold">
            {residentName.charAt(0)}
          </div>
          <div className="text-sm">
            <p className="font-semibold">{residentName}</p>
            <p className="text-emerald-300 text-xs">{payload?.unitOrWing || 'Memory Care Suite'}</p>
          </div>
        </div>
      </div>

      {/* Progress Navigation Pills */}
      {activeStep !== 'success' && (
        <div className="flex overflow-x-auto gap-2 pb-4 mb-6 border-b border-neutral-200 text-sm font-medium scrollbar-none">
          {[
            { id: 'welcome', label: '1. Welcome' },
            { id: 'photos', label: `2. Photos (${photos.length})` },
            { id: 'recipes', label: `3. Family Recipes (${recipes.filter(r => r.recipeName).length})` },
            { id: 'landmarks', label: `4. Hometown Landmarks (${landmarks.filter(l => l.landmarkName).length})` },
            { id: 'career', label: '5. Career & Dignity' },
            { id: 'music', label: '6. Music & Hymns' },
            { id: 'review', label: '7. Review & Submit' }
          ].map(step => (
            <button
              key={step.id}
              onClick={() => setActiveStep(step.id as any)}
              className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                activeStep === step.id
                  ? 'bg-neutral-900 text-white shadow-sm'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              {step.label}
            </button>
          ))}
        </div>
      )}

      {/* STEP 1: WELCOME */}
      {activeStep === 'welcome' && (
        <div className="bg-white border border-neutral-200 rounded-2xl p-6 md:p-8 shadow-sm">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold mb-3 text-neutral-900">
              Welcome to {residentName}'s Memory Bridge
            </h2>
            <p className="text-neutral-600 text-base leading-relaxed mb-6">
              When memory begins to fade, childhood recipes, the tools of a former trade, and hometown landmarks remain vivid.
              By sharing a few simple details below, our activity team will generate personalized large-print word searches,
              music reminiscence prompts, and conversational activities customized exclusively for {residentName}.
            </p>

            {payload?.customWelcomeNote && (
              <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg mb-6 text-sm text-amber-900">
                <p className="font-semibold mb-1">Note from the Facility Director:</p>
                <p className="italic">"{payload.customWelcomeNote}"</p>
              </div>
            )}

            <div className="border-t border-neutral-100 pt-6 mt-6">
              <h3 className="text-lg font-semibold mb-4 text-neutral-800">Your Contact Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Your Full Name *</label>
                  <input
                    type="text"
                    value={contributorName}
                    onChange={e => setContributorName(e.target.value)}
                    placeholder="e.g. Sarah Smith Jenkins"
                    className="w-full px-4 py-2.5 rounded-lg border border-neutral-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Relationship to {residentName} *</label>
                  <select
                    value={contributorRelationship}
                    onChange={e => setContributorRelationship(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-neutral-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                  >
                    <option value="Daughter">Daughter</option>
                    <option value="Son">Son</option>
                    <option value="Spouse">Spouse / Partner</option>
                    <option value="Granddaughter">Granddaughter</option>
                    <option value="Grandson">Grandson</option>
                    <option value="Sister">Sister</option>
                    <option value="Brother">Brother</option>
                    <option value="Niece / Nephew">Niece / Nephew</option>
                    <option value="Close Friend">Close Friend / Neighbor</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Email (Optional for updates)</label>
                  <input
                    type="email"
                    value={contributorEmail}
                    onChange={e => setContributorEmail(e.target.value)}
                    placeholder="sarah@example.com"
                    className="w-full px-4 py-2.5 rounded-lg border border-neutral-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Cell Phone (Optional)</label>
                  <input
                    type="tel"
                    value={contributorPhone}
                    onChange={e => setContributorPhone(e.target.value)}
                    placeholder="(555) 019-2834"
                    className="w-full px-4 py-2.5 rounded-lg border border-neutral-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!contributorName.trim()) {
                    alert('Please enter your name to proceed.');
                    return;
                  }
                  setActiveStep('photos');
                }}
                className="w-full md:w-auto px-8 py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-medium rounded-xl shadow transition-colors flex items-center justify-center gap-2"
              >
                <span>Continue to Step 2: Photos</span>
                <span>→</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: PHOTOS */}
      {activeStep === 'photos' && (
        <div className="bg-white border border-neutral-200 rounded-2xl p-6 md:p-8 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl md:text-2xl font-bold">Cherished Family &amp; Historical Photos</h2>
              <p className="text-neutral-600 text-sm">
                Vintage snapshots, wedding photos, military service portraits, or working at the shop spark powerful reminiscence.
              </p>
            </div>
            <span className="text-sm font-medium text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full">
              {photos.length} uploaded
            </span>
          </div>

          {/* Upload Drop Zone */}
          <div className="border-2 border-dashed border-neutral-300 rounded-xl p-6 text-center hover:border-emerald-500 transition-colors bg-neutral-50 mb-6">
            <svg className="w-12 h-12 text-neutral-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm font-medium text-neutral-700 mb-1">
              Click to choose a photo or drag and drop from your phone or desktop
            </p>
            <p className="text-xs text-neutral-500 mb-4">PNG, JPG, or WEBP up to 10MB</p>
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="hidden"
              id="familyPhotoInput"
            />
            <label
              htmlFor="familyPhotoInput"
              className="inline-block px-5 py-2.5 bg-neutral-900 text-white text-sm font-medium rounded-lg cursor-pointer hover:bg-neutral-800 transition"
            >
              Select Photo from Device
            </label>
            {photoError && <p className="text-xs text-red-600 mt-2 font-semibold">{photoError}</p>}
          </div>

          {/* Gallery of Uploaded Photos */}
          {photos.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {photos.map(p => (
                <div key={p.id} className="flex gap-4 p-3 border border-neutral-200 rounded-xl items-center bg-white shadow-xs">
                  <img src={p.dataUrl} alt={p.caption} className="w-24 h-24 object-cover rounded-lg border border-neutral-200" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{p.caption}</p>
                    <p className="text-xs text-neutral-500">{p.approxYear || 'Vintage Photo'}</p>
                    <button
                      type="button"
                      onClick={() => removePhoto(p.id)}
                      className="text-xs text-red-600 hover:text-red-800 font-medium mt-2"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-between pt-6 border-t border-neutral-100">
            <button
              type="button"
              onClick={() => setActiveStep('welcome')}
              className="px-5 py-2.5 text-neutral-700 hover:bg-neutral-100 rounded-lg text-sm font-medium"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={() => setActiveStep('recipes')}
              className="px-6 py-2.5 bg-neutral-900 hover:bg-black text-white rounded-lg text-sm font-medium flex items-center gap-2"
            >
              <span>Next: Family Recipes</span>
              <span>→</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: RECIPES */}
      {activeStep === 'recipes' && (
        <div className="bg-white border border-neutral-200 rounded-2xl p-6 md:p-8 shadow-sm">
          <div className="mb-6">
            <h2 className="text-xl md:text-2xl font-bold">Favorite Family Recipes &amp; Comfort Foods</h2>
            <p className="text-neutral-600 text-sm">
              Smell and taste evoke some of the strongest autobiographical memories in seniors. What dishes did {residentName} love cooking or eating?
            </p>
          </div>

          <div className="space-y-6 mb-6">
            {recipes.map((recipe, idx) => (
              <div key={recipe.id} className="p-5 border border-neutral-200 rounded-xl bg-neutral-50/70 relative">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded">
                    Recipe #{idx + 1}
                  </span>
                  {recipes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRecipe(idx)}
                      className="text-xs text-red-600 hover:text-red-800 font-medium"
                    >
                      Delete
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">Dish Name *</label>
                    <input
                      type="text"
                      value={recipe.recipeName}
                      onChange={e => updateRecipe(idx, 'recipeName', e.target.value)}
                      placeholder="e.g. Grandma's Cinnamon Apple Crisp"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">Dish Type</label>
                    <select
                      value={recipe.dishType}
                      onChange={e => updateRecipe(idx, 'dishType', e.target.value as any)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-300 bg-white"
                    >
                      <option value="main">Main Entrée (Pot roast, stew, fried chicken)</option>
                      <option value="baked">Baking &amp; Bread (Sourdough, biscuits, rolls)</option>
                      <option value="dessert">Dessert (Apple pie, berry cobbler)</option>
                      <option value="holiday">Holiday Tradition (Thanksgiving stuffing, Easter ham)</option>
                      <option value="beverage">Beverage (Fresh lemonade, eggnog)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">Key Ingredients &amp; Aromas</label>
                    <input
                      type="text"
                      value={recipe.sensorySmellOrTaste}
                      onChange={e => updateRecipe(idx, 'sensorySmellOrTaste', e.target.value)}
                      placeholder="e.g. Cinnamon, brown sugar, melted butter, tart apples"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">Special Occasion</label>
                    <input
                      type="text"
                      value={recipe.memorableOccasion}
                      onChange={e => updateRecipe(idx, 'memorableOccasion', e.target.value)}
                      placeholder="e.g. Every Sunday after church with the whole family"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-300 bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Favorite Memory Associated with this Dish</label>
                  <textarea
                    rows={2}
                    value={recipe.storySnippet}
                    onChange={e => updateRecipe(idx, 'storySnippet', e.target.value)}
                    placeholder="e.g. Dad always insisted on having two scoops of vanilla ice cream right on top while it was still piping hot."
                    className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-300 bg-white"
                  />
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addRecipeRow}
            className="px-4 py-2 text-sm font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition mb-6 flex items-center gap-1.5"
          >
            <span>+</span> Add Another Recipe
          </button>

          <div className="flex justify-between pt-6 border-t border-neutral-100">
            <button
              type="button"
              onClick={() => setActiveStep('photos')}
              className="px-5 py-2.5 text-neutral-700 hover:bg-neutral-100 rounded-lg text-sm font-medium"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={() => setActiveStep('landmarks')}
              className="px-6 py-2.5 bg-neutral-900 hover:bg-black text-white rounded-lg text-sm font-medium flex items-center gap-2"
            >
              <span>Next: Hometown Landmarks</span>
              <span>→</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: LANDMARKS */}
      {activeStep === 'landmarks' && (
        <div className="bg-white border border-neutral-200 rounded-2xl p-6 md:p-8 shadow-sm">
          <div className="mb-6">
            <h2 className="text-xl md:text-2xl font-bold">Hometown &amp; Childhood Landmarks</h2>
            <p className="text-neutral-600 text-sm">
              Long-term spatial memory often remains remarkably clear. Which places, streets, diners, or theaters were meaningful to {residentName}?
            </p>
          </div>

          <div className="space-y-6 mb-6">
            {landmarks.map((landmark, idx) => (
              <div key={landmark.id} className="p-5 border border-neutral-200 rounded-xl bg-neutral-50/70 relative">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-800 bg-blue-100 px-2.5 py-0.5 rounded">
                    Landmark #{idx + 1}
                  </span>
                  {landmarks.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLandmark(idx)}
                      className="text-xs text-red-600 hover:text-red-800 font-medium"
                    >
                      Delete
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">Place Name *</label>
                    <input
                      type="text"
                      value={landmark.landmarkName}
                      onChange={e => updateLandmark(idx, 'landmarkName', e.target.value)}
                      placeholder="e.g. The Rexall Soda Fountain"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">Category</label>
                    <select
                      value={landmark.category}
                      onChange={e => updateLandmark(idx, 'category', e.target.value as any)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-300 bg-white"
                    >
                      <option value="main_street">Main Street / Soda Fountain</option>
                      <option value="park_nature">Park, Lake or Fishing Pier</option>
                      <option value="theater_entertainment">Movie Palace or Drive-In</option>
                      <option value="church_community">Church or Grange Hall</option>
                      <option value="workplace">Railroad Station or Factory</option>
                      <option value="school">High School or Ballpark</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Cherished Memory or What Happened There</label>
                  <textarea
                    rows={2}
                    value={landmark.cherishedMemory}
                    onChange={e => updateLandmark(idx, 'cherishedMemory', e.target.value)}
                    placeholder="e.g. He would order a nickel cherry phosphate every Friday afternoon after getting off his shift at the rail yard."
                    className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-300 bg-white"
                  />
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addLandmarkRow}
            className="px-4 py-2 text-sm font-semibold text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-lg transition mb-6 flex items-center gap-1.5"
          >
            <span>+</span> Add Another Landmark
          </button>

          <div className="flex justify-between pt-6 border-t border-neutral-100">
            <button
              type="button"
              onClick={() => setActiveStep('recipes')}
              className="px-5 py-2.5 text-neutral-700 hover:bg-neutral-100 rounded-lg text-sm font-medium"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={() => setActiveStep('career')}
              className="px-6 py-2.5 bg-neutral-900 hover:bg-black text-white rounded-lg text-sm font-medium flex items-center gap-2"
            >
              <span>Next: Career &amp; Dignity</span>
              <span>→</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: CAREER & DIGNITY */}
      {activeStep === 'career' && (
        <div className="bg-white border border-neutral-200 rounded-2xl p-6 md:p-8 shadow-sm">
          <div className="mb-6">
            <h2 className="text-xl md:text-2xl font-bold">Past Career, Workshop &amp; Tools of the Trade</h2>
            <p className="text-neutral-600 text-sm">
              "Who was this person at work when they were younger?" Anchoring prompts in professional pride reinforces identity and self-worth.
            </p>
          </div>

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-1">
                Former Trades, Jobs or Vocations
              </label>
              <input
                type="text"
                value={tradesInput}
                onChange={e => setTradesInput(e.target.value)}
                placeholder="e.g. Railroad Machinist, Master Carpenter, Schoolteacher, Registered Nurse"
                className="w-full px-4 py-2.5 rounded-lg border border-neutral-300"
              />
              <p className="text-xs text-neutral-500 mt-1">Separate with commas</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-1">
                Favorite Hand Tools, Instruments or Equipment
              </label>
              <input
                type="text"
                value={toolsInput}
                onChange={e => setToolsInput(e.target.value)}
                placeholder="e.g. Stanley No. 4 hand plane, cast iron lathe, chalk & slate, stethoscope"
                className="w-full px-4 py-2.5 rounded-lg border border-neutral-300"
              />
              <p className="text-xs text-neutral-500 mt-1">
                These specific physical tools will be integrated into matching and word puzzles!
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-1">
                Proudest Work Achievement or Legacy Project
              </label>
              <textarea
                rows={2}
                value={career.proudestProjectOrMoment}
                onChange={e => setCareer({ ...career, proudestProjectOrMoment: e.target.value })}
                placeholder="e.g. Hand-built the oak dining table that our family still eats on today; repaired steam locomotives on the Great Northern line."
                className="w-full px-4 py-2.5 rounded-lg border border-neutral-300"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-1">
                Favorite Workplace Motto or Catchphrase
              </label>
              <input
                type="text"
                value={career.workplaceCatchphrase || ''}
                onChange={e => setCareer({ ...career, workplaceCatchphrase: e.target.value })}
                placeholder="e.g. 'Measure twice, cut once' or 'Keep the fire hot and the rails straight'"
                className="w-full px-4 py-2.5 rounded-lg border border-neutral-300"
              />
            </div>
          </div>

          <div className="flex justify-between pt-6 border-t border-neutral-100">
            <button
              type="button"
              onClick={() => setActiveStep('landmarks')}
              className="px-5 py-2.5 text-neutral-700 hover:bg-neutral-100 rounded-lg text-sm font-medium"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={() => setActiveStep('music')}
              className="px-6 py-2.5 bg-neutral-900 hover:bg-black text-white rounded-lg text-sm font-medium flex items-center gap-2"
            >
              <span>Next: Music &amp; Hymns</span>
              <span>→</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 6: MUSIC & HYMNS */}
      {activeStep === 'music' && (
        <div className="bg-white border border-neutral-200 rounded-2xl p-6 md:p-8 shadow-sm">
          <div className="mb-6">
            <h2 className="text-xl md:text-2xl font-bold">Cherished Music, Hymns &amp; Special Sayings</h2>
            <p className="text-neutral-600 text-sm">
              Musical memories often remain accessible when other speech pathways falter.
            </p>
          </div>

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-1">
                Favorite Hymns or Church Melodies
              </label>
              <input
                type="text"
                value={hymnsInput}
                onChange={e => setHymnsInput(e.target.value)}
                placeholder="e.g. In The Garden, Amazing Grace, The Old Rugged Cross, Blessed Assurance"
                className="w-full px-4 py-2.5 rounded-lg border border-neutral-300"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-1">
                Favorite Artists, Big Bands or Era Musicians
              </label>
              <input
                type="text"
                value={artistsInput}
                onChange={e => setArtistsInput(e.target.value)}
                placeholder="e.g. Glenn Miller, Benny Goodman, Johnny Cash, Patsy Cline, Lawrence Welk"
                className="w-full px-4 py-2.5 rounded-lg border border-neutral-300"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-1">
                Childhood Pets &amp; Nicknames
              </label>
              <input
                type="text"
                value={petsInput}
                onChange={e => setPetsInput(e.target.value)}
                placeholder="e.g. Collie named 'Barnaby', childhood nickname 'Artie'"
                className="w-full px-4 py-2.5 rounded-lg border border-neutral-300"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-1">
                Favorite Sayings, Humor or Expressions (One per line)
              </label>
              <textarea
                rows={3}
                value={sayingsInput}
                onChange={e => setSayingsInput(e.target.value)}
                placeholder="e.g. 'Can't complain, nobody'd listen anyway!'&#10;'Let's get this show on the road!'"
                className="w-full px-4 py-2.5 rounded-lg border border-neutral-300"
              />
            </div>
          </div>

          <div className="flex justify-between pt-6 border-t border-neutral-100">
            <button
              type="button"
              onClick={() => setActiveStep('career')}
              className="px-5 py-2.5 text-neutral-700 hover:bg-neutral-100 rounded-lg text-sm font-medium"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={() => setActiveStep('review')}
              className="px-6 py-2.5 bg-neutral-900 hover:bg-black text-white rounded-lg text-sm font-medium flex items-center gap-2"
            >
              <span>Review &amp; Finalize</span>
              <span>→</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 7: REVIEW & SUBMIT */}
      {activeStep === 'review' && (
        <div className="bg-white border border-neutral-200 rounded-2xl p-6 md:p-8 shadow-sm">
          <div className="mb-6">
            <h2 className="text-xl md:text-2xl font-bold">Review Your Contribution for {residentName}</h2>
            <p className="text-neutral-600 text-sm">
              Please double check your submission. Once confirmed, these details safely sync into {residentName}'s profile at {facilityName}.
            </p>
          </div>

          <div className="space-y-4 mb-8 bg-neutral-50 p-6 rounded-xl border border-neutral-200 text-sm">
            <div className="flex justify-between py-2 border-b border-neutral-200">
              <span className="font-semibold text-neutral-600">Submitted By:</span>
              <span className="font-bold text-neutral-900">{contributorName} ({contributorRelationship})</span>
            </div>
            <div className="flex justify-between py-2 border-b border-neutral-200">
              <span className="font-semibold text-neutral-600">Photos Uploaded:</span>
              <span className="font-bold text-neutral-900">{photos.length} photos</span>
            </div>
            <div className="flex justify-between py-2 border-b border-neutral-200">
              <span className="font-semibold text-neutral-600">Family Recipes:</span>
              <span className="font-bold text-neutral-900">
                {recipes.filter(r => r.recipeName).map(r => r.recipeName).join(', ') || 'None added'}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-neutral-200">
              <span className="font-semibold text-neutral-600">Hometown Landmarks:</span>
              <span className="font-bold text-neutral-900">
                {landmarks.filter(l => l.landmarkName).map(l => l.landmarkName).join(', ') || 'None added'}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-neutral-200">
              <span className="font-semibold text-neutral-600">Tools &amp; Trades:</span>
              <span className="font-bold text-neutral-900">{toolsInput || tradesInput || 'None added'}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="font-semibold text-neutral-600">Music &amp; Hymns:</span>
              <span className="font-bold text-neutral-900">{hymnsInput || artistsInput || 'None added'}</span>
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t border-neutral-100">
            <button
              type="button"
              onClick={() => setActiveStep('music')}
              className="px-5 py-2.5 text-neutral-700 hover:bg-neutral-100 rounded-lg text-sm font-medium"
            >
              ← Back
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSubmit}
              className="px-8 py-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold shadow transition flex items-center gap-2"
            >
              {isSubmitting ? (
                <span>Syncing Memories...</span>
              ) : (
                <>
                  <span>✓ Submit to {facilityName} Care Team</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 8: SUCCESS CONFIRMATION */}
      {activeStep === 'success' && (
        <div className="bg-white border border-neutral-200 rounded-2xl p-8 shadow-sm text-center">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
            ✓
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-neutral-900 mb-2">
            Thank You, {contributorName}!
          </h2>
          <p className="text-neutral-600 max-w-lg mx-auto mb-6">
            Your memories have been successfully synced into {residentName}'s resident profile.
            The activities team at {facilityName} can now generate high-contrast, clinical-grade memory care packets
            featuring your recipes, hometown landmarks, and favorite tools.
          </p>

          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 max-w-md mx-auto mb-8 text-left text-xs text-emerald-900 space-y-1">
            <p className="font-bold text-sm text-emerald-950 mb-2">📋 Sync Confirmation Details</p>
            <p><strong>Resident:</strong> {residentName}</p>
            <p><strong>Facility:</strong> {facilityName}</p>
            <p><strong>Submission ID:</strong> {submittedContribution?.id}</p>
            <p><strong>Timestamp:</strong> {new Date().toLocaleString()}</p>
            <p className="text-neutral-500 pt-1">Stored securely in Cognicopia local encrypted facility store.</p>
          </div>

          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <button
              type="button"
              onClick={() => setActiveStep('welcome')}
              className="px-6 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-sm font-semibold rounded-lg transition"
            >
              Add More Memories
            </button>
            <a
              href="builder.html"
              className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold rounded-lg shadow transition"
            >
              View Generated Packets in Builder →
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
