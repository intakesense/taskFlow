'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { FileArchive, Download } from 'lucide-react'
import { toast } from 'sonner'

export function AdminDownloadButton({ storageKey }: { storageKey: string }) {
  const [loading, setLoading] = useState(false)

  const handleDownload = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/work-folder/signed-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storageKey }),
      })
      if (!res.ok) throw new Error('Failed to generate URL')
      const { url } = await res.json()
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      toast.error('Could not generate download link.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7"
      onClick={handleDownload}
      disabled={loading}
      title="Download file"
    >
      <Download className="h-3.5 w-3.5" />
    </Button>
  )
}

export function WorkFolderExportButton({
  userId,
}: {
  userId: string
}) {
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
      toast.error(e instanceof Error ? e.message : 'Export failed.')
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
