import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';

const HRMS_BASE = 'https://hrms-backend.up.railway.app/api';

export async function GET(req: NextRequest) {
  const { supabase, user, error } = await createClientFromRequest(req);
  if (error) return NextResponse.json({ error }, { status: 401 });

  const { data: link } = await supabase
    .from('hrms_links')
    .select('hrms_token, hrms_token_expires_at')
    .eq('user_id', user!.id)
    .single();

  if (!link || (link.hrms_token_expires_at && new Date(link.hrms_token_expires_at) < new Date())) {
    return NextResponse.json({ attendance: null });
  }

  const today = new Date().toISOString().split('T')[0];
  try {
    const hrmsRes = await fetch(
      `${HRMS_BASE}/attendance/my?startDate=${today}&endDate=${today}&limit=1`,
      { headers: { Authorization: `Bearer ${link.hrms_token}` } }
    );

    if (!hrmsRes.ok) {
      return NextResponse.json({ attendance: null });
    }

    const data = await hrmsRes.json();
    return NextResponse.json({ attendance: data?.data?.records?.[0] || null });
  } catch {
    return NextResponse.json({ attendance: null });
  }
}
