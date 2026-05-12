'use client';

import { useState, useCallback } from 'react';
import {
  CheckCircle2,
  Upload,
  Clock,
  XCircle,
  Archive,
  FolderOpen,
  RefreshCw,
  AlertTriangle,
  HardDrive,
  Folder,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@taskflow/ui';
import { SettingsSection, SettingsRow } from './settings-view';
import {
  useWorkFolderFiles,
  useWorkFolderConfig,
  useWorkFolderUsage,
  useWorkFolderSignedUrl,
  formatBytes,
} from '../../hooks/use-work-folder';
import type { WorkFolderFileRow } from '../../services/work-folder';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'failed' | 'archived';

// ─── Props ────────────────────────────────────────────────────────────────────

/** Live upload progress for in-flight files, keyed by relative_path. */
export type LocalFileStatuses = Map<string, { status: 'syncing' | 'pending'; progress?: number }>;

export interface WorkFolderSettingsProps {
  /** Current sync state from Zustand store (passed from desktop App.tsx). */
  syncStatus: 'synced' | 'syncing' | 'queued' | 'failed' | 'offline';
  /** Whether the file watcher is active. */
  watcherRunning: boolean;
  /** Whether the work folder is configured. */
  isConfigured: boolean;
  /** Local folder path (from Zustand store). */
  folderPath: string | null;
  /** Number of currently failed files in Zustand store. */
  failedCount: number;
  /**
   * Live upload statuses from Zustand, keyed by relative_path.
   * Optional — only available on Desktop. Used to show upload progress bars.
   */
  localStatuses?: LocalFileStatuses;
  /** Callback to retry all failed files. */
  onRetryAll: () => void;
  /** Callback to open the folder in OS file explorer. */
  onOpenFolder: () => void;
  /** Callback to change the work folder location. */
  onChangeLocation: () => void;
  /** Callback to remove work folder sync (stop watcher, clear config). */
  onRemoveSync: () => void;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function SyncStatusBadge({ status }: { status: WorkFolderSettingsProps['syncStatus'] }) {
  const map = {
    synced: { label: 'All synced', icon: <CheckCircle2 className="h-3.5 w-3.5" />, cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
    syncing: { label: 'Syncing…', icon: <Upload className="h-3.5 w-3.5 animate-pulse" />, cls: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
    queued: { label: 'Queued', icon: <Clock className="h-3.5 w-3.5" />, cls: 'bg-amber-500/15 text-amber-400 border-amber-500/20' },
    failed: { label: 'Has failures', icon: <XCircle className="h-3.5 w-3.5" />, cls: 'bg-red-500/15 text-red-400 border-red-500/20' },
    offline: { label: 'Offline', icon: <AlertTriangle className="h-3.5 w-3.5" />, cls: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20' },
  };
  const { label, icon, cls } = map[status] ?? map.offline;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${cls}`}>
      {icon}
      {label}
    </span>
  );
}

// ─── Status icon for file table ────────────────────────────────────────────────

function FileStatusIcon({ status }: { status: WorkFolderFileRow['status'] }) {
  const map: Record<WorkFolderFileRow['status'], { icon: React.ReactNode; cls: string }> = {
    synced:   { icon: <CheckCircle2 className="h-4 w-4" />, cls: 'text-emerald-400' },
    syncing:  { icon: <Upload className="h-4 w-4 animate-pulse" />, cls: 'text-blue-400' },
    pending:  { icon: <Clock className="h-4 w-4" />, cls: 'text-amber-400' },
    failed:   { icon: <XCircle className="h-4 w-4" />, cls: 'text-red-400' },
    archived: { icon: <Archive className="h-4 w-4" />, cls: 'text-muted-foreground' },
  };
  const { icon, cls } = map[status] ?? map.pending;
  return <span className={cls} title={status}>{icon}</span>;
}

// ─── File Row ─────────────────────────────────────────────────────────────────

function FileRow({
  file,
  localStatus,
  onRetry,
  onDownload,
}: {
  file: WorkFolderFileRow;
  localStatus?: { status: 'syncing' | 'pending'; progress?: number };
  onRetry?: () => void;
  onDownload?: (storageKey: string) => void;
}) {
  const relTime = (() => {
    if (!file.last_synced_at) return '—';
    const diffMs = new Date(file.last_synced_at).getTime() - Date.now();
    const fmt = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    const diffMins = diffMs / 60000;
    if (Math.abs(diffMins) < 60) return fmt.format(Math.round(diffMins), 'minute');
    const diffHrs = diffMins / 60;
    if (Math.abs(diffHrs) < 24) return fmt.format(Math.round(diffHrs), 'hour');
    return fmt.format(Math.round(diffHrs / 24), 'day');
  })();

  const displayStatus = localStatus?.status ?? file.status;
  const progress = localStatus?.progress;

  return (
    <div className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/30 transition-colors group">
      <FileStatusIcon status={displayStatus} />
      <div className="min-w-0">
        <p className="text-sm font-medium truncate text-foreground">{file.file_name}</p>
        <p className="text-xs text-muted-foreground truncate">{file.relative_path}</p>
        {displayStatus === 'syncing' && (
          <div className="mt-1 h-1 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: progress != null ? `${progress}%` : '40%' }}
            />
          </div>
        )}
        {file.error_message && displayStatus === 'failed' && (
          <p className="text-xs text-red-400 truncate mt-0.5">{file.error_message}</p>
        )}
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {file.file_size_bytes ? formatBytes(file.file_size_bytes) : '—'}
      </span>
      <span className="text-xs text-muted-foreground whitespace-nowrap hidden sm:block">
        {relTime}
      </span>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {file.status === 'failed' && onRetry && (
          <button
            onClick={() => onRetry()}
            className="p-1 rounded text-muted-foreground hover:text-primary transition-colors"
            title="Retry"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        )}
        {file.status === 'synced' && onDownload && (
          <button
            onClick={() => onDownload(file.storage_key)}
            className="p-1 rounded text-muted-foreground hover:text-primary transition-colors"
            title="Download"
          >
            <FolderOpen className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function WorkFolderSettings({
  syncStatus,
  watcherRunning,
  isConfigured,
  folderPath,
  failedCount,
  localStatuses,
  onRetryAll,
  onOpenFolder,
  onChangeLocation,
  onRemoveSync,
}: WorkFolderSettingsProps) {
  const [filter, setFilter] = useState<FilterTab>('all');
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  const { data: files = [], isLoading: filesLoading } = useWorkFolderFiles();
  const { data: usage = 0, isLoading: usageLoading } = useWorkFolderUsage();
  const { data: config } = useWorkFolderConfig();
  const signedUrlMutation = useWorkFolderSignedUrl();

  const handleDownload = useCallback(
    async (storageKey: string) => {
      try {
        const url = await signedUrlMutation.mutateAsync(storageKey);
        window.open(url, '_blank', 'noopener,noreferrer');
      } catch {
        // error handled in mutation's onError
      }
    },
    [signedUrlMutation],
  );

  const handleRemoveSync = useCallback(() => {
    onRemoveSync();
    setShowRemoveConfirm(false);
    toast.success('Work folder sync removed. Your cloud files are intact.');
  }, [onRemoveSync]);

  // ── Filter files ───────────────────────────────────────────────────────────

  const filteredFiles = files.filter((f) => {
    if (filter === 'failed') return f.status === 'failed';
    if (filter === 'archived') return f.status === 'archived';
    return true;
  });

  // ── Not configured state ───────────────────────────────────────────────────

  if (!isConfigured) {
    return (
      <SettingsSection
        id="work-folder-settings"
        title="Work Folder"
        description="Automatic file backup to company storage"
        icon={<Folder className="h-5 w-5" />}
      >
        <div className="py-6 text-center">
          <Folder className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Work folder is not configured.</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Restart the app to run the setup flow.</p>
        </div>
      </SettingsSection>
    );
  }

  // ── Watcher offline warning ────────────────────────────────────────────────

  return (
    <SettingsSection
      id="work-folder-settings"
      title="Work Folder"
      description="Automatic file backup to company storage"
      icon={<Folder className="h-5 w-5" />}
    >
      {/* Watcher offline banner */}
      {!watcherRunning && (
        <div className="flex gap-2.5 items-start p-3 rounded-xl bg-red-500/10 border border-red-500/20 mb-2">
          <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-300">
            File watcher is not running. The work folder may have been moved or deleted.
            <button onClick={onChangeLocation} className="ml-1 underline hover:no-underline">
              Relocate folder
            </button>
          </p>
        </div>
      )}

      {/* ── Status section ─────────────────────────────────────────────── */}
      <div className="space-y-3 mb-4">
        <SettingsRow label="Sync Status">
          <SyncStatusBadge status={syncStatus} />
        </SettingsRow>

        <SettingsRow label="Folder Path" description={folderPath ?? undefined}>
          <button
            id="work-folder-open"
            onClick={onOpenFolder}
            className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
          >
            <FolderOpen className="h-4 w-4" />
            Open
          </button>
        </SettingsRow>

        <SettingsRow label="Storage Used">
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            {usageLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <HardDrive className="h-3.5 w-3.5" />
                {formatBytes(usage)}
              </>
            )}
          </span>
        </SettingsRow>

        {config?.last_watcher_start && (
          <SettingsRow label="Last Active">
            <span className="text-sm text-muted-foreground">
              {new Date(config.last_watcher_start).toLocaleString()}
            </span>
          </SettingsRow>
        )}
      </div>

      {/* ── File List ──────────────────────────────────────────────────── */}
      <div className="border border-border rounded-xl overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/20">
          <div className="flex gap-1">
            {(['all', 'failed', 'archived'] as FilterTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-colors ${
                  filter === tab
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab}
                {tab === 'failed' && failedCount > 0 && (
                  <span className="ml-1.5 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {failedCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {failedCount > 0 && (
            <button
              id="work-folder-retry-all"
              onClick={onRetryAll}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              Retry All Failed
            </button>
          )}
        </div>

        {/* File rows */}
        <div className="max-h-72 overflow-y-auto">
          {filesLoading ? (
            <div className="py-8 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {filter === 'all' ? 'No files synced yet.' : `No ${filter} files.`}
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {filteredFiles.map((file) => (
                <FileRow
                  key={file.id}
                  file={file}
                  localStatus={localStatuses?.get(file.relative_path)}
                  onRetry={() => onRetryAll()}
                  onDownload={handleDownload}
                />
              ))}
            </div>
          )}
        </div>

        <div className="px-3 py-2 border-t border-border bg-muted/20 text-xs text-muted-foreground">
          {files.length} file{files.length !== 1 ? 's' : ''} total
        </div>
      </div>

      {/* ── Folder Management ──────────────────────────────────────────── */}
      <div className="mt-4 pt-4 border-t border-border space-y-2">
        <Button
          id="work-folder-change-location"
          variant="outline"
          size="sm"
          className="w-full justify-start"
          onClick={onChangeLocation}
        >
          <Folder className="h-4 w-4 mr-2" />
          Change Work Folder Location
        </Button>

        {/* Danger zone */}
        {!showRemoveConfirm ? (
          <button
            id="work-folder-remove-sync"
            onClick={() => setShowRemoveConfirm(true)}
            className="w-full text-left text-xs text-red-400/70 hover:text-red-400 transition-colors py-1 px-1"
          >
            Remove Work Folder Sync…
          </button>
        ) : (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 space-y-2">
            <p className="text-xs text-red-300">
              This will stop the watcher and remove local config. Your cloud files are <strong>not</strong> deleted.
            </p>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                size="sm"
                className="flex-1"
                onClick={handleRemoveSync}
              >
                Remove Sync
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setShowRemoveConfirm(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </SettingsSection>
  );
}
