// Async state management hook - eliminates manual loading/error state
import { useState, useCallback } from 'react'
import { toast } from 'sonner'

interface UseAsyncState<T> {
  data: T | null
  loading: boolean
  error: Error | null
}

interface UseAsyncReturn<T, Args extends any[]> extends UseAsyncState<T> {
  execute: (...args: Args) => Promise<T | null>
  reset: () => void
}

interface UseAsyncOptions {
  onSuccess?: (data: any) => void
  onError?: (error: Error) => void
  successMessage?: string
  errorMessage?: string
  showToast?: boolean
}

/**
 * Hook for managing async operations with loading/error/success states
 * Automatically shows toast notifications
 *
 * @example
 * const deleteTask = useAsync(deleteTaskApi, {
 *   successMessage: 'Task deleted',
 *   onSuccess: () => router.push('/tasks')
 * })
 *
 * <Button onClick={() => deleteTask.execute(taskId)} disabled={deleteTask.loading}>
 *   {deleteTask.loading ? 'Deleting...' : 'Delete'}
 * </Button>
 */
export function useAsync<T, Args extends any[]>(
  asyncFunction: (...args: Args) => Promise<T>,
  options: UseAsyncOptions = {}
): UseAsyncReturn<T, Args> {
  const {
    onSuccess,
    onError,
    successMessage,
    errorMessage = 'An error occurred',
    showToast = true,
  } = options

  const [state, setState] = useState<UseAsyncState<T>>({
    data: null,
    loading: false,
    error: null,
  })

  const execute = useCallback(
    async (...args: Args): Promise<T | null> => {
      setState({ data: null, loading: true, error: null })

      try {
        const result = await asyncFunction(...args)
        setState({ data: result, loading: false, error: null })

        if (showToast && successMessage) {
          toast.success(successMessage)
        }

        onSuccess?.(result)
        return result
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error')
        setState({ data: null, loading: false, error })

        if (showToast) {
          toast.error(errorMessage)
        }

        onError?.(error)
        return null
      }
    },
    [asyncFunction, onSuccess, onError, successMessage, errorMessage, showToast]
  )

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null })
  }, [])

  return {
    ...state,
    execute,
    reset,
  }
}
