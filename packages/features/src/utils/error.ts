/**
 * Error utilities for consistent error handling
 */

/**
 * Log an error with context
 */
export function logError(context: string, error: unknown): void {
  console.error(`[${context}]`, error);
}

/**
 * Get a user-friendly error message from an error
 */
export function getErrorMessage(error: unknown, fallback: string = 'An error occurred'): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return fallback;
}

/**
 * Handle an error by logging and returning a user-friendly message
 */
export function handleError(
  context: string,
  error: unknown,
  fallback: string = 'An error occurred'
): string {
  logError(context, error);
  return getErrorMessage(error, fallback);
}
