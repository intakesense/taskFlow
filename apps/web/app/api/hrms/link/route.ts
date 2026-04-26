import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';

const HRMS_BASE = 'https://hrms-backend.up.railway.app/api';

export async function POST(req: NextRequest) {
  const { supabase, user, error } = await createClientFromRequest(req);
  if (error) return NextResponse.json({ error }, { status: 401 });

  const { email, password } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
  }

  // Authenticate against HRMS
  let hrmsRes: Response;
  try {
    hrmsRes = await fetch(`${HRMS_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    return NextResponse.json({ error: 'Could not reach HRMS server' }, { status: 502 });
  }

  const hrmsData = await hrmsRes.json();

  if (!hrmsRes.ok || !hrmsData.token) {
    return NextResponse.json(
      { error: hrmsData.message || 'Invalid HRMS credentials' },
      { status: 400 }
    );
  }

  const { token } = hrmsData;

  // HRMS login returns only { token } — decode the JWT payload for user info
  // Payload shape: { userId, name, email, role, employee, employeeId, exp }
  let payload: Record<string, unknown> = {};
  let expiresAt: string | null = null;
  try {
    payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    if (payload.exp) {
      expiresAt = new Date((payload.exp as number) * 1000).toISOString();
    }
  } catch { /* non-fatal */ }

  const employeeName = (payload.name as string) || '';
  const employeeId  = (payload.employeeId as string) || '';
  const hrmsUserId  = (payload.userId as string) || '';

  const { error: upsertError } = await supabase.from('hrms_links').upsert(
    {
      user_id: user!.id,
      hrms_user_id: hrmsUserId,
      hrms_employee_id: employeeId,
      hrms_employee_name: employeeName,
      hrms_token: token,
      hrms_token_expires_at: expiresAt,
      linked_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (upsertError) {
    return NextResponse.json({ error: 'Failed to save link' }, { status: 500 });
  }

  return NextResponse.json({
    linked: true,
    employee: { name: employeeName, employeeId },
  });
}

export async function DELETE(req: NextRequest) {
  const { supabase, user, error } = await createClientFromRequest(req);
  if (error) return NextResponse.json({ error }, { status: 401 });

  await supabase.from('hrms_links').delete().eq('user_id', user!.id);

  return NextResponse.json({ unlinked: true });
}
