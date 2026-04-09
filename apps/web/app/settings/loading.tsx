import { Skeleton } from '@/components/ui/skeleton'
import { DashboardLayout } from '@/components/layout'

export default function SettingsLoading() {
    return (
        <DashboardLayout>
            <div className="flex flex-col h-full p-4 md:p-6 space-y-6 max-w-2xl">
                {/* Header skeleton */}
                <div className="space-y-1">
                    <Skeleton className="h-8 w-32" />
                    <Skeleton className="h-4 w-64" />
                </div>

                {/* Settings sections skeleton */}
                <div className="space-y-8">
                    {/* Profile section */}
                    <div className="space-y-4">
                        <Skeleton className="h-6 w-24" />
                        <div className="flex items-center gap-4">
                            <Skeleton className="h-16 w-16 rounded-full" />
                            <div className="space-y-2">
                                <Skeleton className="h-5 w-40" />
                                <Skeleton className="h-4 w-56" />
                            </div>
                        </div>
                    </div>

                    {/* Appearance section */}
                    <div className="space-y-4">
                        <Skeleton className="h-6 w-28" />
                        <div className="flex items-center justify-between p-4 border rounded-lg">
                            <div className="space-y-1">
                                <Skeleton className="h-5 w-20" />
                                <Skeleton className="h-4 w-48" />
                            </div>
                            <Skeleton className="h-6 w-12 rounded-full" />
                        </div>
                    </div>

                    {/* Notifications section */}
                    <div className="space-y-4">
                        <Skeleton className="h-6 w-28" />
                        <div className="flex items-center justify-between p-4 border rounded-lg">
                            <div className="space-y-1">
                                <Skeleton className="h-5 w-32" />
                                <Skeleton className="h-4 w-56" />
                            </div>
                            <Skeleton className="h-6 w-12 rounded-full" />
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    )
}
