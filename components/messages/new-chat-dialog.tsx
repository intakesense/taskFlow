'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useUsers } from '@/hooks'
import { UserBasic } from '@/lib/types'
import { cn } from '@/lib/utils'
import { createGroupSchema, type CreateGroupFormData } from '@/lib/schemas/message'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Search, MessageCircle, Users, Loader2 } from 'lucide-react'
import { haptics } from '@/lib/haptics'

interface NewChatDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onCreateDM: (userId: string) => void
    onCreateGroup: (name: string, memberIds: string[]) => void
    currentUserId?: string
    isCreating?: boolean
}

export function NewChatDialog({
    open,
    onOpenChange,
    onCreateDM,
    onCreateGroup,
    currentUserId,
    isCreating,
}: NewChatDialogProps) {
    const [mode, setMode] = useState<'dm' | 'group'>('dm')
    const [search, setSearch] = useState('')

    const { data: users = [], isLoading } = useUsers()

    const {
        register,
        handleSubmit,
        formState: { errors },
        setValue,
        watch,
        reset,
    } = useForm<CreateGroupFormData>({
        resolver: zodResolver(createGroupSchema),
        defaultValues: {
            groupName: '',
            selectedMembers: [],
        },
    })

    const selectedMembers = watch('selectedMembers')

    // Filter users by search, and exclude self only for group mode (auto-added as creator)
    // For DM mode, show self so user can message themselves like WhatsApp
    const filteredUsers = users.filter((user) => {
        // For group mode, exclude current user (they're auto-added)
        if (mode === 'group' && user.id === currentUserId) return false
        if (!search) return true
        return user.name.toLowerCase().includes(search.toLowerCase()) ||
            user.email.toLowerCase().includes(search.toLowerCase())
    })

    const handleUserSelect = (userId: string) => {
        haptics.selection()
        if (mode === 'dm') {
            onCreateDM(userId)
        } else {
            const currentMembers = selectedMembers || []
            const newMembers = currentMembers.includes(userId)
                ? currentMembers.filter((id) => id !== userId)
                : [...currentMembers, userId]
            setValue('selectedMembers', newMembers)
        }
    }

    const onSubmitGroup = (data: CreateGroupFormData) => {
        onCreateGroup(data.groupName, data.selectedMembers)
    }

    const resetState = () => {
        setMode('dm')
        setSearch('')
        reset()
    }

    return (
        <Dialog open={open} onOpenChange={(isOpen) => {
            if (!isOpen) resetState()
            onOpenChange(isOpen)
        }}>
            <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>New Conversation</DialogTitle>
                    <DialogDescription>
                        {mode === 'dm' ? 'Select a person to message' : 'Create a group chat'}
                    </DialogDescription>
                </DialogHeader>

                {/* Mode Selector */}
                <div className="flex gap-2">
                    <Button
                        variant={mode === 'dm' ? 'default' : 'outline'}
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                            haptics.light()
                            setMode('dm')
                        }}
                    >
                        <MessageCircle className="h-4 w-4 mr-2" />
                        Message
                    </Button>
                    <Button
                        variant={mode === 'group' ? 'default' : 'outline'}
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                            haptics.light()
                            setMode('group')
                        }}
                    >
                        <Users className="h-4 w-4 mr-2" />
                        Group
                    </Button>
                </div>

                {/* Group Name Input */}
                {mode === 'group' && (
                    <div className="space-y-2">
                        <Label htmlFor="groupName">Group Name</Label>
                        <Input
                            id="groupName"
                            placeholder="Enter group name..."
                            {...register('groupName')}
                        />
                        {errors.groupName && (
                            <p className="text-sm text-destructive">{errors.groupName.message}</p>
                        )}
                    </div>
                )}

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search people..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>

                {/* User List */}
                <div className="flex-1 overflow-y-auto space-y-1 max-h-64">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                    ) : filteredUsers.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No users found
                        </div>
                    ) : (
                        filteredUsers.map((user) => (
                            <UserRow
                                key={user.id}
                                user={user}
                                isSelected={selectedMembers.includes(user.id)}
                                showCheckbox={mode === 'group'}
                                onClick={() => handleUserSelect(user.id)}
                                disabled={isCreating}
                            />
                        ))
                    )}
                </div>

                {/* Create Group Button */}
                {mode === 'group' && (
                    <>
                        {errors.selectedMembers && (
                            <p className="text-sm text-destructive">{errors.selectedMembers.message}</p>
                        )}
                        <Button
                            onClick={handleSubmit(onSubmitGroup)}
                            disabled={isCreating}
                        >
                            {isCreating ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                `Create Group (${selectedMembers?.length || 0} selected)`
                            )}
                        </Button>
                    </>
                )}
            </DialogContent>
        </Dialog>
    )
}

interface UserRowProps {
    user: UserBasic
    isSelected: boolean
    showCheckbox: boolean
    onClick: () => void
    disabled?: boolean
}

function UserRow({ user, isSelected, showCheckbox, onClick, disabled }: UserRowProps) {
    return (
        <div
            onClick={disabled ? undefined : onClick}
            className={cn(
                'w-full flex items-center gap-3 p-3 rounded-lg transition-colors cursor-pointer',
                'hover:bg-muted',
                isSelected && 'bg-muted',
                disabled && 'opacity-50 pointer-events-none'
            )}
        >
            {showCheckbox && (
                <Checkbox
                    checked={isSelected}
                    className="pointer-events-none"
                    onCheckedChange={() => { }} // No-op since parent handles clicks
                />
            )}
            <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary text-primary-foreground">
                    {user.name.charAt(0).toUpperCase()}
                </AvatarFallback>
            </Avatar>
            <div className="flex-1 text-left">
                <p className="font-medium text-foreground">{user.name}</p>
                <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
        </div>
    )
}
