'use client'

import { ReactNode } from 'react'
import { ErrorBoundary as ReactErrorBoundary, FallbackProps } from 'react-error-boundary'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
  return (
    <div className="flex items-center justify-center min-h-[400px] p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <CardTitle>Something went wrong</CardTitle>
          </div>
          <CardDescription>
            An error occurred while loading this section
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted p-3 rounded-md">
            <p className="text-sm font-mono text-muted-foreground break-all">
              {errorMessage}
            </p>
          </div>
          <Button onClick={resetErrorBoundary} className="w-full">
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

export function ErrorBoundary({ children, fallback }: ErrorBoundaryProps) {
  return (
    <ReactErrorBoundary
      FallbackComponent={fallback ? () => <>{fallback}</> : ErrorFallback}
      onError={(error, errorInfo) => {
        // Log to console for debugging
        console.error('Error boundary caught an error:', error, errorInfo)
      }}
      onReset={() => {
        // Reset app state if needed
        window.location.reload()
      }}
    >
      {children}
    </ReactErrorBoundary>
  )
}

// Lightweight error boundary for smaller sections
export function SectionErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ReactErrorBoundary
      fallback={
        <div className="p-4 bg-muted rounded-md">
          <p className="text-sm text-muted-foreground">
            Failed to load this section. Please refresh the page.
          </p>
        </div>
      }
      onError={(error) => {
        console.error('Section error:', error)
      }}
    >
      {children}
    </ReactErrorBoundary>
  )
}
