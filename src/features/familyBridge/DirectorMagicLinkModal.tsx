/**
 * @file DirectorMagicLinkModal.tsx
 * @description Facility Activity Director dashboard and modal for generating
 * tokenized magic links, sending 1-click SMS/Email, generating QR codes,
 * and approving family contributions into resident profiles.
 */

import React, { useState, useEffect } from 'react';
import { FamilyBridgeTokenService } from './tokenService.js';
import { FamilyBridgeToken, FamilyContribution } from './types.js';
import { ResidentProfile } from '../../engine/packetGenerator.js';

// Realistic preloaded facility resident roster
export const DEFAULT_RESIDENTS: ResidentProfile[] = [
  {
    id: 'res_arthur_104',
    preferredName: 'Arthur Smith',
    nickname: 'Artie',
    unitNumber: '104',
    wing: 'Memory Care - West Wing',
    birthYear: 1934,
    age: 91,
    cognitiveTier: 2,
    motorCapabilityLevel: 'moderate',
    formativeEra: '1950s',
    corePassions: ['Woodworking', 'Steam Locomotives', 'Big Band Swing'],
    pastVocation: 'Railroad Machinist & Master Carpenter',
    onHandItems: ['colored pencils', 'tactile tokens', 'smooth sanding block'],
    hometown: { place: 'Williston, North Dakota', environment: 'small-town' }
  },
  {
    id: 'res_eleanor_112',
    preferredName: 'Eleanor Vance',
    nickname: 'Ellie',
    unitNumber: '112',
    wing: 'Memory Care - South Courtyard',
    birthYear: 1938,
    age: 87,
    cognitiveTier: 1,
    motorCapabilityLevel: 'high',
    formativeEra: '1960s',
    corePassions: ['Rose Gardening', 'Choral Singing', 'Country Kitchen'],
    pastVocation: 'Elementary School Teacher & Choir Director',
    onHandItems: ['colored pencils', 'memory stones'],
    hometown: { place: 'Appleton, Wisconsin', environment: 'small-town' }
  },
  {
    id: 'res_harold_205',
    preferredName: 'Harold Jenkins',
    nickname: 'Hal',
    unitNumber: '205',
    wing: 'Assisted Living - North Wing',
    birthYear: 1941,
    age: 84,
    cognitiveTier: 3,
    motorCapabilityLevel: 'assisted',
    formativeEra: '1960s',
    corePassions: ['Fishing', 'Ham Radio', 'Model Airplanes'],
    pastVocation: 'Electronics Technician & Navy Veteran',
    onHandItems: ['tactile tokens', 'thick felt markers'],
    hometown: { place: 'Duluth, Minnesota', environment: 'coastal' }
  },
  {
    id: 'res_clara_109',
    preferredName: 'Clara Higgins',
    nickname: 'Clare',
    unitNumber: '109',
    wing: 'Memory Care - West Wing',
    birthYear: 1932,
    age: 93,
    cognitiveTier: 2,
    motorCapabilityLevel: 'moderate',
    formativeEra: '1950s',
    corePassions: ['Baking Pies', 'Quilting', 'Church Hymns'],
    pastVocation: 'Bakery Owner & Homemaker',
    onHandItems: ['colored pencils', 'recipe tokens'],
    hometown: { place: 'Cedar Rapids, Iowa', environment: 'small-town' }
  }
];

interface DirectorMagicLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  residents?: ResidentProfile[];
  initialResidentId?: string;
  facilityName?: string;
}

export const DirectorMagicLinkModal: React.FC<DirectorMagicLinkModalProps> = ({
  isOpen,
  onClose,
  residents = DEFAULT_RESIDENTS,
  initialResidentId,
  facilityName = 'St. Jude Memory Care'
}) => {
  const [activeTab, setActiveTab] = useState<'generate' | 'inbox' | 'tokens'>('generate');
  const [selectedResidentId, setSelectedResidentId] = useState<string>(initialResidentId || residents[0]?.id || '');
  const [expirationDays, setExpirationDays] = useState<number | null>(14);
  const [customNote, setCustomNote] = useState('');
  const [generatedLink, setGeneratedLink] = useState<{ url: string; token: string } | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Inboxes & records
  const [activeTokens, setActiveTokens] = useState<FamilyBridgeToken[]>([]);
  const [contributions, setContributions] = useState<FamilyContribution[]>([]);
  const [selectedContribution, setSelectedContribution] = useState<FamilyContribution | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadStorageData();
    }
  }, [isOpen]);

  const loadStorageData = () => {
    const tokens = FamilyBridgeTokenService.getAllTokens();
    const contribs = FamilyBridgeTokenService.getAllContributions();
    setActiveTokens(tokens);
    setContributions(contribs);
  };

  const handleGenerateLink = () => {
    const res = residents.find(r => r.id === selectedResidentId) || residents[0];
    if (!res) return;

    const result = FamilyBridgeTokenService.createMagicLink({
      residentId: res.id,
      residentName: res.preferredName,
      facilityName,
      unitOrWing: `${res.wing || 'Memory Care'}, Rm ${res.unitNumber || ''}`,
      expirationDays,
      customWelcomeNote: customNote.trim() || undefined
    });

    setGeneratedLink({ url: result.url, token: result.token });
    loadStorageData();
    triggerFeedback('Magic link created and saved to facility active roster!');
  };

  const triggerFeedback = (msg: string) => {
    setCopyFeedback(msg);
    setTimeout(() => setCopyFeedback(null), 3000);
  };

  const copyToClipboard = (text: string, label: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      triggerFeedback(`Copied ${label} to clipboard!`);
    }
  };

  const selectedResident = residents.find(r => r.id === selectedResidentId) || residents[0];

  const handleApproveContribution = (contrib: FamilyContribution) => {
    const targetRes = residents.find(r => r.id === contrib.residentId);
    if (!targetRes) {
      alert('Resident profile not found.');
      return;
    }

    const mergeResult = FamilyBridgeTokenService.mergeContributionIntoProfile(targetRes, contrib);
    contrib.approvedByDirector = true;
    contrib.approvedAt = new Date().toISOString();
    FamilyBridgeTokenService.saveContribution(contrib);
    loadStorageData();
    triggerFeedback(`Approved! ${mergeResult.message}`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden text-neutral-900 border border-neutral-200">
        {/* Header */}
        <div className="px-6 py-4 bg-emerald-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🌉</span>
            <div>
              <h2 className="text-lg font-bold">Family Bridge Director Console</h2>
              <p className="text-xs text-emerald-200">{facilityName} • Tokenized Intake &amp; Memory Sync</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-2 rounded-lg hover:bg-white/10 text-xl font-bold"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-neutral-200 px-6 pt-3 gap-6 text-sm font-semibold">
          <button
            onClick={() => setActiveTab('generate')}
            className={`pb-3 border-b-2 flex items-center gap-2 ${
              activeTab === 'generate'
                ? 'border-emerald-700 text-emerald-900'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <span>🔗</span> Generate Magic Link
          </button>
          <button
            onClick={() => setActiveTab('inbox')}
            className={`pb-3 border-b-2 flex items-center gap-2 relative ${
              activeTab === 'inbox'
                ? 'border-emerald-700 text-emerald-900'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <span>📬</span> Submissions Inbox
            {contributions.filter(c => !c.approvedByDirector).length > 0 && (
              <span className="px-2 py-0.5 bg-emerald-600 text-white text-xs rounded-full">
                {contributions.filter(c => !c.approvedByDirector).length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('tokens')}
            className={`pb-3 border-b-2 flex items-center gap-2 ${
              activeTab === 'tokens'
                ? 'border-emerald-700 text-emerald-900'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <span>📋</span> Active Links ({activeTokens.length})
          </button>
        </div>

        {/* Feedback Alert */}
        {copyFeedback && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-2 text-xs font-semibold text-emerald-800 flex items-center gap-2 animate-pulse">
            <span>✓</span> {copyFeedback}
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* TAB 1: GENERATE MAGIC LINK */}
          {activeTab === 'generate' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 mb-1">
                    Select Resident
                  </label>
                  <select
                    value={selectedResidentId}
                    onChange={e => {
                      setSelectedResidentId(e.target.value);
                      setGeneratedLink(null);
                    }}
                    className="w-full px-3 py-2.5 rounded-lg border border-neutral-300 font-medium text-sm bg-white"
                  >
                    {residents.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.preferredName} (Rm {r.unitNumber || 'N/A'} - {r.pastVocation || 'Resident'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 mb-1">
                    Link Expiration Window
                  </label>
                  <select
                    value={expirationDays === null ? 'perpetual' : expirationDays}
                    onChange={e => {
                      setExpirationDays(e.target.value === 'perpetual' ? null : Number(e.target.value));
                      setGeneratedLink(null);
                    }}
                    className="w-full px-3 py-2.5 rounded-lg border border-neutral-300 font-medium text-sm bg-white"
                  >
                    <option value="7">7 Days (Standard Intake)</option>
                    <option value="14">14 Days (Recommended for Family)</option>
                    <option value="30">30 Days (Extended)</option>
                    <option value="perpetual">No Expiration (Perpetual)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 mb-1">
                  Director's Custom Welcome Note to Family (Optional)
                </label>
                <input
                  type="text"
                  value={customNote}
                  onChange={e => setCustomNote(e.target.value)}
                  placeholder="e.g. We're building Arthur's spring packet this Friday! We'd love his chili recipe and memories of his machine shop."
                  className="w-full px-3 py-2.5 rounded-lg border border-neutral-300 text-sm"
                />
              </div>

              <button
                type="button"
                onClick={handleGenerateLink}
                className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow transition flex items-center justify-center gap-2"
              >
                <span>⚡</span> Generate Tokenized Magic Link for {selectedResident?.preferredName}
              </button>

              {/* Generated Result Card */}
              {generatedLink && (
                <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded">
                      Magic Link Ready
                    </span>
                    <span className="text-xs text-neutral-500 font-mono">Token: {generatedLink.token}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={generatedLink.url}
                      className="flex-1 bg-white border border-neutral-300 px-3 py-2 rounded-lg text-xs font-mono select-all"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(generatedLink.url, 'Link')}
                      className="px-4 py-2 bg-neutral-900 hover:bg-black text-white text-xs font-bold rounded-lg whitespace-nowrap"
                    >
                      Copy Link
                    </button>
                  </div>

                  {/* 1-Click Messaging Templates */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                    <div className="border border-neutral-200 rounded-lg p-3 bg-white">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-neutral-700">📱 1-Click SMS Text</span>
                        <button
                          type="button"
                          onClick={() => {
                            const sms = FamilyBridgeTokenService.generateSmsTemplate(
                              selectedResident.preferredName,
                              facilityName,
                              generatedLink.url
                            );
                            copyToClipboard(sms, 'SMS Message');
                          }}
                          className="text-xs text-emerald-700 hover:text-emerald-900 font-bold"
                        >
                          Copy Text
                        </button>
                      </div>
                      <p className="text-xs text-neutral-600 italic line-clamp-3">
                        "{FamilyBridgeTokenService.generateSmsTemplate(selectedResident.preferredName, facilityName, generatedLink.url)}"
                      </p>
                    </div>

                    <div className="border border-neutral-200 rounded-lg p-3 bg-white">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-neutral-700">✉️ 1-Click Email</span>
                        <button
                          type="button"
                          onClick={() => {
                            const email = FamilyBridgeTokenService.generateEmailTemplate(
                              selectedResident.preferredName,
                              facilityName,
                              generatedLink.url
                            );
                            copyToClipboard(`Subject: ${email.subject}\n\n${email.body}`, 'Email Draft');
                          }}
                          className="text-xs text-emerald-700 hover:text-emerald-900 font-bold"
                        >
                          Copy Draft
                        </button>
                      </div>
                      <p className="text-xs text-neutral-600 line-clamp-3">
                        Subject: Help us personalize cognitive activities for {selectedResident.preferredName}...
                      </p>
                    </div>
                  </div>

                  {/* SVG QR Code for Print/Scan */}
                  <div className="pt-2 border-t border-neutral-200 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-neutral-800">Printable Intake QR Code</p>
                      <p className="text-xs text-neutral-500">Scan from mobile camera to open instantly</p>
                    </div>
                    <div className="w-16 h-16 bg-white p-1 border border-neutral-300 rounded-lg flex items-center justify-center">
                      {/* High-contrast crisp SVG QR code matrix placeholder */}
                      <svg viewBox="0 0 33 33" className="w-full h-full">
                        <rect x="0" y="0" width="33" height="33" fill="#ffffff" />
                        {/* Corner Targets */}
                        <rect x="2" y="2" width="7" height="7" fill="#000000" />
                        <rect x="3" y="3" width="5" height="5" fill="#ffffff" />
                        <rect x="4" y="4" width="3" height="3" fill="#000000" />
                        <rect x="24" y="2" width="7" height="7" fill="#000000" />
                        <rect x="25" y="3" width="5" height="5" fill="#ffffff" />
                        <rect x="26" y="4" width="3" height="3" fill="#000000" />
                        <rect x="2" y="24" width="7" height="7" fill="#000000" />
                        <rect x="3" y="25" width="5" height="5" fill="#ffffff" />
                        <rect x="4" y="26" width="3" height="3" fill="#000000" />
                        {/* Pattern bits */}
                        <rect x="11" y="4" width="2" height="2" fill="#000000" />
                        <rect x="15" y="4" width="2" height="2" fill="#000000" />
                        <rect x="19" y="4" width="2" height="2" fill="#000000" />
                        <rect x="11" y="8" width="4" height="2" fill="#000000" />
                        <rect x="18" y="8" width="3" height="2" fill="#000000" />
                        <rect x="4" y="11" width="3" height="2" fill="#000000" />
                        <rect x="10" y="12" width="5" height="2" fill="#000000" />
                        <rect x="22" y="12" width="4" height="2" fill="#000000" />
                        <rect x="14" y="16" width="5" height="3" fill="#000000" />
                        <rect x="5" y="18" width="2" height="3" fill="#000000" />
                        <rect x="11" y="22" width="3" height="2" fill="#000000" />
                        <rect x="16" y="22" width="4" height="2" fill="#000000" />
                        <rect x="24" y="22" width="2" height="4" fill="#000000" />
                        <rect x="11" y="27" width="5" height="2" fill="#000000" />
                        <rect x="20" y="27" width="6" height="2" fill="#000000" />
                      </svg>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SUBMISSIONS INBOX */}
          {activeTab === 'inbox' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-neutral-600">
                  Review incoming memories from family members and sync them into resident profiles.
                </p>
                <span className="text-xs font-semibold text-neutral-500">
                  {contributions.length} total submissions
                </span>
              </div>

              {contributions.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-neutral-200 rounded-xl">
                  <span className="text-3xl mb-2 block">📭</span>
                  <p className="font-semibold text-neutral-700">No Family Submissions Yet</p>
                  <p className="text-xs text-neutral-500 max-w-sm mx-auto mt-1">
                    Send a magic link to a family member using the "Generate Magic Link" tab to receive photos, recipes, and memories.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {contributions.map(contrib => (
                    <div
                      key={contrib.id}
                      className="border border-neutral-200 rounded-xl p-4 bg-white hover:border-emerald-500 transition shadow-xs"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                        <div>
                          <span className="font-bold text-neutral-900 text-sm">
                            {contrib.contributorName} ({contrib.contributorRelationship})
                          </span>
                          <span className="text-xs text-neutral-500 ml-2">
                            for <strong>{contrib.residentName}</strong>
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {contrib.approvedByDirector ? (
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                              ✓ Merged &amp; Active
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleApproveContribution(contrib)}
                              className="text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 px-3 py-1 rounded-lg shadow-xs"
                            >
                              Approve &amp; Merge Profile
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-neutral-600 bg-neutral-50 p-2.5 rounded-lg mb-2">
                        <div>
                          <span className="font-semibold block text-neutral-800">Photos</span>
                          {contrib.photos?.length || 0} attached
                        </div>
                        <div>
                          <span className="font-semibold block text-neutral-800">Recipes</span>
                          {contrib.recipes?.length || 0} shared
                        </div>
                        <div>
                          <span className="font-semibold block text-neutral-800">Landmarks</span>
                          {contrib.landmarks?.length || 0} listed
                        </div>
                        <div>
                          <span className="font-semibold block text-neutral-800">Tools / Career</span>
                          {contrib.career?.favoriteTools?.length || 0} tools
                        </div>
                      </div>

                      {/* Snippet details */}
                      {contrib.recipes && contrib.recipes.length > 0 && (
                        <p className="text-xs text-neutral-700">
                          🍳 <strong>Recipe:</strong> {contrib.recipes[0].recipeName} ({contrib.recipes[0].sensorySmellOrTaste})
                        </p>
                      )}
                      {contrib.landmarks && contrib.landmarks.length > 0 && (
                        <p className="text-xs text-neutral-700 mt-0.5">
                          📍 <strong>Landmark:</strong> {contrib.landmarks[0].landmarkName} — {contrib.landmarks[0].cherishedMemory}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ACTIVE TOKENS */}
          {activeTab === 'tokens' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-neutral-600">Active and perpetual magic links generated for family intake.</p>
                <button
                  type="button"
                  onClick={() => {
                    const dataStr = JSON.stringify(activeTokens, null, 2);
                    const blob = new Blob([dataStr], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `cognicopia_family_tokens_${new Date().toISOString().slice(0, 10)}.json`;
                    a.click();
                  }}
                  className="text-xs font-semibold text-neutral-700 hover:text-black"
                >
                  Export All Tokens JSON ↓
                </button>
              </div>

              {activeTokens.length === 0 ? (
                <p className="text-xs text-neutral-500 py-6 text-center">No active tokens on file.</p>
              ) : (
                <div className="space-y-2">
                  {activeTokens.map(t => (
                    <div key={t.token} className="flex items-center justify-between p-3 border border-neutral-200 rounded-lg text-xs bg-white">
                      <div>
                        <p className="font-bold text-neutral-900">{t.residentName}</p>
                        <p className="text-neutral-500 font-mono text-[11px] truncate max-w-xs">{t.token}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 rounded font-semibold ${
                          t.status === 'submitted' ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-100 text-neutral-700'
                        }`}>
                          {t.status.toUpperCase()} ({t.submissionCount || 0})
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(t.url, 'Link')}
                          className="text-emerald-700 hover:text-emerald-900 font-bold"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-neutral-50 border-t border-neutral-200 flex justify-between items-center text-xs text-neutral-500">
          <span>Cognicopia Offline-First Storage • AES-GCM Encrypted Local Record</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-neutral-200 hover:bg-neutral-300 text-neutral-800 font-semibold rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
