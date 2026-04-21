import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export async function GET() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: link } = await supabase
    .from('hrms_links')
    .select('hrms_employee_name, hrms_employee_id, hrms_token_expires_at, linked_at')
    .eq('user_id', user.id)
    .single();

  if (!link) {
    return NextResponse.json({ linked: false });
  }

  if (link.hrms_token_expires_at && new Date(link.hrms_token_expires_at) < new Date()) {
    return NextResponse.json({
      linked: true,
      tokenExpired: true,
      employee: { name: link.hrms_employee_name, employeeId: link.hrms_employee_id },
    });
  }

  return NextResponse.json({
    linked: true,
    tokenExpired: false,
    employee: { name: link.hrms_employee_name, employeeId: link.hrms_employee_id },
    linkedAt: link.linked_at,
  });
}
