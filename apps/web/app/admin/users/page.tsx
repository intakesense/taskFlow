'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout'
import { useAuth } from '@/lib/auth-context'
import { useUsers, getLevelLabel, userKeys, useServices } from '@taskflow/features'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteUserAsAdmin } from './actions'
import { User } from '@/lib/types'
import { DataTable } from '@/components/ui/data-table'
import { createColumns } from './columns'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Users,
    Loader2,
    UserPlus,
} from 'lucide-react'

export default function AdminUsersPage() {
    const { profile, maskAs } = useAuth()
    const router = useRouter()
    const queryClient = useQueryClient()
    const { users: usersService } = useServices()
    const { data: users = [], isLoading: loading } = useUsers()
    const [editingUser, setEditingUser] = useState<User | null>(null)
    const [editDialogOpen, setEditDialogOpen] = useState(false)
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [deletingUser, setDeletingUser] = useState<User | null>(null)
    const [deleting, setDeleting] = useState(false)

    // Edit form state
    const [editName, setEditName] = useState('')
    const [editLevel, setEditLevel] = useState(4)
    const [editIsAdmin, setEditIsAdmin] = useState(false)

    const updateUser = useMutation({
        mutationFn: ({ id, updates }: { id: string; updates: { name: string; level: number; is_admin: boolean } }) =>
            usersService.updateUser(id, updates),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: userKeys.all })
            toast.success('User updated successfully')
            setEditDialogOpen(false)
        },
        onError: () => toast.error('Failed to update user'),
    })

    const openEditDialog = (user: User) => {
        setEditingUser(user)
        setEditName(user.name)
        setEditLevel(user.level)
        setEditIsAdmin(user.is_admin)
        setEditDialogOpen(true)
    }

    const handleSaveUser = () => {
        if (!editingUser) return
        updateUser.mutate({ id: editingUser.id, updates: { name: editName, level: editLevel, is_admin: editIsAdmin } })
    }

    const openDeleteDialog = (user: User) => {
        setDeletingUser(user)
        setDeleteDialogOpen(true)
    }

    const handleDeleteUser = async () => {
        if (!deletingUser) return
        setDeleting(true)
        try {
            const result = await deleteUserAsAdmin(deletingUser.id)
            if (result.error) {
                toast.error(result.error)
                return
            }
            queryClient.invalidateQueries({ queryKey: userKeys.all })
            toast.success('User deleted successfully')
            setDeleteDialogOpen(false)
        } catch {
            toast.error('Failed to delete user')
        } finally {
            setDeleting(false)
        }
    }

    const handleMaskAs = async (userId: string) => {
        await maskAs(userId)
        router.push('/tasks')
    }

    const columns = createColumns({
        onEdit: openEditDialog,
        onDelete: openDeleteDialog,
        onMaskAs: handleMaskAs,
        currentUserId: profile?.id,
    })

    if (!profile?.is_admin) {
        return null
    }

    return (
        <DashboardLayout>
            <div className="p-6 lg:p-8 space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl lg:text-3xl font-bold text-foreground flex items-center gap-3">
                            <Users className="h-8 w-8" />
                            User Management
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            Manage users, assign levels, and control access
                        </p>
                    </div>
                    <Link href="/admin/users/new">
                        <Button>
                            <UserPlus className="h-4 w-4 mr-2" />
                            Create User
                        </Button>
                    </Link>
                </div>

                {/* User List */}
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : (
                    <Card data-slot="card">
                        <CardHeader>
                            <CardTitle>All Users ({users.length})</CardTitle>
                            <CardDescription>
                                Manage user accounts, levels, and permissions
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                columns={columns}
                                data={users}
                                searchKey="name"
                                searchPlaceholder="Search users by name or email..."
                            />
                        </CardContent>
                    </Card>
                )}

                {/* Edit Dialog */}
                <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Edit User</DialogTitle>
                            <DialogDescription>Update user information and access level</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Name</Label>
                                <Input
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Level</Label>
                                <Select value={String(editLevel)} onValueChange={(v) => setEditLevel(Number(v))}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {[1, 2, 3, 4, 5].map((level) => (
                                            <SelectItem key={level} value={String(level)}>
                                                {getLevelLabel(level)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="isAdmin"
                                    checked={editIsAdmin}
                                    onChange={(e) => setEditIsAdmin(e.target.checked)}
                                    className="rounded"
                                />
                                <Label htmlFor="isAdmin" className="cursor-pointer">
                                    Admin privileges
                                </Label>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleSaveUser} disabled={updateUser.isPending}>
                                {updateUser.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                Save Changes
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Delete Dialog */}
                <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Delete User</DialogTitle>
                            <DialogDescription>
                                Are you sure you want to delete {deletingUser?.name}? This action cannot be undone.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button variant="destructive" onClick={handleDeleteUser} disabled={deleting}>
                                {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                Delete
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </DashboardLayout>
    )
}
