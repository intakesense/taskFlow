import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

const HRMS_BASE = 'https://hrms-backend.up.railway.app/api';

export async function GET() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: link } = await supabase
    .from('hrms_links')
    .select('hrms_token, hrms_token_expires_at')
    .eq('user_id', user.id)
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
