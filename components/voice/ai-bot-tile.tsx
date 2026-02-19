'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Bot, MicOff, VideoOff } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AIBotTileProps {
  botName: string
  botAvatarUrl: string | null
  isMobile?: boolean
}

/**
 * Virtual participant tile for the AI bot
 * This is shown when the bot is in the channel (database) but not
 * connected via Daily.co (which requires server infrastructure)
 */
export function AIBotTile({ botName, botAvatarUrl, isMobile }: AIBotTileProps) {
  return (
    <div
      className={cn(
        'relative bg-muted rounded-xl overflow-hidden h-full w-full',
        'ring-1 ring-purple-500/50'
      )}
    >
      {/* Avatar display - bot has no video */}
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-purple-900/20 to-muted">
        <div className="flex flex-col items-center gap-2">
          <Avatar className={cn('h-20 w-20 ring-2 ring-purple-500', isMobile && 'h-16 w-16')}>
            {botAvatarUrl && <AvatarImage src={botAvatarUrl} alt={botName} />}
            <AvatarFallback className={cn(
              'text-2xl bg-purple-600 text-white',
              isMobile && 'text-xl'
            )}>
              <Bot className="h-8 w-8" />
            </AvatarFallback>
          </Avatar>
          <Badge
            variant="secondary"
            className="bg-purple-600/80 text-white border-0 text-xs"
          >
            Listening...
          </Badge>
        </div>
      </div>

      {/* Status bar */}
      <div className={cn(
        'absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent',
        isMobile ? 'p-2' : 'p-3'
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={cn(
              'text-white font-medium truncate',
              isMobile ? 'text-xs' : 'text-sm'
            )}>
              {botName}
            </span>
            <Badge
              variant="secondary"
              className={cn(
                'bg-purple-600 text-white border-0 flex-shrink-0',
                isMobile ? 'text-[10px] px-1 py-0' : 'text-xs px-1.5 py-0'
              )}
            >
              AI
            </Badge>
          </div>

          <div className="flex items-center gap-1.5">
            <VideoOff className={cn(isMobile ? 'h-3 w-3' : 'h-4 w-4', 'text-muted-foreground')} />
            <MicOff className={cn(isMobile ? 'h-3 w-3' : 'h-4 w-4', 'text-purple-400')} />
          </div>
        </div>
      </div>
    </div>
  )
}
