import { MessageWithSender, ConversationWithMembers } from '@/lib/types'
import { CheckCheck } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface MessageStatusProps {
  message: MessageWithSender
  conversation: ConversationWithMembers
  currentUserId: string
}

/**
 * MessageStatus - Visual read receipt indicators for messages
 *
 * Shows delivery and read status based on last_read_at timestamps:
 * - Double gray check: Delivered (message sent successfully)
 * - Double blue check: Read (recipient's last_read_at is after message created_at)
 */
export function MessageStatus({ message, conversation, currentUserId }: MessageStatusProps) {
  // Only show status for own messages
  if (message.sender_id !== currentUserId) return null

  // Don't show status for deleted messages
  if (message.is_deleted) return null

  // Get members with read status from conversation
  const membersWithStatus = conversation.membersWithStatus || []

  // Find the other member(s) in the conversation (exclude current user)
  const otherMembersWithStatus = membersWithStatus.filter((m) => m.user.id !== currentUserId)

  // Check if any other member has read the message
  // For group chats: message is "read" if at least one other person has read it
  // For DMs: message is "read" if the other person has read it
  const isRead = otherMembersWithStatus.some((member) => {
    // Compare timestamps: message is read if last_read_at is after message created_at
    if (!member.last_read_at) return false
    return new Date(member.last_read_at).getTime() >= new Date(message.created_at).getTime()
  })

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center">
            {isRead ? (
              // Read (blue checks)
              <CheckCheck
                className={cn('h-3 w-3', 'text-blue-500')}
                strokeWidth={2.5}
                aria-label="Read"
              />
            ) : (
              // Delivered (gray checks)
              <CheckCheck
                className={cn('h-3 w-3', 'text-muted-foreground/60')}
                strokeWidth={2.5}
                aria-label="Delivered"
              />
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="text-xs">
            <p className="font-medium">{isRead ? 'Read' : 'Delivered'}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
