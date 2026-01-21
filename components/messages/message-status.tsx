import { MessageWithSender, UserBasic, ConversationWithMembers } from '@/lib/types'
import { Check, CheckCheck } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/lib/utils/date'

interface MessageStatusProps {
  message: MessageWithSender
  conversation: ConversationWithMembers
  currentUserId: string
}

/**
 * MessageStatus - Visual read receipt indicators for messages
 *
 * Shows delivery and read status for sent messages:
 * - Single gray check: Delivered (sent successfully)
 * - Double gray check: Delivered to all recipients
 * - Double blue check: Read by all recipients
 *
 * In group chats, shows tooltip with who has read the message.
 */
export function MessageStatus({ message, conversation, currentUserId }: MessageStatusProps) {
  // Only show status for own messages
  if (message.sender_id !== currentUserId) return null

  const readBy = message.readBy || []
  const otherMembers = conversation.members.filter((m) => m.id !== currentUserId)

  // Don't show status for deleted messages
  if (message.is_deleted) return null

  // Determine status
  const isDelivered = true // All successfully sent messages are delivered
  const readCount = readBy.length
  const totalRecipients = otherMembers.length
  const isReadByAll = readCount === totalRecipients && totalRecipients > 0

  // Build read by text for tooltip
  const getReadByText = () => {
    if (readBy.length === 0) return 'Delivered'

    if (conversation.is_group) {
      if (isReadByAll) {
        return `Read by all ${totalRecipients} members`
      }
      const names = readBy.map((user) => user.name).join(', ')
      return `Read by: ${names}`
    }

    // Direct message
    return `Read by ${readBy[0]?.name || 'recipient'}`
  }

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center">
            {isReadByAll || (readCount > 0 && !conversation.is_group) ? (
              // Read by all (or read in DM)
              <CheckCheck
                className={cn('h-3 w-3', 'text-blue-500')}
                strokeWidth={2.5}
                aria-label="Read"
              />
            ) : readCount > 0 ? (
              // Partially read in group
              <CheckCheck
                className={cn('h-3 w-3', 'text-primary/60')}
                strokeWidth={2.5}
                aria-label="Partially read"
              />
            ) : isDelivered ? (
              // Delivered but not read
              <CheckCheck
                className={cn('h-3 w-3', 'text-muted-foreground/60')}
                strokeWidth={2.5}
                aria-label="Delivered"
              />
            ) : (
              // Sending (single check)
              <Check
                className={cn('h-3 w-3', 'text-muted-foreground/40')}
                strokeWidth={2.5}
                aria-label="Sending"
              />
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="text-xs space-y-1">
            <p className="font-medium">{getReadByText()}</p>
            {conversation.is_group && readCount > 0 && readCount < totalRecipients && (
              <p className="text-muted-foreground">
                {totalRecipients - readCount} not read yet
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
