'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Send, CalendarDays } from 'lucide-react'
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
import { MultiUserSelector } from './multi-user-selector'
import { cn } from '@/lib/utils'
import { useState } from 'react'

interface CreateTaskDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

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
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])

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
  const priority = watch('priority')
  const visibility = watch('visibility')

  const onSubmit = async (data: TaskFormData) => {
    if (!effectiveUser?.id) {
      toast.error('You must be logged in to create tasks')
      return
    }

    if (selectedUserIds.length === 0) {
      toast.error('Please select at least one person to assign the task to')
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
          assigned_to: selectedUserIds,
        },
      })
      toast.success('Task created!')
      reset()
      setSelectedUserIds([])
      onOpenChange(false)
      router.push('/tasks')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create task'
      toast.error(message)
    }
  }

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      reset()
      setSelectedUserIds([])
    }
    onOpenChange(isOpen)
  }

  const priorityOptions = [
    { value: 'low', label: 'Low', color: 'bg-blue-500' },
    { value: 'medium', label: 'Medium', color: 'bg-yellow-500' },
    { value: 'high', label: 'High', color: 'bg-red-500' },
  ]

  const visibilityOptions = [
    { value: 'private', label: 'Only me', description: 'Private task' },
    { value: 'supervisor', label: 'Supervisor', description: 'My supervisor can see' },
    { value: 'hierarchy_same', label: 'Same level', description: 'Peers can see' },
    { value: 'hierarchy_above', label: 'Above', description: 'Higher levels can see' },
    { value: 'all', label: 'Everyone', description: 'Visible to all' },
  ]

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[90vh] p-0 flex flex-col rounded-t-2xl"
      >
        {/* Header - Clean, minimal */}
        <SheetHeader className="px-5 py-4 border-b flex-shrink-0">
          <SheetTitle className="text-center text-base font-semibold">New Task</SheetTitle>
        </SheetHeader>

        {/* Content */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

            {/* Title - Required */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Title <span className="text-destructive">*</span>
              </label>
              <Input
                {...register('title')}
                placeholder="What needs to be done?"
                className="h-11 text-base rounded-xl bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary"
                autoFocus
              />
              {errors.title && (
                <p className="text-xs text-destructive">{errors.title.message}</p>
              )}
            </div>

            {/* Description - Optional */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Description <span className="text-muted-foreground/60 normal-case">(optional)</span>
              </label>
              <Textarea
                {...register('description')}
                placeholder="Add details..."
                className="min-h-[72px] resize-none rounded-xl bg-muted/50 border-0 text-sm focus-visible:ring-1 focus-visible:ring-primary"
                rows={2}
              />
            </div>

            {/* Assign to - Required */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Assign to <span className="text-destructive">*</span>
              </label>
              <MultiUserSelector
                selectedUserIds={selectedUserIds}
                onSelectUsers={setSelectedUserIds}
              />
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Priority
              </label>
              <div className="flex gap-2">
                {priorityOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setValue('priority', option.value as 'low' | 'medium' | 'high')}
                    className={cn(
                      'flex-1 py-2 rounded-lg text-xs font-medium transition-all',
                      'flex items-center justify-center gap-1.5',
                      priority === option.value
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                    )}
                  >
                    <span className={cn(
                      'w-1.5 h-1.5 rounded-full',
                      option.color,
                      priority !== option.value && 'opacity-60'
                    )} />
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Deadline - Optional */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Deadline <span className="text-muted-foreground/60 normal-case">(optional)</span>
              </label>
              <div className="relative">
                <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="datetime-local"
                  {...register('deadline')}
                  className={cn(
                    'h-11 pl-10 rounded-xl bg-muted/50 border-0',
                    'focus-visible:ring-1 focus-visible:ring-primary',
                    'text-sm [color-scheme:light] dark:[color-scheme:dark]',
                    // Fix calendar icon visibility
                    '[&::-webkit-calendar-picker-indicator]:opacity-60',
                    '[&::-webkit-calendar-picker-indicator]:cursor-pointer',
                    'dark:[&::-webkit-calendar-picker-indicator]:invert'
                  )}
                />
              </div>
            </div>

            {/* Visibility */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Visibility
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {visibilityOptions.slice(0, 3).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setValue('visibility', option.value as TaskFormData['visibility'])}
                    className={cn(
                      'py-2.5 px-2 rounded-lg text-xs font-medium transition-all text-center',
                      visibility === option.value
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {visibilityOptions.slice(3).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setValue('visibility', option.value as TaskFormData['visibility'])}
                    className={cn(
                      'py-2.5 px-2 rounded-lg text-xs font-medium transition-all text-center',
                      visibility === option.value
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Footer - Submit button */}
          <div className="flex-shrink-0 p-4 border-t bg-background">
            <Button
              type="submit"
              disabled={isSubmitting || !title?.trim() || selectedUserIds.length === 0}
              className="w-full rounded-xl h-12 text-sm font-semibold"
              size="lg"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Creating...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Send className="h-4 w-4" />
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
