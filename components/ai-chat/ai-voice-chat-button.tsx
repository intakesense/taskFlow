'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Sparkles } from 'lucide-react'
import { haptics } from '@/lib/haptics'
import { AIVoiceChatModal } from './ai-voice-chat-modal'

/**
 * AI Voice Chat trigger button — renders as a normal icon button
 * meant to sit in the messages header, next to the "new chat" button.
 */
export function AIVoiceChatButton() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              id="ai-voice-chat-trigger"
              size="icon"
              variant="ghost"
              onClick={() => {
                haptics.medium()
                setIsOpen(true)
              }}
              aria-label="Talk to AI"
            >
              <Sparkles className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={4}>
            Talk to AI
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <AIVoiceChatModal
        open={isOpen}
        onOpenChange={setIsOpen}
      />
    </>
  )
}
