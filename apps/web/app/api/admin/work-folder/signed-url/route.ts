import { NextRequest, NextResponse } from 'next/server'
import { createClientFromRequest } from '@/lib/supabase/server'

/** POST /api/admin/work-folder/signed-url — body: { storageKey: string } */
export async function POST(req: NextRequest) {
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

  let storageKey: string
  try {
    const body = await req.json()
    storageKey = body.storageKey
    if (!storageKey) throw new Error('Missing storageKey')
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { data, error: signError } = await supabase.storage
    .from('work-files')
    .createSignedUrl(storageKey, 3600) // 1-hour expiry

  if (signError) {
    return NextResponse.json({ error: signError.message }, { status: 500 })
  }

  return NextResponse.json({ url: data.signedUrl })
}
