// Centralized error handling utilities
// Simple, practical approach: log to console + extract user-friendly message

// Types for Supabase/PostgrestError
interface SupabaseError {
  code?: string
  message?: string
  details?: string
  hint?: string
}

/**
 * Log error with full context to console
 * Extracts Supabase-specific fields (code, details, hint) for debugging
 */
export function logError(context: string, error: unknown): void {
  console.error(`[Error] ${context}:`, error)

  if (error && typeof error === 'object') {
    const e = error as SupabaseError
    // Only log Supabase fields if they exist
    if (e.code || e.details || e.hint) {
      console.error(`  Code: ${e.code}`)
      console.error(`  Message: ${e.message}`)
      console.error(`  Details: ${e.details}`)
      console.error(`  Hint: ${e.hint}`)
    }
  }
}

/**
 * Extract user-friendly message from any error type
 */
export function getErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (error instanceof Error) {
    return error.message
  }
  if (error && typeof error === 'object') {
    const e = error as SupabaseError
    if (e.message) return e.message
  }
  return fallback
}

/**
 * Combined helper: log error + return user-friendly message
 * Most common use case for catch blocks
 */
export function handleError(context: string, error: unknown, fallback?: string): string {
  logError(context, error)
  return getErrorMessage(error, fallback)
}
