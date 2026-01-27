'use client'

import { Sidebar } from '@/components/layout/sidebar'
import { BottomNav } from '@/components/layout/bottom-nav'
import { BottomNavProvider, useBottomNavVisibility } from '@/components/layout/bottom-nav-context'
import { useAuth } from '@/lib/auth-context'
import { Loader2 } from 'lucide-react'

interface DashboardLayoutProps {
    children: React.ReactNode
}

function DashboardLayoutContent({ children }: DashboardLayoutProps) {
    const { loading } = useAuth()
    const { visible: bottomNavVisible } = useBottomNavVisibility()

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-muted-foreground">Loading...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Desktop Sidebar */}
            <Sidebar />

            {/* Main content */}
            <main className="lg:pl-64">
                {/* Add padding-bottom for mobile bottom nav only when visible */}
                <div className={`min-h-screen ${bottomNavVisible ? 'pb-16' : 'pb-0'} lg:pb-0`}>
                    {children}
                </div>
            </main>

            {/* Mobile Bottom Navigation - hidden when in chat */}
            {bottomNavVisible && <BottomNav />}
        </div>
    )
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
    return (
        <BottomNavProvider>
            <DashboardLayoutContent>{children}</DashboardLayoutContent>
        </BottomNavProvider>
    )
}
