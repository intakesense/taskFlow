'use client'

import { useState, useRef, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Send,
  ArrowLeft,
  MoreVertical,
  CheckCircle2,
  Clock,
  Pause,
  Trash2,
  Calendar,
  Flag,
  Eye,
  User,
  Paperclip,
  MessageCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { formatMessageTime } from '@/lib/utils/date'
import type { TaskWithUsers, TaskMessageWithSender } from '@/lib/types'

const messageSchema = z.object({
  content: z.string().min(1, 'Message cannot be empty'),
})

type MessageFormData = z.infer<typeof messageSchema>

interface TaskDetailChatViewProps {
  task: TaskWithUsers
  messages: TaskMessageWithSender[]
  currentUserId: string
  onSendMessage: (content: string) => Promise<void>
  onStatusChange: (status: string, reason?: string) => Promise<void>
  onDelete: () => Promise<void>
  isLoadingMessages?: boolean
}

export function TaskDetailChatView({
  task,
  messages,
  currentUserId,
  onSendMessage,
  onStatusChange,
  onDelete,
  isLoadingMessages,
}: TaskDetailChatViewProps) {
  const router = useRouter()
  const [showOnHoldDialog, setShowOnHoldDialog] = useState(false)
  const [onHoldReason, setOnHoldReason] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { isSubmitting },
  } = useForm<MessageFormData>({
    resolver: zodResolver(messageSchema),
  })

  const messageContent = watch('content')

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const onSubmit = async (data: MessageFormData) => {
    try {
      await onSendMessage(data.content)
      reset()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send message'
      toast.error(message)
    }
  }

  const handleStatusChange = async (status: string) => {
    if (status === 'on_hold') {
      setShowOnHoldDialog(true)
      return
    }

    try {
      await onStatusChange(status)
      toast.success('Task status updated')
    } catch (error) {
      toast.error('Failed to update status')
    }
  }

  const handleOnHoldSubmit = async () => {
    try {
      await onStatusChange('on_hold', onHoldReason)
      setShowOnHoldDialog(false)
      setOnHoldReason('')
      toast.success('Task put on hold')
    } catch (error) {
      toast.error('Failed to update status')
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this task?')) return

    try {
      await onDelete()
      toast.success('Task deleted')
      router.push('/tasks')
    } catch (error) {
      toast.error('Failed to delete task')
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const getPriorityColor = (priority: string) => {
    const colors = {
      low: 'bg-blue-500',
      medium: 'bg-yellow-500',
      high: 'bg-orange-500',
      urgent: 'bg-red-500',
    }
    return colors[priority as keyof typeof colors] || 'bg-gray-500'
  }

  const getStatusInfo = (status: string) => {
    const info = {
      pending: { label: 'Not Started', color: 'text-muted-foreground', bgColor: 'bg-muted' },
      in_progress: { label: 'In Progress', color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
      on_hold: { label: 'On Hold', color: 'text-yellow-500', bgColor: 'bg-yellow-500/10' },
      archived: { label: 'Completed', color: 'text-green-500', bgColor: 'bg-green-500/10' },
    }
    return info[status as keyof typeof info] || info.pending
  }

  const statusInfo = getStatusInfo(task.status)
  const isAssignedToMe = currentUserId === task.assigned_to
  const isAssignedByMe = currentUserId === task.assigned_by
  const canChangeStatus = isAssignedToMe
  const canDelete = isAssignedByMe

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header - WhatsApp Style */}
      <div className="flex-shrink-0 px-4 py-3 border-b bg-card sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary text-primary-foreground text-sm font-medium">
              {task.assignee ? getInitials(task.assignee.name) : '?'}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm truncate">
              {task.assignee?.name || 'Unassigned'}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {task.title}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {canChangeStatus && task.status !== 'archived' && (
                <>
                  {task.status === 'pending' && (
                    <DropdownMenuItem onClick={() => handleStatusChange('in_progress')}>
                      <Clock className="h-4 w-4 mr-2" />
                      Start Task
                    </DropdownMenuItem>
                  )}
                  {task.status === 'in_progress' && (
                    <>
                      <DropdownMenuItem onClick={() => handleStatusChange('on_hold')}>
                        <Pause className="h-4 w-4 mr-2" />
                        Put On Hold
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleStatusChange('archived')}>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Mark Complete
                      </DropdownMenuItem>
                    </>
                  )}
                  {task.status === 'on_hold' && (
                    <DropdownMenuItem onClick={() => handleStatusChange('in_progress')}>
                      <Clock className="h-4 w-4 mr-2" />
                      Resume Task
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                </>
              )}
              {canDelete && (
                <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Task
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Task Info Card - Collapsible */}
      <div className="flex-shrink-0 border-b bg-muted/30">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="font-semibold text-lg mb-2">{task.title}</h1>

              {/* Pills */}
              <div className="flex flex-wrap gap-2 mb-2">
                <div
                  className={cn(
                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs',
                    statusInfo.bgColor,
                    statusInfo.color
                  )}
                >
                  {statusInfo.label}
                </div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-background text-xs">
                  <span className={cn('w-2 h-2 rounded-full', getPriorityColor(task.priority))} />
                  <span className="capitalize">{task.priority}</span>
                </div>
                {task.deadline && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-background text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {formatMessageTime(task.deadline)}
                  </div>
                )}
              </div>

              {!isExpanded && task.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {task.description}
                </p>
              )}
            </div>
          </div>
        </button>

        {isExpanded && (
          <div className="px-4 pb-4 space-y-3">
            {task.description && (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1">Description</div>
                <p className="text-sm">{task.description}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1">Assigned by</div>
                <div className="flex items-center gap-2">
                  <User className="h-3 w-3" />
                  {task.assigner?.name || 'Unknown'}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1">Visibility</div>
                <div className="flex items-center gap-2">
                  <Eye className="h-3 w-3" />
                  <span className="capitalize">{task.visibility.replace('_', ' ')}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Messages Area - WhatsApp Style */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {isLoadingMessages ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No messages yet</p>
            <p className="text-xs">Start the conversation</p>
          </div>
        ) : (
          messages.map((message) => {
            const isMe = message.sender_id === currentUserId
            return (
              <div
                key={message.id}
                className={cn('flex gap-2', isMe ? 'flex-row-reverse' : 'flex-row')}
              >
                {!isMe && (
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarFallback className="bg-muted text-xs">
                      {getInitials(message.sender?.name || 'U')}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div
                  className={cn(
                    'max-w-[75%] rounded-2xl px-4 py-2',
                    isMe
                      ? 'bg-primary text-primary-foreground rounded-tr-sm'
                      : 'bg-muted rounded-tl-sm'
                  )}
                >
                  {!isMe && (
                    <div className="text-xs font-medium mb-1 opacity-70">
                      {message.sender?.name}
                    </div>
                  )}
                  <p className="text-sm whitespace-pre-wrap break-words">{message.message}</p>
                  <div
                    className={cn(
                      'text-[10px] mt-1',
                      isMe ? 'text-primary-foreground/70' : 'text-muted-foreground'
                    )}
                  >
                    {formatMessageTime(message.created_at)}
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions Bar - Only for assigned user */}
      {canChangeStatus && task.status !== 'archived' && (
        <div className="flex-shrink-0 px-4 py-2 border-t bg-muted/30">
          <div className="flex gap-2">
            {task.status === 'pending' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleStatusChange('in_progress')}
                className="flex-1 rounded-full"
              >
                <Clock className="h-4 w-4 mr-2" />
                Start
              </Button>
            )}
            {task.status === 'in_progress' && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleStatusChange('on_hold')}
                  className="flex-1 rounded-full"
                >
                  <Pause className="h-4 w-4 mr-2" />
                  Pause
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleStatusChange('archived')}
                  className="flex-1 rounded-full bg-green-500 hover:bg-green-600"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Complete
                </Button>
              </>
            )}
            {task.status === 'on_hold' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleStatusChange('in_progress')}
                className="flex-1 rounded-full"
              >
                <Clock className="h-4 w-4 mr-2" />
                Resume
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Message Input - WhatsApp Style */}
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex-shrink-0 px-4 py-3 border-t bg-card"
      >
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <Textarea
              {...register('content')}
              placeholder="Type a message..."
              className="min-h-[44px] max-h-[120px] resize-none rounded-3xl pr-12 py-3"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit(onSubmit)()
                }
              }}
            />
          </div>
          <Button
            type="submit"
            size="icon"
            disabled={isSubmitting || !messageContent?.trim()}
            className="h-11 w-11 rounded-full flex-shrink-0"
          >
            {isSubmitting ? (
              <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
      </form>

      {/* On Hold Dialog */}
      <Dialog open={showOnHoldDialog} onOpenChange={setShowOnHoldDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Put Task On Hold</DialogTitle>
            <DialogDescription>
              Please provide a reason for putting this task on hold.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <Textarea
                id="reason"
                value={onHoldReason}
                onChange={(e) => setOnHoldReason(e.target.value)}
                placeholder="Why is this task being put on hold?"
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOnHoldDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleOnHoldSubmit} disabled={!onHoldReason.trim()}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
