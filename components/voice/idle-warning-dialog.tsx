'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Clock, PhoneOff } from 'lucide-react'

interface IdleWarningDialogProps {
  open: boolean
  secondsRemaining: number
  onStayConnected: () => void
  onLeave: () => void
}

export function IdleWarningDialog({
  open,
  secondsRemaining,
  onStayConnected,
  onLeave,
}: IdleWarningDialogProps) {
  const minutes = Math.floor(secondsRemaining / 60)
  const seconds = secondsRemaining % 60

  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center">
            <Clock className="h-6 w-6 text-amber-500" />
          </div>
          <AlertDialogTitle className="text-center">
            Are you still there?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            You&apos;ve been idle for a while. The call will end automatically in{' '}
            <span className="font-mono font-semibold text-foreground">
              {minutes}:{seconds.toString().padStart(2, '0')}
            </span>{' '}
            to save resources.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
          <AlertDialogAction onClick={onStayConnected} className="w-full">
            Stay Connected
          </AlertDialogAction>
          <Button
            variant="ghost"
            onClick={onLeave}
            className="w-full gap-2 text-muted-foreground"
          >
            <PhoneOff className="h-4 w-4" />
            Leave Call
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
