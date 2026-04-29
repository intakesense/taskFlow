import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_URL = 'https://api.resend.com/emails'

interface BasePayload {
  type: 'INSERT' | 'UPDATE'
  table: string
  record: Record<string, unknown>
  old_record?: Record<string, unknown>
  schema: 'public'
}

interface UserInfo {
  id: string
  name: string
  email: string
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// ─── Email Sender ──────────────────────────────────────────────────────────────

async function sendEmail(params: {
  to: string
  toName: string
  subject: string
  html: string
}): Promise<boolean> {
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  const fromEmail = Deno.env.get('EMAIL_FROM') || 'TaskFlow <notifications@taskflow.app>'

  if (!resendApiKey) {
    console.error('Missing RESEND_API_KEY')
    return false
  }

  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [`${params.toName} <${params.to}>`],
      subject: params.subject,
      html: params.html,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    console.error('Resend API error:', err)
  }

  return response.ok
}

// ─── Email Templates ───────────────────────────────────────────────────────────

function baseTemplate(content: string, previewText: string = '', appUrl: string = ''): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>TaskFlow</title>
</head>
<body style="margin:0;padding:0;background:#f6f6f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  ${previewText ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${previewText}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>` : ''}
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f7;padding:32px 0 40px;">
    <tr>
      <td align="center" style="padding:0 16px;">
        <table cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">

          <!-- Logo row -->
          <tr>
            <td style="padding:0 0 20px;">
              <img src="${appUrl}/logo.png" alt="TaskFlow" width="36" height="36" style="display:block;border-radius:8px;" />
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border-radius:8px;border:1px solid #e4e4e7;overflow:hidden;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:28px 28px 24px;">
                    ${content}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 4px 0;">
              <p style="margin:0;color:#a1a1aa;font-size:12px;line-height:1.6;">
                Sent by TaskFlow &middot; You're receiving this because you're involved in this task.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function taskAssignedTemplate(params: {
  recipientName: string
  assignerName: string
  taskTitle: string
  taskDescription: string
  priority: string
  deadline: string | null
  taskUrl: string
  appUrl: string
}): string {
  const priorityColors: Record<string, string> = {
    high: '#ef4444',
    medium: '#f59e0b',
    low: '#22c55e',
  }
  const priorityColor = priorityColors[params.priority] || '#71717a'

  const deadlineRow = params.deadline
    ? `<tr>
        <td style="padding:3px 0;color:#71717a;font-size:12px;width:72px;">Due</td>
        <td style="padding:3px 0;font-size:12px;font-weight:500;color:#18181b;">${new Date(params.deadline).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</td>
      </tr>`
    : ''

  const descriptionBlock = params.taskDescription
    ? `<p style="margin:6px 0 0;color:#52525b;font-size:13px;line-height:1.55;">${escapeHtml(params.taskDescription)}</p>`
    : ''

  return baseTemplate(`
    <p style="margin:0 0 16px;font-size:13px;color:#52525b;">
      <strong style="color:#18181b;">${escapeHtml(params.assignerName)}</strong> assigned you a task.
    </p>

    <h2 style="margin:0 0 16px;font-size:18px;font-weight:700;color:#18181b;line-height:1.3;">${escapeHtml(params.taskTitle)}</h2>

    ${descriptionBlock ? `${descriptionBlock}<div style="height:16px;"></div>` : ''}

    <table style="border-collapse:collapse;width:100%;margin-bottom:20px;">
      <tr>
        <td style="padding:8px 0;border-top:1px solid #f4f4f5;font-size:12px;color:#71717a;width:80px;">Priority</td>
        <td style="padding:8px 0;border-top:1px solid #f4f4f5;">
          <span style="display:inline-block;background:${priorityColor}15;color:${priorityColor};font-size:11px;font-weight:600;padding:2px 8px;border-radius:4px;text-transform:capitalize;">${params.priority}</span>
        </td>
      </tr>
      ${deadlineRow}
    </table>

    <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <tr>
        <td style="border-radius:6px;background:#18181b;">
          <a href="${params.taskUrl}" style="display:inline-block;color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:10px 20px;border-radius:6px;">View task</a>
        </td>
      </tr>
    </table>
  `, `${escapeHtml(params.assignerName)} assigned you "${escapeHtml(params.taskTitle)}"`, params.appUrl)
}

function taskStatusChangedTemplate(params: {
  recipientName: string
  taskTitle: string
  oldStatus: string
  newStatus: string
  onHoldReason: string | null
  taskUrl: string
  appUrl: string
}): string {
  const statusLabels: Record<string, string> = {
    pending: 'Pending',
    in_progress: 'In Progress',
    on_hold: 'On Hold',
    completed: 'Completed',
    archived: 'Archived',
  }

  const statusColors: Record<string, string> = {
    pending: '#71717a',
    in_progress: '#3b82f6',
    on_hold: '#f59e0b',
    completed: '#22c55e',
    archived: '#a1a1aa',
  }

  const newLabel = statusLabels[params.newStatus] || params.newStatus
  const newColor = statusColors[params.newStatus] || '#71717a'
  const oldLabel = statusLabels[params.oldStatus] || params.oldStatus

  const reasonBlock = params.onHoldReason
    ? `<div style="padding:10px 14px;background:#fffbeb;border-left:3px solid #f59e0b;border-radius:0 4px 4px 0;margin-bottom:4px;">
        <p style="margin:0;font-size:12px;color:#92400e;line-height:1.5;"><strong>Reason:</strong> ${escapeHtml(params.onHoldReason!)}</p>
      </div>`
    : ''

  const isCompleted = params.newStatus === 'completed'
  const headline = isCompleted
    ? `"${escapeHtml(params.taskTitle)}" was completed`
    : `"${escapeHtml(params.taskTitle)}" is now ${newLabel}`

  return baseTemplate(`
    <h2 style="margin:0 0 6px;font-size:18px;font-weight:700;color:#18181b;line-height:1.3;">${headline}</h2>
    <p style="margin:0 0 20px;font-size:13px;color:#71717a;">A task you're involved in was updated.</p>

    <table style="border-collapse:collapse;width:100%;margin-bottom:20px;">
      <tr>
        <td style="padding:8px 0;border-top:1px solid #f4f4f5;font-size:12px;color:#71717a;width:80px;">Status</td>
        <td style="padding:8px 0;border-top:1px solid #f4f4f5;">
          <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            <tr>
              <td style="font-size:12px;color:#71717a;">${oldLabel}</td>
              <td style="font-size:12px;color:#d4d4d8;padding:0 8px;">&#8594;</td>
              <td><span style="display:inline-block;background:${newColor}15;color:${newColor};font-size:11px;font-weight:600;padding:2px 8px;border-radius:4px;">${newLabel}</span></td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    ${reasonBlock}
    ${reasonBlock ? '<div style="height:16px;"></div>' : ''}

    <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <tr>
        <td style="border-radius:6px;background:#18181b;">
          <a href="${params.taskUrl}" style="display:inline-block;color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:10px 20px;border-radius:6px;">View task</a>
        </td>
      </tr>
    </table>
  `, `"${escapeHtml(params.taskTitle)}" is now ${newLabel}`, params.appUrl)
}

function taskOverdueTemplate(params: {
  recipientName: string
  taskTitle: string
  deadline: string
  taskUrl: string
  appUrl: string
}): string {
  const deadlineDate = new Date(params.deadline)
  const now = new Date()
  const daysOverdue = Math.floor((now.getTime() - deadlineDate.getTime()) / (1000 * 60 * 60 * 24))

  const overdueText = daysOverdue === 0
    ? 'due today'
    : daysOverdue === 1
    ? '1 day overdue'
    : `${daysOverdue} days overdue`

  return baseTemplate(`
    <h2 style="margin:0 0 6px;font-size:18px;font-weight:700;color:#18181b;line-height:1.3;">"${escapeHtml(params.taskTitle)}" is overdue</h2>
    <p style="margin:0 0 20px;font-size:13px;color:#71717a;">
      This task was due ${deadlineDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} — ${overdueText}.
    </p>

    <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <tr>
        <td style="border-radius:6px;background:#18181b;">
          <a href="${params.taskUrl}" style="display:inline-block;color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:10px 20px;border-radius:6px;">View task</a>
        </td>
      </tr>
    </table>
  `, `"${escapeHtml(params.taskTitle)}" — ${overdueText}`, params.appUrl)
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function getUserInfo(supabase: ReturnType<typeof createClient>, userId: string): Promise<UserInfo | null> {
  const { data } = await supabase
    .from('users')
    .select('id, name, email')
    .eq('id', userId)
    .single()
  return data as UserInfo | null
}

async function getTaskAssigneeEmails(supabase: ReturnType<typeof createClient>, taskId: string): Promise<UserInfo[]> {
  const { data } = await supabase
    .from('task_assignees')
    .select('user:users!task_assignees_user_id_fkey(id, name, email)')
    .eq('task_id', taskId)

  return (data || [])
    .map((row) => row.user as unknown as UserInfo)
    .filter(Boolean)
}

function getAppUrl(): string {
  return Deno.env.get('APP_URL') || Deno.env.get('NEXT_PUBLIC_APP_URL') || 'http://localhost:3000'
}

// ─── Main Handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const raw = await req.text()
    console.log('[notify-email] raw payload:', raw)
    const payload: BasePayload = JSON.parse(raw)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const appUrl = getAppUrl()
    const results: { email: string; ok: boolean }[] = []

    // ── Task assigned (INSERT on task_assignees) ───────────────────────────────
    if (payload.table === 'task_assignees' && payload.type === 'INSERT') {
      const record = payload.record as { task_id: string; user_id: string }

      const [task, assignee] = await Promise.all([
        supabase
          .from('tasks')
          .select('id, title, description, priority, deadline, assigned_by')
          .eq('id', record.task_id)
          .single(),
        getUserInfo(supabase, record.user_id),
      ])

      const taskData = task.data
      if (!taskData || !assignee?.email) {
        return new Response(JSON.stringify({ message: 'Task or assignee not found' }), { status: 200 })
      }

      const assigner = taskData.assigned_by
        ? await getUserInfo(supabase, taskData.assigned_by)
        : null

      const ok = await sendEmail({
        to: assignee.email,
        toName: assignee.name,
        subject: `New task: ${taskData.title}`,
        html: taskAssignedTemplate({
          recipientName: assignee.name,
          assignerName: assigner?.name || 'Someone',
          taskTitle: taskData.title,
          taskDescription: taskData.description || '',
          priority: taskData.priority || 'medium',
          deadline: taskData.deadline || null,
          taskUrl: `${appUrl}/tasks/${taskData.id}`,
          appUrl,
        }),
      })

      results.push({ email: assignee.email, ok })
    }

    // ── Task status changed (UPDATE on tasks) ─────────────────────────────────
    else if (payload.table === 'tasks' && payload.type === 'UPDATE') {
      const record = payload.record as {
        id: string
        title: string
        status: string
        assigned_by: string
        on_hold_reason?: string | null
      }
      const oldRecord = payload.old_record as { status: string } | undefined

      if (!oldRecord || oldRecord.status === record.status) {
        return new Response(JSON.stringify({ message: 'No status change' }), { status: 200 })
      }

      // Only email for meaningful transitions
      const emailableTransitions = new Set([
        'pending:in_progress',
        'in_progress:on_hold',
        'in_progress:completed',
        'in_progress:archived',
        'on_hold:in_progress',
        'completed:archived',
        'archived:in_progress',
      ])

      const transition = `${oldRecord.status}:${record.status}`
      if (!emailableTransitions.has(transition)) {
        return new Response(JSON.stringify({ message: `Transition ${transition} not emailed` }), { status: 200 })
      }

      const [assignees, creator] = await Promise.all([
        getTaskAssigneeEmails(supabase, record.id),
        getUserInfo(supabase, record.assigned_by),
      ])

      // Notify everyone involved
      const recipients = new Map<string, UserInfo>()
      assignees.forEach((u) => recipients.set(u.id, u))
      if (creator) recipients.set(creator.id, creator)

      const emailPromises = [...recipients.values()].map((recipient) =>
        sendEmail({
          to: recipient.email,
          toName: recipient.name,
          subject: record.status === 'completed'
            ? `Task completed: ${record.title}`
            : record.status === 'archived'
            ? `Task archived: ${record.title}`
            : `Task updated: ${record.title}`,
          html: taskStatusChangedTemplate({
            recipientName: recipient.name,
            taskTitle: record.title,
            oldStatus: oldRecord.status,
            newStatus: record.status,
            onHoldReason: record.on_hold_reason || null,
            taskUrl: `${appUrl}/tasks/${record.id}`,
            appUrl,
          }),
        }).then((ok) => ({ email: recipient.email, ok }))
      )

      results.push(...(await Promise.all(emailPromises)))
    }

    // ── Task overdue check (called via cron/scheduled trigger) ─────────────────
    // Payload: { type: 'INSERT', table: 'cron_trigger', record: { event: 'overdue_check' } }
    else if (
      payload.table === 'cron_trigger' ||
      (payload.record as Record<string, unknown>)?.event === 'overdue_check'
    ) {
      const now = new Date().toISOString()

      const { data: overdueTasks } = await supabase
        .from('tasks')
        .select('id, title, deadline, assigned_by')
        .lt('deadline', now)
        .in('status', ['pending', 'in_progress', 'on_hold'])

      if (!overdueTasks || overdueTasks.length === 0) {
        return new Response(JSON.stringify({ message: 'No overdue tasks' }), { status: 200 })
      }

      for (const task of overdueTasks) {
        const assignees = await getTaskAssigneeEmails(supabase, task.id)

        const emailPromises = assignees.map((assignee) =>
          sendEmail({
            to: assignee.email,
            toName: assignee.name,
            subject: `Overdue task: ${task.title}`,
            html: taskOverdueTemplate({
              recipientName: assignee.name,
              taskTitle: task.title,
              deadline: task.deadline,
              taskUrl: `${appUrl}/tasks/${task.id}`,
              appUrl,
            }),
          }).then((ok) => ({ email: assignee.email, ok }))
        )

        results.push(...(await Promise.all(emailPromises)))
      }
    }

    else {
      return new Response(JSON.stringify({ message: 'Ignored' }), { status: 200 })
    }

    const sent = results.filter((r) => r.ok).length
    console.log(`Emails sent: ${sent}/${results.length}`)

    return new Response(
      JSON.stringify({ success: true, sent, total: results.length, results }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Email notification error:', error)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
