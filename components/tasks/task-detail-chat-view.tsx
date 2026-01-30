'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { m, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  ArrowLeft,
  MoreVertical,
  CheckCircle2,
  Clock,
  Pause,
  Trash2,
  Calendar,
  Eye,
  User,
  MessageCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { handleError } from '@/lib/utils/error'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { StackedAvatars } from './stacked-avatars'
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
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { formatMessageTime } from '@/lib/utils/date'
import { listContainerVariants } from '@/lib/animations'
import { ChatBubble, ChatInput } from '@/components/chat'
import type { ChatMessage } from '@/components/chat'
import type { TaskWithUsers, TaskMessageWithSender, UserBasic } from '@/lib/types'
import { groupTaskReactions, getUserTaskReaction } from '@/hooks/use-task-messages'

interface TaskDetailChatViewProps {
  task: TaskWithUsers
  messages: TaskMessageWithSender[]
  currentUserId: string
  currentUser?: UserBasic | null
  onSendMessage: (params: {
    content?: string
    fileUrl?: string
    fileName?: string
    fileSize?: number
    fileType?: string
    replyToId?: string
  }) => Promise<void>
  onStatusChange: (status: string, reason?: string) => Promise<void>
  onDelete: () => Promise<void>
  onReact?: (messageId: string, emoji: string, currentEmoji?: string) => Promise<void>
  isLoadingMessages?: boolean
  isSending?: boolean
}

export function TaskDetailChatView({
  task,
  messages,
  currentUserId,
  currentUser,
  onSendMessage,
  onStatusChange,
  onDelete,
  onReact,
  isLoadingMessages,
  isSending,
}: TaskDetailChatViewProps) {
  const router = useRouter()
  const prefersReducedMotion = useReducedMotion()
  const [showOnHoldDialog, setShowOnHoldDialog] = useState(false)
  const [onHoldReason, setOnHoldReason] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [replyingTo, setReplyingTo] = useState<{
    id: string
    senderName: string
    content: string | null
    fileName?: string | null
  } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = useCallback(async () => {
    if (!inputValue.trim()) return

    try {
      await onSendMessage({
        content: inputValue.trim(),
        replyToId: replyingTo?.id,
      })
      setInputValue('')
      setReplyingTo(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send message'
      toast.error(message)
    }
  }, [inputValue, replyingTo, onSendMessage])

  const handleStatusChange = async (status: string) => {
    if (status === 'on_hold') {
      setShowOnHoldDialog(true)
      return
    }

    try {
      await onStatusChange(status)
      toast.success('Task status updated')
    } catch (error) {
      const message = handleError('handleStatusChange', error, 'Failed to update status')
      toast.error(message)
    }
  }

  const handleOnHoldSubmit = async () => {
    try {
      await onStatusChange('on_hold', onHoldReason)
      setShowOnHoldDialog(false)
      setOnHoldReason('')
      toast.success('Task put on hold')
    } catch (error) {
      const message = handleError('handleOnHoldSubmit', error, 'Failed to update status')
      toast.error(message)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this task?')) return

    try {
      await onDelete()
      toast.success('Task deleted')
      router.push('/tasks')
    } catch (error) {
      const message = handleError('handleDelete', error, 'Failed to delete task')
      toast.error(message)
    }
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
  const isAssignedToMe = task.assignees?.some(a => a.id === currentUserId) || false
  const isAssignedByMe = currentUserId === task.assigned_by
  const isParticipant = isAssignedToMe || isAssignedByMe
  const canChangeStatus = isAssignedToMe
  const canDelete = isAssignedByMe
  const isGroupTask = (task.assignees?.length || 0) > 1

  // Convert TaskMessageWithSender to ChatMessage format
  const convertToChatMessage = (msg: TaskMessageWithSender): ChatMessage => ({
    id: msg.id,
    content: msg.content || msg.message || null,
    created_at: msg.created_at,
    sender_id: msg.sender_id,
    sender: msg.sender,
    is_deleted: msg.is_deleted,
    file_url: msg.file_url,
    file_name: msg.file_name,
    file_size: msg.file_size,
    file_type: msg.file_type,
    reply_to_id: msg.reply_to_id,
    reactions: msg.reactions?.map(r => ({
      id: r.id,
      emoji: r.emoji,
      user_id: r.user_id,
      user: r.user,
    })),
  })

  const chatMessages: ChatMessage[] = messages.map(convertToChatMessage)

  // Determine which messages should show avatar/name (first in a sequence from same sender)
  const shouldShowAvatarForMessage = (index: number): boolean => {
    if (!isGroupTask) return false
    const message = messages[index]
    if (message.sender_id === currentUserId) return false
    const prevMessage = index > 0 ? messages[index - 1] : null
    return !prevMessage || prevMessage.sender_id !== message.sender_id
  }

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

          {task.assignees && task.assignees.length > 0 ? (
            <StackedAvatars users={task.assignees} max={3} size="md" showTooltip={false} />
          ) : (
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-muted text-muted-foreground text-sm font-medium">
                ?
              </AvatarFallback>
            </Avatar>
          )}

          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm truncate">
              {task.assignees?.length === 1
                ? task.assignees[0].name
                : task.assignees?.length
                  ? `${task.assignees.length} people`
                  : 'Unassigned'}
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

      {/* Messages Area - Using shared ChatBubble */}
      <m.div
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
        variants={prefersReducedMotion ? undefined : listContainerVariants}
        initial="initial"
        animate="animate"
      >
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
          <AnimatePresence mode="popLayout">
            {messages.map((message, index) => {
              const isMe = message.sender_id === currentUserId
              const showAvatar = shouldShowAvatarForMessage(index)
              const showSenderName = showAvatar
              const chatMessage = convertToChatMessage(message)
              const groupedReactions = groupTaskReactions(message.reactions, currentUserId)
              const userCurrentEmoji = getUserTaskReaction(message.reactions, currentUserId)

              return (
                <ChatBubble
                  key={message.id}
                  message={chatMessage}
                  allMessages={chatMessages}
                  isOwn={isMe}
                  currentUser={currentUser}
                  isGroupChat={isGroupTask}
                  showAvatar={showAvatar}
                  showSenderName={showSenderName}
                  groupedReactions={groupedReactions}
                  userCurrentEmoji={userCurrentEmoji}
                  onReact={onReact && isParticipant ? (emoji) => {
                    onReact(message.id, emoji, userCurrentEmoji)
                  } : undefined}
                  onReply={isParticipant ? () => {
                    setReplyingTo({
                      id: message.id,
                      senderName: message.sender?.name || 'Unknown',
                      content: message.content || message.message,
                      fileName: message.file_name,
                    })
                  } : undefined}
                  onCopy={() => {
                    const content = message.content || message.message
                    if (content) {
                      navigator.clipboard.writeText(content)
                      toast.success('Copied to clipboard')
                    }
                  }}
                />
              )
            })}
          </AnimatePresence>
        )}
        <div ref={messagesEndRef} />
      </m.div>

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

      {/* Message Input - Using shared ChatInput (only for participants) */}
      {isParticipant ? (
        <ChatInput
          value={inputValue}
          onChange={setInputValue}
          onSend={handleSend}
          placeholder="Type a message..."
          isSending={isSending}
          replyingTo={replyingTo}
          onCancelReply={() => setReplyingTo(null)}
          onEmojiSelect={(emoji) => setInputValue(prev => prev + emoji)}
        />
      ) : (
        <div className="flex-shrink-0 px-4 py-3 border-t bg-muted/30">
          <p className="text-center text-sm text-muted-foreground">
            Only task participants can send messages
          </p>
        </div>
      )}

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
