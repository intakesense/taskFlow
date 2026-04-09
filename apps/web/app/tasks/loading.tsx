import { Skeleton } from '@/components/ui/skeleton'
import { DashboardLayout } from '@/components/layout'

function TaskCardSkeleton() {
    return (
        <div className="p-4 border rounded-lg space-y-3">
            <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                </div>
                <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <div className="flex items-center gap-3 pt-2">
                <Skeleton className="h-6 w-6 rounded-full" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
            </div>
        </div>
    )
}

export default function TasksLoading() {
    return (
        <DashboardLayout>
            <div className="flex flex-col h-full p-4 md:p-6 space-y-6">
                {/* Header skeleton */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="space-y-1">
                        <Skeleton className="h-8 w-32" />
                        <Skeleton className="h-4 w-48" />
                    </div>
                    <Skeleton className="h-10 w-32 rounded-md" />
                </div>

                {/* Filters skeleton */}
                <div className="flex flex-wrap items-center gap-3">
                    <Skeleton className="h-9 w-64 rounded-md" />
                    <Skeleton className="h-9 w-32 rounded-md" />
                    <Skeleton className="h-9 w-28 rounded-md" />
                </div>

                {/* Task list skeleton */}
                <div className="grid gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <TaskCardSkeleton key={i} />
                    ))}
                </div>
            </div>
        </DashboardLayout>
    )
}
