'use client'

import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ProfilePictureDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  avatarUrl?: string | null
  name: string
  email?: string
}

export function ProfilePictureDialog({
  open,
  onOpenChange,
  avatarUrl,
  name,
  email,
}: ProfilePictureDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-black/95 border-none">
        {/* Close button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onOpenChange(false)}
          className="absolute top-4 right-4 z-10 text-white hover:bg-white/20 rounded-full"
        >
          <X className="h-5 w-5" />
        </Button>

        {/* Profile info header */}
        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/60 to-transparent z-10">
          <h3 className="font-semibold text-white text-lg">{name}</h3>
          {email && <p className="text-sm text-white/80">{email}</p>}
        </div>

        {/* Image container */}
        <div className="flex items-center justify-center min-h-[400px] max-h-[600px] bg-black">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={name}
              className="w-full h-full object-contain"
            />
          ) : (
            <Avatar className="w-64 h-64">
              <AvatarFallback className="bg-primary text-primary-foreground text-6xl">
                {name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
