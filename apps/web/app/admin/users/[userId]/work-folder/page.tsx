'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout'
import { useAuth } from '@/lib/auth-context'
import { useAdminWorkFolderFiles, useAdminWorkFolderConfig, useWorkFolderSignedUrl, formatBytes } from '@taskflow/features'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ArrowLeft,
  HardDrive,
  Activity,
  Loader2,
  Download,
  FileArchive,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────────

type FileStatus = 'synced' | 'syncing' | 'pending' | 'failed' | 'archived'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string | null): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function StatusBadge({ status }: { status: FileStatus }) {
  const map: Record<FileStatus, { label: string; cls: string }> = {
    synced:   { label: 'Synced',   cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
    syncing:  { label: 'Syncing',  cls: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
    pending:  { label: 'Pending',  cls: 'bg-amber-500/15 text-amber-400 border-amber-500/20' },
    failed:   { label: 'Failed',   cls: 'bg-red-500/15 text-red-400 border-red-500/20' },
    archived: { label: 'Archived', cls: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20' },
  }
  const { label, cls } = map[status] ?? map.pending
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full border text-xs font-medium ${cls}`}>
      {label}
    </span>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface PageProps {
  params: { userId: string }
}

export default function AdminWorkFolderPage({ params }: PageProps) {
  const { userId } = params
  const { profile } = useAuth()
  const router = useRouter()

  // Redirect non-admins
  useEffect(() => {
    if (profile && !profile.is_admin) router.push('/tasks')
  }, [profile, router])

  // File list
  const { data: files = [], isLoading: filesLoading } = useAdminWorkFolderFiles(userId)

  // Config
  const { data: config, isLoading: configLoading } = useAdminWorkFolderConfig(userId)

  // Signed URL mutation
  const signedUrlMutation = useWorkFolderSignedUrl()

  const handleDownload = async (storageKey: string) => {
    try {
      const url = await signedUrlMutation.mutateAsync(storageKey)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      // error handled in mutation onError
    }
  }

  // Stats
  const syncedFiles = files.filter((f) => f.status === 'synced')
  const failedFiles = files.filter((f) => f.status === 'failed')
  const archivedFiles = files.filter((f) => f.status === 'archived')
  const totalBytes = syncedFiles.reduce((s, f) => s + (f.file_size_bytes ?? 0), 0)

  const healthStatus = !config
    ? 'Never set up'
    : failedFiles.length > 0
      ? 'Has failures'
      : !config.watcher_active
        ? 'Watcher offline'
        : 'Healthy'

  const healthClass =
    healthStatus === 'Healthy'
      ? 'text-emerald-400 border-emerald-500/30'
      : healthStatus === 'Has failures'
        ? 'text-red-400 border-red-500/30'
        : 'text-amber-400 border-amber-500/30'

  if (!profile?.is_admin) return null

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/admin/users">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <HardDrive className="h-6 w-6" />
              Work Folder
            </h1>
            <p className="text-sm text-muted-foreground font-mono">{userId}</p>
          </div>
        </div>

        {/* Overview cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card data-slot="card">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Total Files</p>
              <p className="text-2xl font-bold">{filesLoading ? '—' : files.length}</p>
            </CardContent>
          </Card>
          <Card data-slot="card">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Storage Used</p>
              <p className="text-2xl font-bold">{filesLoading ? '—' : formatBytes(totalBytes)}</p>
            </CardContent>
          </Card>
          <Card data-slot="card">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Last Activity</p>
              <p className="text-lg font-semibold">
                {configLoading ? '—' : relativeTime(config?.last_watcher_start ?? null)}
              </p>
            </CardContent>
          </Card>
          <Card data-slot="card">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Status</p>
              {configLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <Badge variant="outline" className={healthClass}>
                  {healthStatus}
                </Badge>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Config info */}
        {config && (
          <Card data-slot="card">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Folder Path</p>
                <p className="font-mono text-xs break-all">{config.folder_path}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Configured At</p>
                <p>{new Date(config.configured_at).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Watcher Active</p>
                <p>{config.watcher_active ? '✓ Yes' : '✗ No'}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* File browser */}
        <Card data-slot="card">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <CardTitle>File Browser</CardTitle>
                <CardDescription>
                  {syncedFiles.length} synced · {failedFiles.length} failed · {archivedFiles.length} archived
                </CardDescription>
              </div>
              <ExportButton userId={userId} />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {filesLoading ? (
              <div className="py-12 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Tabs defaultValue="all">
                <TabsList className="mx-4 mt-0 mb-3">
                  <TabsTrigger value="all">All ({files.length})</TabsTrigger>
                  <TabsTrigger value="synced">Synced ({syncedFiles.length})</TabsTrigger>
                  <TabsTrigger value="failed">Failed ({failedFiles.length})</TabsTrigger>
                  <TabsTrigger value="archived">Archived ({archivedFiles.length})</TabsTrigger>
                </TabsList>

                {(['all', 'synced', 'failed', 'archived'] as const).map((tab) => {
                  const tabFiles =
                    tab === 'all'
                      ? files
                      : files.filter((f) =>
                          tab === 'archived' ? f.status === 'archived' : f.status === tab,
                        )

                  return (
                    <TabsContent key={tab} value={tab} className="mt-0">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>File</TableHead>
                              <TableHead>Size</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Last Synced</TableHead>
                              <TableHead className="w-[60px]" />
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {tabFiles.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                                  No files in this category.
                                </TableCell>
                              </TableRow>
                            ) : (
                              tabFiles.map((file) => (
                                <TableRow key={file.id}>
                                  <TableCell>
                                    <div>
                                      <p className="font-medium text-sm">{file.file_name}</p>
                                      <p className="text-xs text-muted-foreground font-mono">
                                        {file.relative_path}
                                      </p>
                                      {file.error_message && (
                                        <p className="text-xs text-red-400 mt-0.5">{file.error_message}</p>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                    {file.file_size_bytes ? formatBytes(file.file_size_bytes) : '—'}
                                  </TableCell>
                                  <TableCell>
                                    <StatusBadge status={file.status as FileStatus} />
                                  </TableCell>
                                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                    {relativeTime(file.last_synced_at)}
                                  </TableCell>
                                  <TableCell>
                                    {(file.status === 'synced' || file.status === 'archived') && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => handleDownload(file.storage_key)}
                                        disabled={signedUrlMutation.isPending}
                                        title="Download"
                                      >
                                        <Download className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </TabsContent>
                  )
                })}
              </Tabs>
            )}
          </CardContent>
        </Card>

      </div>
    </DashboardLayout>
  )
}

// ─── Export button ─────────────────────────────────────────────────────────────

function ExportButton({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(false)
  const [includeArchived, setIncludeArchived] = useState(false)

  const handleExport = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/work-folder/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, includeArchived }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Export failed')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `work-folder-${userId}-${Date.now()}.zip`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
        <input
          type="checkbox"
          checked={includeArchived}
          onChange={(e) => setIncludeArchived(e.target.checked)}
          className="rounded"
        />
        Include archived
      </label>
      <Button
        id="work-folder-export-zip"
        variant="outline"
        size="sm"
        onClick={handleExport}
        disabled={loading}
        className="gap-2"
      >
        <FileArchive className="h-4 w-4" />
        {loading ? 'Exporting…' : 'Export ZIP'}
      </Button>
    </div>
  )
}
