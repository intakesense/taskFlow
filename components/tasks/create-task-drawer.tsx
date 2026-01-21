'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, Send, Calendar, Eye, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { useCreateTask } from '@/hooks/use-tasks'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { UserSelector } from './user-selector'
import { cn } from '@/lib/utils'

interface CreateTaskDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Define form schema inline to avoid type conflicts
const taskFormSchema = z.object({
  title: z.string().min(1, 'Title is required').min(3, 'Title must be at least 3 characters'),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']),
  visibility: z.enum(['private', 'supervisor', 'hierarchy_same', 'hierarchy_above', 'all']),
  deadline: z.string().optional(),
})

type TaskFormData = z.infer<typeof taskFormSchema>

export function CreateTaskDrawer({ open, onOpenChange }: CreateTaskDrawerProps) {
  const router = useRouter()
  const { effectiveUser } = useAuth()
  const createTask = useCreateTask()
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
    watch,
  } = useForm<TaskFormData>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      priority: 'medium',
      visibility: 'hierarchy_same',
      title: '',
      description: '',
      deadline: '',
    },
  })

  const title = watch('title')
  const description = watch('description')
  const priority = watch('priority')
  const visibility = watch('visibility')
  const deadline = watch('deadline')

  const onSubmit = async (data: TaskFormData) => {
    if (!effectiveUser?.id) {
      toast.error('You must be logged in to create tasks')
      return
    }

    if (!selectedUserId) {
      toast.error('Please select someone to assign the task to')
      return
    }

    try {
      await createTask.mutateAsync({
        userId: effectiveUser.id,
        input: {
          title: data.title,
          description: data.description,
          priority: data.priority,
          status: 'pending',
          visibility: data.visibility,
          deadline: data.deadline,
          assigned_to: selectedUserId,
        },
      })
      toast.success('Task created!')
      reset()
      setSelectedUserId(null)
      setShowAdvanced(false)
      onOpenChange(false)
      router.push('/tasks')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create task'
      toast.error(message)
    }
  }

  const handleClose = () => {
    reset()
    setSelectedUserId(null)
    setShowAdvanced(false)
    onOpenChange(false)
  }

  const priorityOptions = [
    { value: 'low', label: 'Low', color: 'bg-blue-500' },
    { value: 'medium', label: 'Medium', color: 'bg-yellow-500' },
    { value: 'high', label: 'High', color: 'bg-red-500' },
  ]

  const visibilityOptions = [
    { value: 'private', label: 'Private', icon: '🔒' },
    { value: 'supervisor', label: 'Supervisor', icon: '👤' },
    { value: 'hierarchy_same', label: 'Same Level', icon: '👥' },
    { value: 'hierarchy_above', label: 'Above Levels', icon: '⬆️' },
    { value: 'all', label: 'Everyone', icon: '🌐' },
  ]

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[85vh] sm:h-[90vh] p-0 flex flex-col rounded-t-3xl sm:rounded-t-2xl"
      >
        {/* Header */}
        <SheetHeader className="px-4 py-3 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg font-semibold">New Task</SheetTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={handleClose}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </SheetHeader>

        {/* Content */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {/* Title Input - WhatsApp style */}
            <div className="space-y-2">
              <Input
                {...register('title')}
                placeholder="What needs to be done?"
                className="text-base border-0 border-b rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary"
                autoFocus
              />
              {errors.title && (
                <p className="text-sm text-destructive">{errors.title.message}</p>
              )}
            </div>

            {/* Description - Auto-expanding textarea */}
            <div className="space-y-2">
              <Textarea
                {...register('description')}
                placeholder="Add details... (optional)"
                className="min-h-[80px] resize-none border-0 bg-muted/50 rounded-2xl px-4 py-3 text-base focus-visible:ring-1"
                rows={3}
              />
              {errors.description && (
                <p className="text-sm text-destructive">{errors.description.message}</p>
              )}
            </div>

            {/* User Selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Assign to</label>
              <UserSelector
                selectedUserId={selectedUserId}
                onSelectUser={setSelectedUserId}
              />
            </div>

            {/* Quick Actions - Pill buttons */}
            <div className="flex flex-wrap gap-2">
              {/* Priority Selector */}
              <div className="flex gap-2">
                {priorityOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setValue('priority', option.value as any)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                      'border flex items-center gap-1.5',
                      priority === option.value
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background border-border text-muted-foreground hover:bg-muted'
                    )}
                  >
                    <span className={cn('w-2 h-2 rounded-full', option.color)} />
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Advanced Options Toggle */}
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronDown
                className={cn('h-4 w-4 transition-transform', showAdvanced && 'rotate-180')}
              />
              {showAdvanced ? 'Hide' : 'Show'} more options
            </button>

            {/* Advanced Options */}
            {showAdvanced && (
              <div className="space-y-4 pb-4">
                {/* Deadline */}
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    Deadline
                  </label>
                  <Input
                    type="datetime-local"
                    {...register('deadline')}
                    className="rounded-xl"
                  />
                  {errors.deadline && (
                    <p className="text-sm text-destructive">{errors.deadline.message}</p>
                  )}
                </div>

                {/* Visibility */}
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                    <Eye className="h-4 w-4" />
                    Who can see this
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {visibilityOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setValue('visibility', option.value as any)}
                        className={cn(
                          'px-4 py-3 rounded-xl text-sm font-medium transition-all text-left',
                          'border flex items-center gap-2',
                          visibility === option.value
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background border-border hover:bg-muted'
                        )}
                      >
                        <span className="text-base">{option.icon}</span>
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* Footer - Sticky send button */}
          <div className="flex-shrink-0 p-4 border-t bg-background">
            <Button
              type="submit"
              disabled={isSubmitting || !title?.trim()}
              className="w-full rounded-full h-12 text-base font-medium"
              size="lg"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Creating...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  Create Task
                </div>
              )}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
