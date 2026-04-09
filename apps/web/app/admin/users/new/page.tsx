'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout'
import { useAuth } from '@/lib/auth-context'
import { useUsers, userKeys } from '@/hooks'
import { useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Loader2, UserPlus } from 'lucide-react'
import { createUserAsAdmin } from '../actions'

export default function CreateUserPage() {
    const { profile } = useAuth()
    const router = useRouter()
    const queryClient = useQueryClient()
    const { data: users = [] } = useUsers()

    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [level, setLevel] = useState(4)
    const [reportsTo, setReportsTo] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)

    // Only admins can access this page
    if (!profile?.is_admin) {
        return (
            <DashboardLayout>
                <div className="p-6 lg:p-8">
                    <Card className="max-w-md mx-auto">
                        <CardContent className="py-12 text-center">
                            <p className="text-muted-foreground">Only administrators can create users.</p>
                            <Link href="/tasks">
                                <Button variant="outline" className="mt-4">
                                    Back to Tasks
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>
                </div>
            </DashboardLayout>
        )
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            // Use server action to create user with admin API
            const result = await createUserAsAdmin({
                email,
                password,
                name,
                level,
                reportsTo,
            })

            if (result.error) {
                throw new Error(result.error)
            }

            // Invalidate users query cache so the list updates immediately
            queryClient.invalidateQueries({ queryKey: userKeys.all })

            setSuccess(true)
            setTimeout(() => router.push('/admin/users'), 1500)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create user')
        } finally {
            setLoading(false)
        }
    }

    if (success) {
        return (
            <DashboardLayout>
                <div className="p-6 lg:p-8">
                    <Card className="max-w-md mx-auto">
                        <CardContent className="py-12 text-center">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/10 flex items-center justify-center">
                                <UserPlus className="h-8 w-8 text-emerald-500" />
                            </div>
                            <h2 className="text-xl font-semibold mb-2">User Created!</h2>
                            <p className="text-muted-foreground">
                                {name} has been added to the system.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </DashboardLayout>
        )
    }

    return (
        <DashboardLayout>
            <div className="p-6 lg:p-8">
                <div className="max-w-2xl mx-auto">
                    {/* Header */}
                    <div className="mb-6">
                        <Link href="/admin/users" className="inline-flex items-center text-muted-foreground hover:text-foreground mb-4">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Users
                        </Link>
                        <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Create New User</h1>
                        <p className="text-muted-foreground mt-1">Add a new team member to the system</p>
                    </div>

                    <Card data-slot="card">
                        <CardHeader>
                            <CardTitle>User Details</CardTitle>
                            <CardDescription>
                                Fill in the information for the new user
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit} className="space-y-6">
                                {error && (
                                    <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg">
                                        {error}
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <Label htmlFor="name">Full Name</Label>
                                    <Input
                                        id="name"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="John Doe"
                                        autoComplete="name"
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="email">Email</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="john@company.com"
                                        autoComplete="email"
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="password">Password</Label>
                                    <Input
                                        id="password"
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Minimum 6 characters"
                                        autoComplete="new-password"
                                        required
                                        minLength={6}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Level</Label>
                                    <Select value={String(level)} onValueChange={(v) => setLevel(Number(v))}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="1">L1 - Director</SelectItem>
                                            <SelectItem value="2">L2 - Manager</SelectItem>
                                            <SelectItem value="3">L3 - Team Lead</SelectItem>
                                            <SelectItem value="4">L4 - Senior</SelectItem>
                                            <SelectItem value="5">L5 - Junior</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">
                                        Lower number = higher authority. L1 can assign to everyone, L5 only to self.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label>Reports To (Optional)</Label>
                                    <Select value={reportsTo || 'none'} onValueChange={(v) => setReportsTo(v === 'none' ? null : v)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select supervisor" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">None</SelectItem>
                                            {users.map((user) => (
                                                <SelectItem key={user.id} value={user.id}>
                                                    {user.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="flex gap-4 pt-4">
                                    <Button type="submit" disabled={loading}>
                                        {loading ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Creating...
                                            </>
                                        ) : (
                                            <>
                                                <UserPlus className="mr-2 h-4 w-4" />
                                                Create User
                                            </>
                                        )}
                                    </Button>
                                    <Link href="/admin/users">
                                        <Button type="button" variant="outline">
                                            Cancel
                                        </Button>
                                    </Link>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </DashboardLayout>
    )
}
