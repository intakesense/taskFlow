import { Skeleton } from '@/components/ui/skeleton'
import { DashboardLayout } from '@/components/layout'

function ConversationListSkeleton() {
  return (
    <div className="w-full md:w-80 border-r flex flex-col h-full">
      {/* Header skeleton */}
      <div className="p-4 border-b flex items-center justify-between">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
      
      {/* Search skeleton */}
      <div className="p-3 border-b">
        <Skeleton className="h-9 w-full rounded-md" />
      </div>
      
      {/* Conversation items skeleton */}
      <div className="flex-1 overflow-hidden p-2 space-y-1">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-lg">
            <Skeleton className="h-12 w-12 rounded-full shrink-0" />
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-12" />
              </div>
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ChatAreaSkeleton() {
  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Chat header skeleton */}
      <div className="h-16 border-b flex items-center gap-3 px-4">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      
      {/* Messages area skeleton */}
      <div className="flex-1 p-4 space-y-4 overflow-hidden">
        {/* Received message */}
        <div className="flex gap-2 justify-start">
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />
          <Skeleton className="h-16 w-48 rounded-2xl rounded-tl-sm" />
        </div>
        
        {/* Sent message */}
        <div className="flex gap-2 justify-end">
          <Skeleton className="h-12 w-56 rounded-2xl rounded-tr-sm" />
        </div>
        
        {/* Received message */}
        <div className="flex gap-2 justify-start">
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />
          <Skeleton className="h-20 w-64 rounded-2xl rounded-tl-sm" />
        </div>
        
        {/* Sent message */}
        <div className="flex gap-2 justify-end">
          <Skeleton className="h-10 w-40 rounded-2xl rounded-tr-sm" />
        </div>
      </div>
      
      {/* Input skeleton */}
      <div className="p-4 border-t">
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 flex-1 rounded-full" />
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
      </div>
    </div>
  )
}

export default function MessagesLoading() {
  return (
    <DashboardLayout>
      <div className="flex h-full bg-background">
        {/* Conversation list - hidden on mobile when loading */}
        <div className="hidden md:flex">
          <ConversationListSkeleton />
        </div>
        
        {/* On mobile, show conversation list skeleton */}
        <div className="flex md:hidden w-full">
          <ConversationListSkeleton />
        </div>
        
        {/* Chat area - hidden on mobile */}
        <div className="hidden md:flex flex-1">
          <ChatAreaSkeleton />
        </div>
      </div>
    </DashboardLayout>
  )
}
