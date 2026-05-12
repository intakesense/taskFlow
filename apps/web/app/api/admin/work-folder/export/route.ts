import { NextRequest, NextResponse } from 'next/server'
import { createClientFromRequest } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import archiver from 'archiver'
import { PassThrough } from 'stream'
import { Readable } from 'stream'

// ─── POST /api/admin/work-folder/export ───────────────────────────────────────
//
// Body: { userId: string; includeArchived?: boolean }
//
// Streams files from Supabase Storage through archiver and returns a ZIP download.

export async function POST(req: NextRequest) {
  // Auth + admin check via existing pattern
  const { supabase, user, error } = await createClientFromRequest(req)
  if (error) return NextResponse.json({ error }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', user!.id)
    .single()

  if (!profile?.is_admin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  let userId: string
  let includeArchived = false

  try {
    const body = await req.json()
    userId = body.userId
    includeArchived = Boolean(body.includeArchived)
    if (!userId) throw new Error('Missing userId')
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // Use admin client to bypass RLS for storage access across all users
  const adminSupabase = createAdminClient()

  // Fetch file rows
  const statusFilter = includeArchived ? ['synced', 'archived'] : ['synced']

  const { data: files, error: dbError } = await adminSupabase
    .from('work_folder_files')
    .select('storage_key, relative_path, file_name, status')
    .eq('user_id', userId)
    .in('status', statusFilter)

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  if (!files || files.length === 0) {
    return NextResponse.json({ error: 'No files to export' }, { status: 404 })
  }

  // ── Stream ZIP via archiver ─────────────────────────────────────────────────

  const passThrough = new PassThrough()
  const archive = archiver('zip', { zlib: { level: 6 } })

  archive.on('error', (err) => {
    console.error('[WorkFolderExport] Archiver error:', err)
    passThrough.destroy(err)
  })

  archive.pipe(passThrough)

  // Async file fetching — kick off without blocking response stream
  void (async () => {
    for (const file of files) {
      try {
        const { data: blob, error: dlError } = await adminSupabase.storage
          .from('work-files')
          .download(file.storage_key)

        if (dlError || !blob) {
          console.warn(`[WorkFolderExport] Skipping ${file.storage_key}: ${dlError?.message ?? 'empty'}`)
          continue
        }

        const buffer = Buffer.from(await blob.arrayBuffer())
        const archivePath = file.relative_path ?? file.file_name
        archive.append(buffer, { name: archivePath })
      } catch (err) {
        console.warn(`[WorkFolderExport] Error adding ${file.storage_key}:`, err)
      }
    }
    await archive.finalize()
  })()

  // Bridge Node.js stream → Web ReadableStream for Next.js
  const webReadable = Readable.toWeb(passThrough) as ReadableStream

  return new NextResponse(webReadable, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="work-folder-${userId}.zip"`,
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-store',
    },
  })
}
