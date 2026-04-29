'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Send, CalendarDays, Eye } from 'lucide-react';
import { toast } from 'sonner';
import {
  Button,
  Textarea,
  Input,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  cn,
} from '@taskflow/ui';
import type { Visibility } from '@taskflow/core';
import { VISIBILITY_LABELS } from '@taskflow/core';
import { useCreateTask } from '../../hooks';
import { useAuth } from '../../providers/auth-context';
import { useNavigation } from '../../providers/navigation-context';
import { MultiUserSelector } from './multi-user-selector';

interface CreateTaskDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSelectedUserIds?: string[];
}

const taskFormSchema = z.object({
  title: z.string().min(1, 'Title is required').min(3, 'Title must be at least 3 characters'),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']),
  deadline: z.string().optional(),
});

type TaskFormData = z.infer<typeof taskFormSchema>;

export function CreateTaskDrawer({
  open,
  onOpenChange,
  initialSelectedUserIds,
}: CreateTaskDrawerProps) {
  const { navigate } = useNavigation();
  const { effectiveUser } = useAuth();
  const createTask = useCreateTask();
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<Visibility>('private');

  useEffect(() => {
    if (open && initialSelectedUserIds?.length) {
      setSelectedUserIds(initialSelectedUserIds);
    }
  }, [open, initialSelectedUserIds]);

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
      title: '',
      description: '',
      deadline: '',
    },
  });

  const title = watch('title');
  const priority = watch('priority');
  const deadline = watch('deadline');

  const onSubmit = async (data: TaskFormData) => {
    if (!effectiveUser?.id) {
      toast.error('You must be logged in to create tasks');
      return;
    }

    if (selectedUserIds.length === 0) {
      toast.error('Please select at least one person to assign the task to');
      return;
    }

    try {
      await createTask.mutateAsync({
        userId: effectiveUser.id,
        input: {
          title: data.title,
          description: data.description,
          priority: data.priority,
          status: 'pending',
          visibility,
          deadline: data.deadline,
          assigned_to: selectedUserIds,
        },
      });
      toast.success('Task created!');
      reset();
      setSelectedUserIds([]);
      setVisibility('private');
      onOpenChange(false);
      navigate('/tasks');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create task';
      toast.error(message);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      reset();
      setSelectedUserIds([]);
    }
    onOpenChange(isOpen);
  };

  const priorityOptions = [
    { value: 'low', label: 'Low', color: 'bg-blue-500' },
    { value: 'medium', label: 'Medium', color: 'bg-yellow-500' },
    { value: 'high', label: 'High', color: 'bg-red-500' },
  ];

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] p-0 flex flex-col rounded-t-2xl">
        <SheetHeader className="px-5 py-3 border-b flex-shrink-0">
          <SheetTitle className="text-center text-base font-semibold">New Task</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            <div className="space-y-1.5">
              <Input
                {...register('title')}
                placeholder="What needs to be done?"
                className="h-12 text-base rounded-xl bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary"
                autoFocus
              />
              {errors.title && (
                <p className="text-xs text-destructive px-1">{errors.title.message}</p>
              )}
            </div>

            <Textarea
              {...register('description')}
              placeholder="Add details (optional)..."
              className="min-h-[60px] resize-none rounded-xl bg-muted/50 border-0 text-sm focus-visible:ring-1 focus-visible:ring-primary"
              rows={2}
            />

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
                Assign to <span className="text-destructive">*</span>
              </label>
              <MultiUserSelector
                selectedUserIds={selectedUserIds}
                onSelectUsers={setSelectedUserIds}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
                  Due date
                </label>
                <div className="relative">
                  <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    type="datetime-local"
                    {...register('deadline')}
                    className={cn(
                      'h-10 pl-9 pr-2 rounded-xl bg-muted/50 border-0 text-sm',
                      'focus-visible:ring-1 focus-visible:ring-primary',
                      '[color-scheme:light] dark:[color-scheme:dark]',
                      '[&::-webkit-calendar-picker-indicator]:opacity-60',
                      '[&::-webkit-calendar-picker-indicator]:cursor-pointer',
                      'dark:[&::-webkit-calendar-picker-indicator]:invert',
                      !deadline && 'text-muted-foreground'
                    )}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
                  Priority
                </label>
                <div className="flex gap-1.5">
                  {priorityOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setValue('priority', option.value as 'low' | 'medium' | 'high')}
                      className={cn(
                        'flex-1 h-10 rounded-xl text-xs font-medium transition-all',
                        'flex items-center justify-center gap-1',
                        priority === option.value
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                      )}
                    >
                      <span
                        className={cn(
                          'w-1.5 h-1.5 rounded-full',
                          option.color,
                          priority !== option.value && 'opacity-60'
                        )}
                      />
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
                Visibility
              </label>
              <div className="flex flex-wrap gap-1.5">
                {(Object.entries(VISIBILITY_LABELS) as [Visibility, string][]).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setVisibility(value)}
                    className={cn(
                      'h-9 px-3 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5',
                      visibility === value
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                    )}
                  >
                    <Eye className={cn('h-3 w-3', visibility !== value && 'opacity-60')} />
                    {label}
                  </button>
                ))}
              </div>
            </div>

          </div>

          <div className="flex-shrink-0 p-4 border-t bg-background">
            <Button
              type="submit"
              disabled={isSubmitting || !title?.trim() || selectedUserIds.length === 0}
              className="w-full rounded-xl h-11 text-sm font-semibold"
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
  );
}
