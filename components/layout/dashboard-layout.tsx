'use client'

import { Sidebar } from '@/components/layout/sidebar'
import { BottomNav } from '@/components/layout/bottom-nav'
import { BottomNavProvider, useBottomNavVisibility } from '@/components/layout/bottom-nav-context'

interface DashboardLayoutProps {
    children: React.ReactNode
}

function DashboardLayoutContent({ children }: DashboardLayoutProps) {
    const { visible: bottomNavVisible } = useBottomNavVisibility()

    // NOTE: Server components handle auth redirect, no need for client-side loading check
    // Auth providers persist across routes, so auth state is already available

    return (
        <div className="h-[100dvh] bg-background overflow-hidden">
            {/* Desktop Sidebar */}
            <Sidebar />

            {/* Main content */}
            <main className={`lg:pl-64 h-full ${bottomNavVisible ? 'pb-16 lg:pb-0' : ''}`}>
                {children}
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
