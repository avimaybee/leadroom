'use client';

import { useState, useEffect } from 'react';
import { ExternalLink, Link2, Link2Off, Loader2, RefreshCw, Eye, EyeOff, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  syncCalendarAction,
  disconnectCalendarAction,
  getCalendarAuthUrlAction,
  saveGoogleCredentialsAction,
  getGoogleCredentialsAction,
} from '@/app/actions/calendar';

interface Props {
  initialConnected: boolean;
  isConfigured: boolean;
  hasStoredCredentials: boolean;
}

export function CalendarIntegration({ initialConnected, isConfigured, hasStoredCredentials }: Props) {
  const [connected, setConnected] = useState(initialConnected);
  const [syncing, setSyncing] = useState(false);
  const [showCredForm, setShowCredForm] = useState(!isConfigured);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (hasStoredCredentials) {
      getGoogleCredentialsAction().then((creds) => {
        if (creds) {
          setClientId(creds.googleClientId || '');
          setClientSecret(creds.googleClientSecret || '');
        }
      }).catch(() => {});
    }
  }, [hasStoredCredentials]);

  const handleConnect = async () => {
    const configured = isConfigured || (clientId && clientSecret);
    if (!configured) {
      toast.error('Enter your Google Client ID and Secret first.');
      return;
    }
    const result: any = await getCalendarAuthUrlAction();
    if (result.error) {
      toast.error(result.error);
    } else if (result.url) {
      window.location.href = result.url;
    }
  };

  const handleDisconnect = async () => {
    const confirmed = window.confirm('Disconnect Google Calendar? Tasks will no longer sync.');
    if (!confirmed) return;
    const result: any = await disconnectCalendarAction();
    if (result.error) {
      toast.error(result.error);
    } else {
      setConnected(false);
      toast.success('Google Calendar disconnected');
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    const result: any = await syncCalendarAction();
    setSyncing(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`Synced ${result.synced} events to Google Calendar (${result.errors} errors)`);
    }
  };

  const handleSaveCredentials = async () => {
    if (!clientId || !clientSecret) {
      toast.error('Both Client ID and Client Secret are required');
      return;
    }
    setSaving(true);
    const result: any = await saveGoogleCredentialsAction(clientId, clientSecret);
    setSaving(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success('Google API credentials saved');
      setShowCredForm(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 p-4 rounded-lg border border-border bg-card">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-muted text-muted-foreground">
              <Link2 className="h-3.5 w-3.5" />
            </span>
            <span className="text-label-14 text-foreground font-semibold">Google Calendar</span>
            {connected ? (
              <span className="inline-flex items-center gap-1 text-label-12 font-semibold text-chart-2">
                <span className="w-1.5 h-1.5 rounded-full bg-chart-2" />
                Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-label-12 text-muted-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                Not connected
              </span>
            )}
          </div>
          <p className="text-label-12 text-muted-foreground ml-9">
            {connected
              ? 'Your open tasks will appear as events in your primary Google Calendar.'
              : 'Sync tasks and reminders to your Google Calendar for external visibility.'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {connected ? (
            <>
              <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
                {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
                Sync Now
              </Button>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={handleDisconnect}>
                <Link2Off className="h-3.5 w-3.5 mr-1" />
                Disconnect
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={handleConnect}>
              <ExternalLink className="h-3.5 w-3.5 mr-1" />
              Connect
            </Button>
          )}
        </div>
      </div>

      {/* Credential form */}
      <div className="rounded-lg border border-border bg-card p-4">
        <button
          type="button"
          onClick={() => setShowCredForm(!showCredForm)}
          className="text-label-14 font-semibold text-foreground hover:text-muted-foreground transition-colors"
        >
          {showCredForm ? 'Hide' : 'Edit'} Google API credentials
        </button>

        {showCredForm && (
          <div className="mt-4 space-y-3">
            <p className="text-label-12 text-muted-foreground">
              Enter your own Google OAuth credentials. Create a project in the{' '}
              <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="underline text-primary hover:text-primary/80">
                Google Cloud Console
              </a>, add the <code className="text-label-12 bg-muted px-1 rounded">Calendar API</code>, and configure the redirect URI to:
            </p>
            <code className="block text-label-12 bg-muted px-3 py-2 rounded-md border border-border text-foreground break-all">
              {typeof window !== 'undefined' ? `${window.location.origin}/api/calendar/callback` : ''}
            </code>

            <div className="space-y-2">
              <Label htmlFor="google-client-id" className="text-label-14 text-foreground">Client ID</Label>
              <Input
                id="google-client-id"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="123456789-xxxxx.apps.googleusercontent.com"
                className="text-label-14"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="google-client-secret" className="text-label-14 text-foreground">Client Secret</Label>
              <div className="relative">
                <Input
                  id="google-client-secret"
                  type={showSecret ? 'text' : 'password'}
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder="GOCSPX-xxxxxxxxxxxx"
                  className="text-label-14 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button onClick={handleSaveCredentials} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Save credentials
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
