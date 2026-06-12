import { LeadService } from '@/services/lead';
import { getDb } from '@/db';
import Link from 'next/link';
import { archiveLeadAction } from '@/app/actions/leads';



export default async function LeadsPage() {
  const db = getDb();
  const service = new LeadService(db);
  
  const leads = await service.listLeads();

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
          className="bg-slate-950 hover:bg-slate-800 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-all shadow-sm hover:scale-[1.01]"
        >
          + New Lead
        </Link>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Prospect Details</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Company</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Pipeline Stage</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {leads.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-500 font-medium">
                    No active leads found. Start building your pipeline!
                  </td>
                </tr>
              ) : (
                leads.map((lead: any) => (
                  <tr key={lead.id} className="hover:bg-slate-50/50 transition duration-150">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link href={`/leads/${lead.id}`} className="hover:underline">
                        <div className="font-bold text-slate-900 text-sm leading-snug">{lead.name}</div>
                      </Link>
                      <div className="text-xs text-slate-400 font-medium mt-0.5">{lead.email || 'No email provided'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-700">
                      {lead.company || '—'}
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
