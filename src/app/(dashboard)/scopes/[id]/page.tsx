'use client';



import { useState, useEffect, use } from 'react';
import Link from 'next/link';

interface Scope {
  id: string;
  name: string;
  description: string | null;
  industryFilter: string | null;
  geographyFilter: string | null;
  companySizeFilter: string | null;
  businessTypeFilter: string | null;
  notes: string | null;
  createdAt: string;
}

interface Candidate {
  id: string;
  discoveryScopeId: string | null;
  rawName: string;
  rawWebsiteUrl: string | null;
  rawContactInfo: string | null;
  rawLocation: string | null;
  notes: string | null;
  status: 'NEW' | 'REVIEWED' | 'PROMOTED' | 'DISCARDED';
  promotedLeadId: string | null;
  createdAt: string;
}

export default function ScopeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  
  const [scope, setScope] = useState<Scope | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Tab control: 'pending', 'promoted', 'discarded'
  const [activeTab, setActiveTab] = useState<'pending' | 'promoted' | 'discarded'>('pending');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCandidate, setNewCandidate] = useState({
    rawName: '',
    rawWebsiteUrl: '',
    rawLocation: '',
    rawContactInfo: '',
    notes: '',
  });
  const [modalError, setModalError] = useState('');
  const [submittingCandidate, setSubmittingCandidate] = useState(false);
  
  // Current logged in user ID
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    // Fetch user profile
    fetch('/api/auth/me')
      .then(res => {
        if (res.ok) return res.json() as Promise<{ user: { id: string; name: string } }>;
        throw new Error('Not logged in');
      })
      .then(data => {
        setCurrentUser(data.user);
      })
      .catch(() => {
        console.warn('Unable to retrieve current user info');
      });

    // Fetch Scope and Candidates
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [scopeRes, candidatesRes] = await Promise.all([
        fetch(`/api/scopes?id=${id}`),
        fetch(`/api/candidates?scopeId=${id}`),
      ]);

      if (!scopeRes.ok) throw new Error('Failed to load scope');
      if (!candidatesRes.ok) throw new Error('Failed to load candidates');

      const scopeData = (await scopeRes.json()) as { data: Scope };
      const candidatesData = (await candidatesRes.json()) as { data: Candidate[] };

      setScope(scopeData.data);
      setCandidates(candidatesData.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred while fetching data';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (candidateId: string, status: 'PROMOTED' | 'DISCARDED') => {
    try {
      const payload: { id: string; status: string; ownerId?: string } = { id: candidateId, status };
      if (status === 'PROMOTED') {
        if (!currentUser) {
          alert('User session not loaded. Please try logging in again.');
          return;
        }
        payload.ownerId = currentUser.id;
      }

      const res = await fetch('/api/candidates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        let errMsg = 'Failed to update candidate status';
        try {
          const errData = JSON.parse(errText);
          if (errData.error) errMsg = errData.error;
        } catch (_) {}
        throw new Error(errMsg);
      }

      // Re-fetch data
      await fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error updating candidate';
      alert(msg);
    }
  };

  const handleAddCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    setSubmittingCandidate(true);

    try {
      const res = await fetch('/api/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newCandidate,
          discoveryScopeId: id,
          status: 'NEW',
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        let errMsg = 'Failed to add candidate';
        try {
          const errData = JSON.parse(errText);
          errMsg = errData.error?.rawName?._errors?.[0] || errData.error || errMsg;
        } catch (_) {}
        throw new Error(errMsg);
      }

      // Reset modal state
      setNewCandidate({
        rawName: '',
        rawWebsiteUrl: '',
        rawLocation: '',
        rawContactInfo: '',
        notes: '',
      });
      setIsModalOpen(false);
      // Re-fetch list
      await fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error submitting candidate';
      setModalError(msg);
    } finally {
      setSubmittingCandidate(false);
    }
  };

  const filteredCandidates = candidates.filter((c) => {
    if (activeTab === 'pending') return c.status === 'NEW' || c.status === 'REVIEWED';
    if (activeTab === 'promoted') return c.status === 'PROMOTED';
    return c.status === 'DISCARDED';
  });

  if (loading && !scope) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (error || !scope) {
    return (
      <div className="bg-red-50 text-red-600 p-6 rounded-2xl border border-red-100 max-w-xl mx-auto mt-10">
        <h3 className="font-bold text-lg">Error loading scope</h3>
        <p className="mt-1 text-sm">{error || 'Scope not found.'}</p>
        <Link href="/scopes" className="mt-4 inline-block font-semibold text-sm underline">
          &larr; Back to Scopes
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in relative">
      {/* Scope Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <Link 
            href="/scopes" 
            className="p-2 border border-slate-200 rounded-lg hover:bg-slate-100 text-slate-500 transition"
          >
            &larr; Scopes
          </Link>
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{scope.name}</h1>
            <p className="text-sm text-slate-500 mt-1">Configure and qualify leads within this segment.</p>
          </div>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition shadow-sm hover:scale-[1.01]"
        >
          + Add Candidate Manually
        </button>
      </div>

      {/* Details & Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sidebar details */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 h-fit space-y-6">
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Scope Specifications</h3>
            <div className="space-y-3">
              <div>
                <span className="block text-xs font-bold text-slate-500 uppercase">Description</span>
                <span className="text-sm text-slate-700 font-medium block mt-0.5">
                  {scope.description || 'No description provided.'}
                </span>
              </div>
              {scope.industryFilter && (
                <div>
                  <span className="block text-xs font-bold text-slate-500 uppercase">Target Industry</span>
                  <span className="text-sm text-slate-700 font-medium block mt-0.5">{scope.industryFilter}</span>
                </div>
              )}
              {scope.geographyFilter && (
                <div>
                  <span className="block text-xs font-bold text-slate-500 uppercase">Geography</span>
                  <span className="text-sm text-slate-700 font-medium block mt-0.5">{scope.geographyFilter}</span>
                </div>
              )}
              {scope.companySizeFilter && (
                <div>
                  <span className="block text-xs font-bold text-slate-500 uppercase">Company Size</span>
                  <span className="text-sm text-slate-700 font-medium block mt-0.5">{scope.companySizeFilter}</span>
                </div>
              )}
            </div>
          </div>

          {scope.notes && (
            <div className="pt-6 border-t border-slate-100">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Scope Notes</h3>
              <p className="text-sm text-slate-600 bg-slate-50 p-4 rounded-xl leading-relaxed whitespace-pre-wrap">
                {scope.notes}
              </p>
            </div>
          )}
        </div>

        {/* Candidate lists */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tabs */}
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setActiveTab('pending')}
              className={`pb-4 px-6 font-semibold text-sm border-b-2 transition-all duration-200 ${
                activeTab === 'pending'
                  ? 'border-indigo-600 text-indigo-600 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Pending Review ({candidates.filter((c) => c.status === 'NEW' || c.status === 'REVIEWED').length})
            </button>
            <button
              onClick={() => setActiveTab('promoted')}
              className={`pb-4 px-6 font-semibold text-sm border-b-2 transition-all duration-200 ${
                activeTab === 'promoted'
                  ? 'border-indigo-600 text-indigo-600 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Promoted ({candidates.filter((c) => c.status === 'PROMOTED').length})
            </button>
            <button
              onClick={() => setActiveTab('discarded')}
              className={`pb-4 px-6 font-semibold text-sm border-b-2 transition-all duration-200 ${
                activeTab === 'discarded'
                  ? 'border-indigo-600 text-indigo-600 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Discarded ({candidates.filter((c) => c.status === 'DISCARDED').length})
            </button>
          </div>

          {/* List display */}
          <div className="space-y-4">
            {filteredCandidates.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-500">
                No prospects found in this category.
              </div>
            ) : (
              filteredCandidates.map((candidate) => (
                <div
                  key={candidate.id}
                  className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row justify-between md:items-center gap-6"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h4 className="font-extrabold text-slate-900 text-lg leading-snug">{candidate.rawName}</h4>
                      {candidate.rawLocation && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-600">
                          {candidate.rawLocation}
                        </span>
                      )}
                    </div>
                    
                    {candidate.rawWebsiteUrl && (
                      <a
                        href={candidate.rawWebsiteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-600 hover:underline text-sm font-semibold flex items-center gap-1.5"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        {candidate.rawWebsiteUrl}
                      </a>
                    )}

                    {candidate.rawContactInfo && (
                      <div className="text-xs font-medium text-slate-500">
                        <span className="font-bold text-slate-600">Contact:</span> {candidate.rawContactInfo}
                      </div>
                    )}

                    {candidate.notes && (
                      <p className="text-sm text-slate-500 bg-slate-50/70 p-3 rounded-lg border border-slate-100 whitespace-pre-wrap">
                        {candidate.notes}
                      </p>
                    )}
                  </div>

                  {/* Right hand Actions */}
                  <div className="flex md:flex-col gap-2 shrink-0 md:items-end justify-end">
                    {candidate.status !== 'PROMOTED' && candidate.status !== 'DISCARDED' && (
                      <>
                        <button
                          onClick={() => handleUpdateStatus(candidate.id, 'PROMOTED')}
                          className="bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow hover:scale-[1.01]"
                        >
                          Promote to Lead
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(candidate.id, 'DISCARDED')}
                          className="border border-slate-200 hover:border-slate-300 text-slate-600 hover:bg-slate-50 font-bold text-xs px-4 py-2 rounded-xl transition"
                        >
                          Discard
                        </button>
                      </>
                    )}

                    {candidate.status === 'PROMOTED' && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                        Promoted to Lead
                      </span>
                    )}

                    {candidate.status === 'DISCARDED' && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                        Discarded
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Manual Candidate Intake Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-lg shadow-2xl p-6 space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <h3 className="font-extrabold text-slate-900 text-lg">Add Prospect Candidate</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 border border-slate-200 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleAddCandidate} className="space-y-4">
              {modalError && (
                <div className="bg-red-50 text-red-600 p-3.5 rounded-xl text-xs font-semibold border border-red-100">
                  {modalError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Business Name *</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Austin Smiles Dentistry"
                  value={newCandidate.rawName}
                  onChange={(e) => setNewCandidate({ ...newCandidate, rawName: e.target.value })}
                  className="block w-full rounded-xl border border-slate-200 py-2.5 px-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 placeholder:text-slate-400 shadow-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Website URL</label>
                <input
                  type="url"
                  placeholder="e.g. https://austinsmiles.com"
                  value={newCandidate.rawWebsiteUrl}
                  onChange={(e) => setNewCandidate({ ...newCandidate, rawWebsiteUrl: e.target.value })}
                  className="block w-full rounded-xl border border-slate-200 py-2.5 px-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 placeholder:text-slate-400 shadow-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Location</label>
                  <input
                    type="text"
                    placeholder="e.g. Austin, TX"
                    value={newCandidate.rawLocation}
                    onChange={(e) => setNewCandidate({ ...newCandidate, rawLocation: e.target.value })}
                    className="block w-full rounded-xl border border-slate-200 py-2.5 px-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 placeholder:text-slate-400 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Contact Info</label>
                  <input
                    type="text"
                    placeholder="e.g. hello@website.com"
                    value={newCandidate.rawContactInfo}
                    onChange={(e) => setNewCandidate({ ...newCandidate, rawContactInfo: e.target.value })}
                    className="block w-full rounded-xl border border-slate-200 py-2.5 px-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 placeholder:text-slate-400 shadow-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Internal Prospect Notes</label>
                <textarea
                  placeholder="e.g. Website has poor SEO; no live chat system implemented..."
                  rows={3}
                  value={newCandidate.notes}
                  onChange={(e) => setNewCandidate({ ...newCandidate, notes: e.target.value })}
                  className="block w-full rounded-xl border border-slate-200 py-2.5 px-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 placeholder:text-slate-400 shadow-sm"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 rounded-xl font-semibold text-sm transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCandidate}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm transition shadow-sm hover:scale-[1.01] disabled:opacity-50"
                >
                  {submittingCandidate ? 'Saving...' : 'Add Candidate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
