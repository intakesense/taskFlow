import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';

const HRMS_BASE = 'https://hrms-backend.up.railway.app/api';

export async function POST(req: NextRequest) {
  const { supabase, user, error } = await createClientFromRequest(req);
  if (error) return NextResponse.json({ error }, { status: 401 });

  const { data: link } = await supabase
    .from('hrms_links')
    .select('hrms_token, hrms_token_expires_at')
    .eq('user_id', user!.id)
    .single();

  if (!link) {
    return NextResponse.json({ error: 'HRMS account not linked' }, { status: 400 });
  }

  if (link.hrms_token_expires_at && new Date(link.hrms_token_expires_at) < new Date()) {
    return NextResponse.json({ error: 'HRMS session expired. Please re-link your account.' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { latitude, longitude, accuracy } = body;

  const payload: Record<string, unknown> = {
    capturedAt: new Date().toISOString(),
  };

  if (latitude != null && longitude != null) {
    payload.latitude = latitude;
    payload.longitude = longitude;
    if (accuracy != null) payload.accuracy = accuracy;
  }

  let hrmsRes: Response;
  try {
    hrmsRes = await fetch(`${HRMS_BASE}/attendance/checkin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${link.hrms_token}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    return NextResponse.json({ error: 'Could not reach HRMS server' }, { status: 502 });
  }

  const data = await hrmsRes.json();

  if (!hrmsRes.ok) {
    return NextResponse.json(
      { error: data.message || data.error || 'Check-in failed' },
      { status: hrmsRes.status }
    );
  }

  await supabase
    .from('hrms_links')
    .update({ last_checkin_at: new Date().toISOString() })
    .eq('user_id', user!.id);

  return NextResponse.json({ success: true, attendance: data.data?.attendance });
}
