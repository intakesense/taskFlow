'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@taskflow/ui';
import { Building2, Link2, Link2Off, Loader2, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { SettingsSection } from './settings-view';
import { LinkHrmsDialog } from '../attendance/link-hrms-dialog';

export interface HrmsStatus {
  linked: boolean;
  tokenExpired?: boolean;
  employee?: { name: string; employeeId: string };
  linkedAt?: string;
}

export interface HrmsSettingsProps {
  /** Fetch current HRMS link status */
  onFetchStatus: () => Promise<HrmsStatus>;
  /** Unlink the HRMS account */
  onUnlink: () => Promise<void>;
  /** Base URL for HRMS API calls inside LinkHrmsDialog. Defaults to '' (same origin). */
  apiBaseUrl?: string;
}

export function HrmsSettings({ onFetchStatus, onUnlink, apiBaseUrl }: HrmsSettingsProps) {
  const [status, setStatus] = useState<HrmsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [unlinking, setUnlinking] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const result = await onFetchStatus();
      setStatus(result);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [onFetchStatus]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  // Scroll to this section if hash matches
  useEffect(() => {
    if (window.location.hash === '#hrms') {
      document.getElementById('hrms-settings')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const handleUnlink = async () => {
    setUnlinking(true);
    try {
      await onUnlink();
      setStatus({ linked: false });
      toast.success('HRMS account unlinked');
    } catch {
      toast.error('Failed to unlink');
    } finally {
      setUnlinking(false);
    }
  };

  return (
    <SettingsSection
      id="hrms-settings"
      title="HRMS Account"
      description="Link your HRMS account to check in and check out directly from TaskFlow."
      icon={<Building2 className="h-5 w-5" />}
    >
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking status...
        </div>
      ) : status?.linked && !status.tokenExpired ? (
        <div className="space-y-4">
          {/* Linked state */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                {status.employee?.name || 'Account linked'}
              </p>
              <p className="text-xs text-muted-foreground">
                Employee ID: {status.employee?.employeeId || '—'}
                {status.linkedAt && (
                  <> · Linked {new Date(status.linkedAt).toLocaleDateString()}</>
                )}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogOpen(true)}
              className="gap-2"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Re-link
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleUnlink}
              disabled={unlinking}
              className="gap-2 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
            >
              {unlinking
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Link2Off className="h-3.5 w-3.5" />
              }
              Unlink
            </Button>
          </div>
        </div>
      ) : status?.tokenExpired ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Session expired</p>
              <p className="text-xs text-muted-foreground">
                Re-link your account to continue using check-in / check-out.
              </p>
            </div>
          </div>
          <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-2">
            <Link2 className="h-3.5 w-3.5" />
            Re-link Account
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            No HRMS account linked. Connect your account to enable one-tap attendance tracking.
          </p>
          <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-2">
            <Link2 className="h-3.5 w-3.5" />
            Link HRMS Account
          </Button>
        </div>
      )}

      <LinkHrmsDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onLinked={fetchStatus}
        apiBaseUrl={apiBaseUrl}
      />
    </SettingsSection>
  );
}
