export const dynamic = 'force-dynamic';
import { getDb } from '@/db';
import Link from 'next/link';
import { archiveLeadAction } from '@/app/actions/leads';
import { leads, leadScores } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export default async function LeadsPage() {
  const db = getDb();
  
  const activeLeads = await db
    .select({
      id: leads.id,
      name: leads.name,
      company: leads.company,
      email: leads.email,
      stage: leads.stage,
      status: leads.status,
      scoreValue: leadScores.scoreValue,
      scoreLabel: leadScores.scoreLabel,
    })
    .from(leads)
    .leftJoin(leadScores, and(eq(leads.id, leadScores.leadId), eq(leadScores.isCurrent, 1)))
    .where(eq(leads.status, 'Active'))
    .orderBy(desc(leadScores.scoreValue));

  const getStageBadgeClass = (stage: string) => {
    switch (stage) {
      case 'Qualified':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-100';
      case 'Researching':
        return 'bg-amber-50 text-amber-700 border border-amber-100';
      case 'Outreach in Progress':
        return 'bg-indigo-50 text-indigo-700 border border-indigo-100';
      case 'Meeting / Call':
        return 'bg-rose-50 text-rose-700 border border-rose-100';
      default:
        return 'bg-slate-50 text-slate-700 border border-slate-200';
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Active Leads</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Manage your active sales and consulting pipeline leads.
          </p>
        </div>
        <Link 
          href="/leads/new" 
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-all shadow-sm hover:scale-[1.01] shadow-indigo-600/10"
        >
          + New Lead
        </Link>
      </div>

      {activeLeads.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-xl mx-auto mt-8 space-y-6 shadow-sm animate-fade-in">
          <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 mx-auto">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div className="space-y-1.5">
            <h3 className="text-lg font-bold text-slate-900">No active leads found</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
              Start building your consulting and branding outreach pipeline by adding leads manually or running discovery scans on local markets.
            </p>
          </div>
          <div className="flex justify-center items-center gap-3 pt-2">
            <Link
              href="/leads/new"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition shadow-sm shadow-indigo-600/10 hover:scale-[1.01]"
            >
              + Add New Lead
            </Link>
            <Link
              href="/scopes"
              className="border border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold px-4 py-2.5 rounded-xl text-sm transition shadow-sm"
            >
              Launch Campaign
            </Link>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Prospect Details</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Priority</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Pipeline Stage</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {activeLeads.map((lead: any) => (
                  <tr key={lead.id} className="hover:bg-slate-50/50 transition duration-150">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link href={`/leads/${lead.id}`} className="hover:underline">
                        <div className="font-bold text-slate-900 text-sm leading-snug">{lead.name}</div>
                      </Link>
                      {lead.email && (
                        <div className="text-xs text-slate-500 font-medium mt-0.5">{lead.email}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {lead.scoreValue !== null && lead.scoreValue !== undefined ? (
                        <span 
                          aria-label={`${lead.scoreLabel} Priority, score ${lead.scoreValue} out of 100`}
                          className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold border ${
                            lead.scoreLabel === 'High' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                            lead.scoreLabel === 'Medium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            'bg-slate-50 text-slate-600 border-slate-200'
                          }`}
                        >
                          <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${
                            lead.scoreLabel === 'High' ? 'bg-rose-600 animate-pulse' :
                            lead.scoreLabel === 'Medium' ? 'bg-amber-500' : 'bg-slate-400'
                          }`} />
                          {lead.scoreLabel} ({lead.scoreValue})
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold border bg-slate-100/50 text-slate-500 border-slate-200/60">
                          Unassessed
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${getStageBadgeClass(lead.stage)}`}>
                        {lead.stage}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <form action={archiveLeadAction.bind(null, lead.id)}>
                        <button 
                          type="submit" 
                          className="text-xs font-bold text-red-600 hover:text-red-900 border border-transparent hover:border-red-200/50 px-3 py-1.5 rounded-lg hover:bg-red-50/50 transition"
                        >
                          Archive
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
