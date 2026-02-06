'use client'

import { useState } from 'react'
import { Search, Check, ChevronRight } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useAssignableUsers } from '@/hooks/use-users'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'
import type { User } from '@/lib/types'

interface UserSelectorProps {
  selectedUserId: string | null
  onSelectUser: (userId: string | null) => void
}

export function UserSelector({ selectedUserId, onSelectUser }: UserSelectorProps) {
  const { effectiveUser } = useAuth()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const { data: users = [], isLoading } = useAssignableUsers(effectiveUser?.level)

  const selectedUser = users.find((u) => u.id === selectedUserId)

  // Filter users based on search - React Compiler optimizes this automatically
  const filteredUsers = !search.trim()
    ? users
    : users.filter(
        (user) =>
          user.name.toLowerCase().includes(search.toLowerCase()) ||
          user.email.toLowerCase().includes(search.toLowerCase())
      )

  const handleSelectUser = (user: User) => {
    onSelectUser(user.id)
    setOpen(false)
    setSearch('')
  }

  const handleClear = () => {
    onSelectUser(null)
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const getLevelBadgeColor = (level: number) => {
    const colors = [
      'bg-purple-500',
      'bg-blue-500',
      'bg-green-500',
      'bg-yellow-500',
      'bg-orange-500',
    ]
    return colors[Math.min(level - 1, colors.length - 1)] || 'bg-gray-500'
  }

  return (
    <>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all',
          'border bg-muted/50 hover:bg-muted',
          selectedUser && 'bg-primary/5 border-primary/20'
        )}
      >
        {selectedUser ? (
          <>
            <Avatar className="h-10 w-10">
              {selectedUser.avatar_url && (
                <AvatarImage src={selectedUser.avatar_url} alt={selectedUser.name} />
              )}
              <AvatarFallback className="bg-primary text-primary-foreground text-sm font-medium">
                {getInitials(selectedUser.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 text-left">
              <div className="font-medium">{selectedUser.name}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <span
                  className={cn(
                    'px-1.5 py-0.5 rounded text-white text-[10px] font-medium',
                    getLevelBadgeColor(selectedUser.level)
                  )}
                >
                  L{selectedUser.level}
                </span>
                {selectedUser.email}
              </div>
            </div>
            <span className="text-xs text-muted-foreground">
              Change
            </span>
          </>
        ) : (
          <>
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-muted">
                <Search className="h-5 w-5 text-muted-foreground" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 text-left">
              <div className="text-muted-foreground">Select a person</div>
              <div className="text-xs text-muted-foreground">Optional</div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </>
        )}
      </button>

      {/* Selection Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md p-0 gap-0 max-h-[80vh] flex flex-col">
          <DialogHeader className="px-4 pt-4 pb-3 border-b">
            <DialogTitle>Assign to</DialogTitle>
          </DialogHeader>

          {/* Search */}
          <div className="px-4 py-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search people..."
                className="pl-10 rounded-full"
                autoFocus
              />
            </div>
          </div>

          {/* User List */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">
                <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                Loading...
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                {search ? 'No people found' : 'No assignable users'}
              </div>
            ) : (
              <div className="divide-y">
                {filteredUsers.map((user) => {
                  const isSelected = user.id === selectedUserId
                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => handleSelectUser(user)}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted',
                        isSelected && 'bg-primary/5'
                      )}
                    >
                      <Avatar className="h-11 w-11">
                        {user.avatar_url && (
                          <AvatarImage src={user.avatar_url} alt={user.name} />
                        )}
                        <AvatarFallback
                          className={cn(
                            'text-sm font-medium',
                            isSelected
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          )}
                        >
                          {getInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 text-left min-w-0">
                        <div className="font-medium truncate">{user.name}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          <span
                            className={cn(
                              'px-1.5 py-0.5 rounded text-white text-[10px] font-medium',
                              getLevelBadgeColor(user.level)
                            )}
                          >
                            L{user.level}
                          </span>
                          <span className="truncate">{user.email}</span>
                        </div>
                      </div>
                      {isSelected && (
                        <Check className="h-5 w-5 text-primary flex-shrink-0" />
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Clear Selection */}
          {selectedUserId && (
            <div className="px-4 py-3 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={handleClear}
                className="w-full rounded-full"
              >
                Clear Selection
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
