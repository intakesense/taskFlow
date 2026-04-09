// Task progress hooks with realtime subscriptions
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  TaskMessage,
  TaskMessageWithSender,
  ProgressUpdateWithComments,
  UserBasic
} from '@/lib/types'
import { CHANNELS, STALE_TIME } from '@/lib/constants'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/utils/error'
import {
  getProgressUpdates,
  getProgressUpdatesByDate,
  createProgressUpdate,
  addProgressComment,
  getAllProgressUpdates
} from '@/lib/services/progress'

const supabase = createClient()

// Query keys
export const taskProgressKeys = {
  all: ['task-progress'] as const,
  feed: () => [...taskProgressKeys.all, 'feed'] as const,
  task: (taskId: string) => [...taskProgressKeys.all, taskId] as const,
  byDate: (taskId: string) => [...taskProgressKeys.task(taskId), 'by-date'] as const,
}

// ============= HOOKS =============

/**
 * Fetch all progress updates across all tasks for the feed view
 */
export function useAllProgressFeed(limit: number = 50) {
  return useQuery({
    queryKey: taskProgressKeys.feed(),
    queryFn: () => getAllProgressUpdates(limit),
    staleTime: STALE_TIME.MESSAGES,
  })
}

/**
 * Fetch progress updates for a task
 */
export function useTaskProgress(taskId: string | undefined) {
  return useQuery({
    queryKey: taskProgressKeys.task(taskId || ''),
    queryFn: () => getProgressUpdates(taskId!),
    enabled: !!taskId,
    staleTime: STALE_TIME.MESSAGES,
  })
}

/**
 * Fetch progress updates grouped by date for timeline display
 */
export function useTaskProgressByDate(taskId: string | undefined) {
  return useQuery({
    queryKey: taskProgressKeys.byDate(taskId || ''),
    queryFn: () => getProgressUpdatesByDate(taskId!),
    enabled: !!taskId,
    staleTime: STALE_TIME.MESSAGES,
  })
}

/**
 * Create a new progress update
 */
export function useCreateProgressUpdate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ taskId, senderId, content }: {
      taskId: string
      senderId: string
      content: string
      sender?: UserBasic
    }) => createProgressUpdate(taskId, senderId, content),
    onMutate: async (variables) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: taskProgressKeys.task(variables.taskId),
      })

      // Snapshot previous value
      const previousProgress = queryClient.getQueryData<ProgressUpdateWithComments[]>(
        taskProgressKeys.task(variables.taskId)
      )

      // Optimistically add progress update
      const optimisticUpdate: ProgressUpdateWithComments = {
        id: `temp-${Date.now()}`,
        task_id: variables.taskId,
        sender_id: variables.senderId,
        message: variables.content,
        content: variables.content,
        type: 'progress',
        file_url: null,
        file_name: null,
        file_size: null,
        file_type: null,
        reply_to_id: null,
        is_deleted: false,
        created_at: new Date().toISOString(),
        sender: variables.sender || null,
        reactions: [],
        comments: [],
        commentCount: 0,
      }

      queryClient.setQueryData<ProgressUpdateWithComments[]>(
        taskProgressKeys.task(variables.taskId),
        (old = []) => [...old, optimisticUpdate]
      )

      // Also invalidate the by-date query
      queryClient.invalidateQueries({
        queryKey: taskProgressKeys.byDate(variables.taskId),
      })

      return { previousProgress }
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousProgress) {
        queryClient.setQueryData(
          taskProgressKeys.task(variables.taskId),
          context.previousProgress
        )
      }
      toast.error(getErrorMessage(error, 'Failed to post progress update'))
    },
    onSuccess: (data, variables) => {
      // Replace optimistic update with real one
      queryClient.setQueryData<ProgressUpdateWithComments[]>(
        taskProgressKeys.task(variables.taskId),
        (old = []) => old.map((update) =>
          update.id.startsWith('temp-')
            ? { ...data, comments: [], commentCount: 0 }
            : update
        )
      )
      // Refetch by-date to ensure correct grouping
      queryClient.invalidateQueries({
        queryKey: taskProgressKeys.byDate(variables.taskId),
      })
    },
  })
}

/**
 * Add a comment to an existing progress update
 */
export function useAddProgressComment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ progressId, taskId, senderId, content }: {
      progressId: string
      taskId: string
      senderId: string
      content: string
      sender?: UserBasic
    }) => addProgressComment(progressId, taskId, senderId, content),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({
        queryKey: taskProgressKeys.task(variables.taskId),
      })

      const previousProgress = queryClient.getQueryData<ProgressUpdateWithComments[]>(
        taskProgressKeys.task(variables.taskId)
      )

      // Optimistically add comment to the progress update
      const optimisticComment: TaskMessageWithSender = {
        id: `temp-${Date.now()}`,
        task_id: variables.taskId,
        sender_id: variables.senderId,
        message: variables.content,
        content: variables.content,
        type: 'progress',
        file_url: null,
        file_name: null,
        file_size: null,
        file_type: null,
        reply_to_id: variables.progressId,
        is_deleted: false,
        created_at: new Date().toISOString(),
        sender: variables.sender || null,
        reactions: [],
      }

      queryClient.setQueryData<ProgressUpdateWithComments[]>(
        taskProgressKeys.task(variables.taskId),
        (old = []) => old.map((update) => {
          if (update.id !== variables.progressId) return update
          return {
            ...update,
            comments: [...update.comments, optimisticComment],
            commentCount: update.commentCount + 1,
          }
        })
      )

      queryClient.invalidateQueries({
        queryKey: taskProgressKeys.byDate(variables.taskId),
      })

      return { previousProgress }
    },
    onError: (error, variables, context) => {
      if (context?.previousProgress) {
        queryClient.setQueryData(
          taskProgressKeys.task(variables.taskId),
          context.previousProgress
        )
      }
      toast.error(getErrorMessage(error, 'Failed to add comment'))
    },
    onSuccess: (data, variables) => {
      // Replace optimistic comment with real one
      queryClient.setQueryData<ProgressUpdateWithComments[]>(
        taskProgressKeys.task(variables.taskId),
        (old = []) => old.map((update) => {
          if (update.id !== variables.progressId) return update
          return {
            ...update,
            comments: update.comments.map((c) =>
              c.id.startsWith('temp-') ? data : c
            ),
          }
        })
      )
      queryClient.invalidateQueries({
        queryKey: taskProgressKeys.byDate(variables.taskId),
      })
    },
  })
}

/**
 * Realtime subscription for task progress updates
 */
export function useTaskProgressRealtime(taskId: string | undefined) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!taskId) return

    const channel = supabase
      .channel(CHANNELS.TASK_PROGRESS(taskId))
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'task_messages',
          filter: `task_id=eq.${taskId}`,
        },
        async (payload: { new: TaskMessage }) => {
          // Only handle progress type messages
          if ((payload.new as TaskMessage & { type?: string }).type !== 'progress') return

          // Fetch sender info for the new message
          const { data: sender } = await supabase
            .from('users')
            .select('id, name, email, level, avatar_url')
            .eq('id', payload.new.sender_id)
            .single()

          const newMessage: TaskMessageWithSender = {
            ...(payload.new as TaskMessage),
            sender: sender as UserBasic | null,
            reactions: [],
          }

          // Check if this is a comment (has reply_to_id) or a root progress update
          if (newMessage.reply_to_id) {
            // Add comment to existing progress update
            queryClient.setQueryData<ProgressUpdateWithComments[]>(
              taskProgressKeys.task(taskId),
              (old = []) => {
                const exists = old.some(u =>
                  u.comments.some(c => c.id === newMessage.id || c.id.startsWith('temp-'))
                )
                if (exists) {
                  // Replace temp comment
                  return old.map(update => ({
                    ...update,
                    comments: update.comments.map(c =>
                      c.id.startsWith('temp-') && c.sender_id === newMessage.sender_id
                        ? newMessage
                        : c
                    )
                  }))
                }
                // Add new comment
                return old.map(update => {
                  if (update.id !== newMessage.reply_to_id) return update
                  return {
                    ...update,
                    comments: [...update.comments, newMessage],
                    commentCount: update.commentCount + 1,
                  }
                })
              }
            )
          } else {
            // Add new progress update
            queryClient.setQueryData<ProgressUpdateWithComments[]>(
              taskProgressKeys.task(taskId),
              (old = []) => {
                const exists = old.some(
                  (u) => u.id === newMessage.id || (u.id.startsWith('temp-') && u.sender_id === newMessage.sender_id)
                )
                if (exists) {
                  // Replace temp update with real one
                  return old.map((u) =>
                    u.id.startsWith('temp-') && u.sender_id === newMessage.sender_id
                      ? { ...newMessage, comments: [], commentCount: 0 }
                      : u
                  )
                }
                return [...old, { ...newMessage, comments: [], commentCount: 0 }]
              }
            )
          }

          // Invalidate by-date query for re-grouping
          queryClient.invalidateQueries({
            queryKey: taskProgressKeys.byDate(taskId),
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [taskId, queryClient])
}
