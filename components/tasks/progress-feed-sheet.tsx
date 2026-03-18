'use client'

import { useRouter } from 'next/navigation'
import { m, AnimatePresence } from 'framer-motion'
import { Bell, ClipboardList, Loader2, ExternalLink } from 'lucide-react'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { formatProgressTime, formatProgressDate, getDateKey } from '@/lib/utils/date'
import { useAllProgressFeed } from '@/hooks'
import type { ProgressUpdateWithTask } from '@/lib/types'

interface ProgressFeedSheetProps {
  trigger?: React.ReactNode
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
  in_progress: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
  on_hold: 'bg-muted text-muted-foreground',
  archived: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
}

function ProgressFeedItem({ update }: { update: ProgressUpdateWithTask }) {
  const router = useRouter()

  const handleClick = () => {
    router.push(`/tasks/${update.task.id}`)
  }

  return (
    <m.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={handleClick}
      className="w-full text-left p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
    >
      {/* Task info */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-medium truncate flex-1">
          {update.task.title}
        </span>
        <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', STATUS_COLORS[update.task.status])}>
          {update.task.status === 'in_progress' ? 'In Progress' :
           update.task.status === 'archived' ? 'Done' :
           update.task.status.charAt(0).toUpperCase() + update.task.status.slice(1)}
        </Badge>
        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      </div>

      {/* Progress update */}
      <div className="flex items-start gap-2">
        <Avatar className="h-6 w-6 shrink-0 mt-0.5">
          {update.sender?.avatar_url && (
            <AvatarImage src={update.sender.avatar_url} alt={update.sender?.name || 'User'} />
          )}
          <AvatarFallback className="text-[10px]">
            {update.sender?.name ? getInitials(update.sender.name) : '?'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-medium">
              {update.sender?.name || 'Unknown'}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {formatProgressTime(update.created_at)}
            </span>
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {update.content || update.message}
          </p>
        </div>
      </div>
    </m.button>
  )
}

function DateDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex-1 h-px bg-border" />
      <span className="text-[10px] font-semibold text-muted-foreground tracking-wider">
        {label}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <ClipboardList className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="font-medium text-lg mb-1">No progress updates yet</h3>
      <p className="text-sm text-muted-foreground max-w-[280px]">
        When team members post progress on tasks, updates will appear here.
      </p>
    </div>
  )
}

export function ProgressFeedSheet({ trigger }: ProgressFeedSheetProps) {
  const { data: updates = [], isLoading } = useAllProgressFeed()

  // Group updates by date
  const groupedUpdates = updates.reduce((acc, update) => {
    const dateKey = getDateKey(update.created_at)
    if (!acc[dateKey]) {
      acc[dateKey] = {
        label: formatProgressDate(update.created_at),
        items: [],
      }
    }
    acc[dateKey].items.push(update)
    return acc
  }, {} as Record<string, { label: string; items: ProgressUpdateWithTask[] }>)

  // Sort dates in reverse order (most recent first)
  const sortedDates = Object.keys(groupedUpdates).sort().reverse()

  return (
    <Sheet>
      <SheetTrigger asChild>
        {trigger || (
          <Button
            size="icon"
            variant="ghost"
            className="h-9 w-9 rounded-full"
          >
            <Bell className="h-5 w-5" />
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Progress Feed
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : updates.length === 0 ? (
            <EmptyState />
          ) : (
            <AnimatePresence initial={false}>
              {sortedDates.map((dateKey) => (
                <div key={dateKey}>
                  <DateDivider label={groupedUpdates[dateKey].label} />
                  <div className="space-y-2 pb-2">
                    {groupedUpdates[dateKey].items.map((update) => (
                      <ProgressFeedItem key={update.id} update={update} />
                    ))}
                  </div>
                </div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
