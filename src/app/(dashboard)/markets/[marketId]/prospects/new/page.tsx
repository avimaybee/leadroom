'use client';

import { useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Loader2, Upload, ShieldAlert, CheckCircle2, XCircle, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { createProspectAction, importProspectsCSVAction } from '@/app/actions/research';

function ManualEntry({ marketId, onSuccess }: { marketId: string; onSuccess: () => void }) {
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [domain, setDomain] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const form = new FormData();
    form.set('name', name || company);
    form.set('company', company);
    form.set('domain', domain);
    form.set('notes', notes);
    form.set('marketId', marketId);

    const result = await createProspectAction(null, form);
    if (result.error) {
      setError(result.error);
      setSaving(false);
      return;
    }

    toast.success('Prospect added');
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive border border-destructive/20">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span className="text-copy-14">{error}</span>
        </div>
      )}

      <div>
        <label className="label-12 uppercase text-muted-foreground block mb-1.5">Contact Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Jane Smith"
          className="w-full h-10 rounded-md border border-border bg-background px-3 text-copy-14 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
      <div>
        <label className="label-12 uppercase text-muted-foreground block mb-1.5">Company Name *</label>
        <input
          type="text"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          required
          placeholder="e.g. Acme Corporation"
          className="w-full h-10 rounded-md border border-border bg-background px-3 text-copy-14 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
      <div>
        <label className="label-12 uppercase text-muted-foreground block mb-1.5">Domain *</label>
        <input
          type="text"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          required
          placeholder="e.g. acme.com"
          className="w-full h-10 rounded-md border border-border bg-background px-3 text-copy-14 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <p className="text-label-12 text-muted-foreground mt-1">Website domain for research. Protocol is added automatically.</p>
      </div>
      <div>
        <label className="label-12 uppercase text-muted-foreground block mb-1.5">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Any context about this prospect..."
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-copy-14 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={saving}
        className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-primary text-primary-foreground text-label-14 hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
        {saving ? 'Creating prospect...' : 'Add & Research'}
      </button>
    </form>
  );
}

function CSVImport({ marketId, onSuccess }: { marketId: string; onSuccess: () => void }) {
  const [csvText, setCsvText] = useState('');
  const [preview, setPreview] = useState<{ name: string; domain: string; valid: boolean }[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvText(text);
      parsePreview(text);
    };
    reader.readAsText(file);
  };

  const parsePreview = (text: string) => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return;
    const header = lines[0].split(',').map(h => h.trim().toLowerCase());
    const nameIdx = header.indexOf('name');
    const domainIdx = header.indexOf('domain');
    if (nameIdx === -1 || domainIdx === -1) {
      setError('CSV must have "name" and "domain" columns');
      return;
    }
    setError(null);
    const rows = lines.slice(1).map(line => {
      const cols = line.split(',').map(c => c.trim());
      return {
        name: cols[nameIdx] || '',
        domain: cols[domainIdx] || '',
        valid: !!(cols[nameIdx] && cols[domainIdx]),
      };
    });
    setPreview(rows);
  };

  const handleImport = async () => {
    if (!csvText) return;
    setImporting(true);
    setError(null);

    const form = new FormData();
    form.set('csv', csvText);
    form.set('marketId', marketId);

    const result = await importProspectsCSVAction(form);
    if (result.error) {
      setError(result.error);
      setImporting(false);
      return;
    }

    toast.success(`${result.created} prospects added`);
    onSuccess();
  };

  const validCount = preview?.filter(r => r.valid).length ?? 0;

  return (
    <div className="space-y-5 max-w-lg">
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive border border-destructive/20">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span className="text-copy-14">{error}</span>
        </div>
      )}

      {!csvText ? (
        <label className="flex flex-col items-center justify-center gap-3 p-10 rounded-xl border-2 border-dashed border-border/30 cursor-pointer hover:border-border/60 transition-colors">
          <Upload className="w-8 h-8 text-muted-foreground" />
          <div className="text-center">
            <p className="text-copy-14 font-medium text-foreground">Drop CSV file here</p>
            <p className="text-label-12 text-muted-foreground mt-1">or click to browse</p>
          </div>
          <span className="inline-flex items-center h-9 px-4 rounded-md border border-border text-label-14 hover:bg-muted/50 transition-colors">
            Browse Files
          </span>
          <input type="file" accept=".csv" onChange={handleFile} className="hidden" />
          <p className="text-label-12 text-muted-foreground">Expected columns: name, domain (notes optional)</p>
        </label>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-label-14 font-medium">Preview</p>
            <button
              type="button"
              onClick={() => { setCsvText(''); setPreview(null); setError(null); }}
              className="text-label-12 text-muted-foreground hover:text-foreground"
            >
              Choose different file
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="text-left px-3 py-2 text-label-12 text-muted-foreground">Name</th>
                  <th className="text-left px-3 py-2 text-label-12 text-muted-foreground">Domain</th>
                  <th className="text-center px-3 py-2 text-label-12 text-muted-foreground">Valid</th>
                </tr>
              </thead>
              <tbody>
                {preview?.map((row, i) => (
                  <tr key={i} className="border-b border-border/40 last:border-0">
                    <td className="px-3 py-2 text-copy-14">{row.name}</td>
                    <td className="px-3 py-2 text-copy-13 text-muted-foreground">{row.domain}</td>
                    <td className="px-3 py-2 text-center">
                      {row.valid
                        ? <CheckCircle2 className="w-4 h-4 text-chart-2 inline" />
                        : <XCircle className="w-4 h-4 text-destructive inline" />
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            disabled={importing || validCount === 0}
            onClick={handleImport}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-primary text-primary-foreground text-label-14 hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {importing && <Loader2 className="w-4 h-4 animate-spin" />}
            {importing ? 'Importing...' : `Import ${validCount} of ${preview?.length || 0} Prospects`}
          </button>
        </div>
      )}
    </div>
  );
}

export default function NewProspectPage() {
  const router = useRouter();
  const params = useParams();
  const marketId = params.marketId as string;
  const [tab, setTab] = useState<'manual' | 'csv'>('manual');

  const onSuccess = () => {
    router.push(`/markets/${marketId}/prospects`);
  };

  return (
    <div className="max-w-3xl">
      <h2 className="text-heading-lg mb-1">Add Prospect</h2>
      <p className="text-copy-14 text-muted-foreground mb-6 max-w-2xl">
        Add companies to research and score. Each prospect will be queued for automated research.
      </p>

      <div className="rounded-md bg-muted/25 p-1 flex gap-1 w-fit mb-6">
        <button
          type="button"
          onClick={() => setTab('manual')}
          className={`rounded-md px-3.5 py-2 text-label-14 transition-colors ${
            tab === 'manual' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Plus className="w-4 h-4 inline mr-1.5" />
          Manual Entry
        </button>
        <button
          type="button"
          onClick={() => setTab('csv')}
          className={`rounded-md px-3.5 py-2 text-label-14 transition-colors ${
            tab === 'csv' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Upload className="w-4 h-4 inline mr-1.5" />
          CSV Import
        </button>
      </div>

      {tab === 'manual' ? (
        <ManualEntry marketId={marketId} onSuccess={onSuccess} />
      ) : (
        <CSVImport marketId={marketId} onSuccess={onSuccess} />
      )}
    </div>
  );
}
