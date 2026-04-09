'use client'

import { useState, useRef, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ConversationWithMembers, UserBasic } from '@/lib/types'
import { updateGroupNameSchema, type UpdateGroupNameFormData } from '@/lib/schemas/message'
import { useUsers } from '@/hooks'
import {
    useUpdateGroupName,
    useAddGroupMembers,
    useRemoveGroupMember,
    useLeaveGroup,
    useUploadGroupAvatar,
} from '@/hooks/use-conversations'
import { cn } from '@/lib/utils'
import { haptics } from '@/lib/haptics'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
    Search,
    Camera,
    Pencil,
    Check,
    X,
    UserPlus,
    LogOut,
    Trash2,
    Loader2,
    Crown,
} from 'lucide-react'
import { getLevelLabel } from '@/lib/services/users'

interface GroupSettingsDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    conversation: ConversationWithMembers
    currentUserId: string
}

export function GroupSettingsDialog({
    open,
    onOpenChange,
    conversation,
    currentUserId,
}: GroupSettingsDialogProps) {
    const [isEditingName, setIsEditingName] = useState(false)
    const [showAddMembers, setShowAddMembers] = useState(false)
    const [memberToRemove, setMemberToRemove] = useState<UserBasic | null>(null)
    const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
    const [search, setSearch] = useState('')
    const [selectedNewMembers, setSelectedNewMembers] = useState<string[]>([])
    const fileInputRef = useRef<HTMLInputElement>(null)

    const { data: allUsers = [] } = useUsers()
    const updateGroupName = useUpdateGroupName()
    const addGroupMembers = useAddGroupMembers()
    const removeGroupMember = useRemoveGroupMember()
    const leaveGroup = useLeaveGroup()
    const { uploadAvatar, isLoading: isUploadingAvatar } = useUploadGroupAvatar()

    const isCreator = conversation.created_by === currentUserId
    const memberIds = new Set(conversation.members.map(m => m.id))

    // Users not in the group yet
    const availableUsers = allUsers.filter(u => !memberIds.has(u.id))
    const filteredAvailableUsers = availableUsers.filter(u => {
        if (!search) return true
        return u.name.toLowerCase().includes(search.toLowerCase()) ||
            u.email.toLowerCase().includes(search.toLowerCase())
    })

    const {
        register,
        handleSubmit,
        formState: { errors },
        reset,
    } = useForm<UpdateGroupNameFormData>({
        resolver: zodResolver(updateGroupNameSchema),
        defaultValues: {
            name: conversation.name || '',
        },
    })

    const handleNameSubmit = async (data: UpdateGroupNameFormData) => {
        await updateGroupName.mutateAsync({
            conversationId: conversation.id,
            name: data.name,
        })
        setIsEditingName(false)
    }

    const handleCancelEditName = () => {
        reset({ name: conversation.name || '' })
        setIsEditingName(false)
    }

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        // Validate file type
        if (!file.type.startsWith('image/')) {
            return
        }

        // Validate file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
            return
        }

        await uploadAvatar(conversation.id, file)
        e.target.value = ''
    }

    const handleAddMembers = async () => {
        if (selectedNewMembers.length === 0) return
        await addGroupMembers.mutateAsync({
            conversationId: conversation.id,
            memberIds: selectedNewMembers,
        })
        setSelectedNewMembers([])
        setShowAddMembers(false)
        setSearch('')
    }

    const handleRemoveMember = async () => {
        if (!memberToRemove) return
        await removeGroupMember.mutateAsync({
            conversationId: conversation.id,
            userId: memberToRemove.id,
        })
        setMemberToRemove(null)
    }

    const handleLeaveGroup = async () => {
        await leaveGroup.mutateAsync({
            conversationId: conversation.id,
            userId: currentUserId,
        })
        setShowLeaveConfirm(false)
        onOpenChange(false)
    }

    const toggleNewMember = (userId: string) => {
        haptics.selection()
        setSelectedNewMembers(prev =>
            prev.includes(userId)
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        )
    }

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Group Settings</DialogTitle>
                        <DialogDescription>
                            Manage group name, picture, and members
                        </DialogDescription>
                    </DialogHeader>

                    {/* Group Avatar */}
                    <div className="flex justify-center">
                        <div className="relative">
                            <Avatar className="h-24 w-24">
                                {conversation.avatar_url && (
                                    <AvatarImage src={conversation.avatar_url} alt={conversation.name || 'Group'} />
                                )}
                                <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                                    {conversation.name?.charAt(0).toUpperCase() || 'G'}
                                </AvatarFallback>
                            </Avatar>
                            <Button
                                size="icon"
                                variant="secondary"
                                className="absolute bottom-0 right-0 h-8 w-8 rounded-full"
                                onClick={() => {
                                    haptics.light()
                                    fileInputRef.current?.click()
                                }}
                                disabled={isUploadingAvatar}
                            >
                                {isUploadingAvatar ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Camera className="h-4 w-4" />
                                )}
                            </Button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleAvatarChange}
                            />
                        </div>
                    </div>

                    {/* Group Name */}
                    <div className="space-y-2">
                        <Label>Group Name</Label>
                        {isEditingName ? (
                            <form onSubmit={handleSubmit(handleNameSubmit)} className="flex gap-2">
                                <Input
                                    {...register('name')}
                                    autoFocus
                                    placeholder="Enter group name..."
                                />
                                <Button
                                    type="submit"
                                    size="icon"
                                    disabled={updateGroupName.isPending}
                                >
                                    {updateGroupName.isPending ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Check className="h-4 w-4" />
                                    )}
                                </Button>
                                <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    onClick={handleCancelEditName}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </form>
                        ) : (
                            <div className="flex items-center gap-2">
                                <p className="flex-1 text-lg font-medium">{conversation.name}</p>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => {
                                        haptics.light()
                                        setIsEditingName(true)
                                    }}
                                >
                                    <Pencil className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                        {errors.name && (
                            <p className="text-sm text-destructive">{errors.name.message}</p>
                        )}
                    </div>

                    <Separator />

                    {/* Members Section */}
                    <div className="flex-1 min-h-0 flex flex-col">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-medium">{conversation.members.length} Members</h3>
                            {isCreator && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                        haptics.light()
                                        setShowAddMembers(!showAddMembers)
                                    }}
                                >
                                    <UserPlus className="h-4 w-4 mr-2" />
                                    Add
                                </Button>
                            )}
                        </div>

                        {/* Add Members Section (Collapsible) */}
                        {showAddMembers && isCreator && (
                            <div className="mb-3 p-3 bg-muted rounded-lg space-y-3">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search people to add..."
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        className="pl-9"
                                    />
                                </div>
                                <div className="max-h-32 overflow-y-auto space-y-1">
                                    {filteredAvailableUsers.length === 0 ? (
                                        <p className="text-sm text-muted-foreground text-center py-2">
                                            No users to add
                                        </p>
                                    ) : (
                                        filteredAvailableUsers.map(user => (
                                            <div
                                                key={user.id}
                                                onClick={() => toggleNewMember(user.id)}
                                                className={cn(
                                                    'flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-background',
                                                    selectedNewMembers.includes(user.id) && 'bg-background'
                                                )}
                                            >
                                                <Checkbox
                                                    checked={selectedNewMembers.includes(user.id)}
                                                    className="pointer-events-none"
                                                />
                                                <Avatar className="h-8 w-8">
                                                    {user.avatar_url && (
                                                        <AvatarImage src={user.avatar_url} alt={user.name} />
                                                    )}
                                                    <AvatarFallback className="text-xs">
                                                        {user.name.charAt(0).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <span className="text-sm flex-1">{user.name}</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                                {selectedNewMembers.length > 0 && (
                                    <Button
                                        size="sm"
                                        className="w-full"
                                        onClick={handleAddMembers}
                                        disabled={addGroupMembers.isPending}
                                    >
                                        {addGroupMembers.isPending ? (
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        ) : null}
                                        Add {selectedNewMembers.length} Member{selectedNewMembers.length > 1 ? 's' : ''}
                                    </Button>
                                )}
                            </div>
                        )}

                        {/* Members List */}
                        <div className="flex-1 overflow-y-auto space-y-1 max-h-48">
                            {conversation.members.map(member => (
                                <MemberRow
                                    key={member.id}
                                    member={member}
                                    isCreator={member.id === conversation.created_by}
                                    isCurrentUser={member.id === currentUserId}
                                    canRemove={isCreator && member.id !== currentUserId}
                                    onRemove={() => setMemberToRemove(member)}
                                />
                            ))}
                        </div>
                    </div>

                    <Separator />

                    {/* Leave Group */}
                    <Button
                        variant="destructive"
                        className="w-full"
                        onClick={() => {
                            haptics.light()
                            setShowLeaveConfirm(true)
                        }}
                    >
                        <LogOut className="h-4 w-4 mr-2" />
                        Leave Group
                    </Button>
                </DialogContent>
            </Dialog>

            {/* Remove Member Confirmation */}
            <AlertDialog open={!!memberToRemove} onOpenChange={(open) => !open && setMemberToRemove(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove Member</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to remove {memberToRemove?.name} from this group?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleRemoveMember}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {removeGroupMember.isPending ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : null}
                            Remove
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Leave Group Confirmation */}
            <AlertDialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Leave Group</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to leave &quot;{conversation.name}&quot;? You won&apos;t be able to see messages in this group anymore.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleLeaveGroup}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {leaveGroup.isPending ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : null}
                            Leave
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}

interface MemberRowProps {
    member: UserBasic
    isCreator: boolean
    isCurrentUser: boolean
    canRemove: boolean
    onRemove: () => void
}

function MemberRow({ member, isCreator, isCurrentUser, canRemove, onRemove }: MemberRowProps) {
    return (
        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted">
            <Avatar className="h-10 w-10">
                {member.avatar_url && <AvatarImage src={member.avatar_url} alt={member.name} />}
                <AvatarFallback className="bg-primary text-primary-foreground">
                    {member.name.charAt(0).toUpperCase()}
                </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">
                        {member.name}
                        {isCurrentUser && <span className="text-muted-foreground ml-1">(You)</span>}
                    </p>
                    {isCreator && (
                        <Crown className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {getLevelLabel(member.level)}
                    </Badge>
                    <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                </div>
            </div>
            {canRemove && (
                <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={(e) => {
                        e.stopPropagation()
                        haptics.light()
                        onRemove()
                    }}
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            )}
        </div>
    )
}
