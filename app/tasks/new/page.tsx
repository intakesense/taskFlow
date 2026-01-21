'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout'
import { useAuth } from '@/lib/auth-context'
import { useAssignableUsers } from '@/hooks'
import { useCreateTask } from '@/hooks'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Loader2, ClipboardList } from 'lucide-react'
import { TaskPriority, Visibility } from '@/lib/types'

export default function NewTaskPage() {
    const router = useRouter()
    const { effectiveUser } = useAuth()
    const { data: assignableUsers = [], isLoading: loadingUsers } = useAssignableUsers(effectiveUser?.level)
    const createTask = useCreateTask()

    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [assignedTo, setAssignedTo] = useState('')
    const [priority, setPriority] = useState<TaskPriority>('medium')
    const [deadline, setDeadline] = useState('')
    const [visibility, setVisibility] = useState<Visibility>('hierarchy_same')

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!effectiveUser?.id || !assignedTo) return

        try {
            await createTask.mutateAsync({
                userId: effectiveUser.id,
                input: {
                    title,
                    description,
                    assigned_to: assignedTo,
                    priority,
                    deadline: deadline || undefined,
                    status: 'pending',
                    visibility,
                },
            })
            toast.success('Task created successfully')
            router.push('/tasks')
        } catch (error) {
            toast.error('Failed to create task')
        }
    }

    return (
        <DashboardLayout>
            <div className="p-6 lg:p-8">
                <div className="max-w-2xl mx-auto">
                    {/* Header */}
                    <div className="mb-6">
                        <Link href="/tasks" className="inline-flex items-center text-muted-foreground hover:text-foreground mb-4">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Tasks
                        </Link>
                        <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Create New Task</h1>
                        <p className="text-muted-foreground mt-1">
                            Assign a task to a team member
                        </p>
                    </div>

                    <Card data-slot="card">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <ClipboardList className="h-5 w-5" />
                                Task Details
                            </CardTitle>
                            <CardDescription>
                                Fill in the details for the new task
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit} className="space-y-6">
                                {/* Title */}
                                <div className="space-y-2">
                                    <Label htmlFor="title">Title *</Label>
                                    <Input
                                        id="title"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="Enter task title"
                                        required
                                    />
                                </div>

                                {/* Description */}
                                <div className="space-y-2">
                                    <Label htmlFor="description">Description</Label>
                                    <Textarea
                                        id="description"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="Enter task description"
                                        rows={4}
                                    />
                                </div>

                                {/* Assign To */}
                                <div className="space-y-2">
                                    <Label htmlFor="assignedTo">Assign To *</Label>
                                    {loadingUsers ? (
                                        <div className="flex items-center gap-2 text-muted-foreground py-2">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Loading users...
                                        </div>
                                    ) : (
                                        <Select value={assignedTo} onValueChange={setAssignedTo} required>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a team member" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {assignableUsers.map((user) => (
                                                    <SelectItem key={user.id} value={user.id}>
                                                        {user.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                </div>

                                {/* Priority & Deadline */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="priority">Priority</Label>
                                        <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="low">Low</SelectItem>
                                                <SelectItem value="medium">Medium</SelectItem>
                                                <SelectItem value="high">High</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="deadline">Deadline</Label>
                                        <Input
                                            id="deadline"
                                            type="date"
                                            value={deadline}
                                            onChange={(e) => setDeadline(e.target.value)}
                                        />
                                    </div>
                                </div>

                                {/* Visibility */}
                                <div className="space-y-2">
                                    <Label htmlFor="visibility">Visibility</Label>
                                    <Select value={visibility} onValueChange={(v) => setVisibility(v as Visibility)}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="private">Private (Assignee only)</SelectItem>
                                            <SelectItem value="supervisor">Supervisor</SelectItem>
                                            <SelectItem value="hierarchy_same">Same level &amp; above</SelectItem>
                                            <SelectItem value="hierarchy_above">Above level only</SelectItem>
                                            <SelectItem value="all">Everyone</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">
                                        Who can see this task besides the assigner and assignee
                                    </p>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-4 pt-4">
                                    <Button type="submit" disabled={createTask.isPending || !assignedTo}>
                                        {createTask.isPending ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Creating...
                                            </>
                                        ) : (
                                            'Create Task'
                                        )}
                                    </Button>
                                    <Link href="/tasks">
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
