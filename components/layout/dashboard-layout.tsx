'use client'

import { Sidebar, MobileNav } from '@/components/layout/sidebar'
import { useAuth } from '@/lib/auth-context'
import { Loader2 } from 'lucide-react'

interface DashboardLayoutProps {
    children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
    const { loading } = useAuth()

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
            <Sidebar />

            {/* Mobile header */}
            <div className="lg:hidden fixed top-0 left-0 right-0 z-40 px-4 py-3 bg-card/95 backdrop-blur-xl border-b border-border">
                <div className="flex items-center justify-between">
                    <MobileNav />
                    <h1 className="text-lg font-bold text-foreground">TaskFlow</h1>
                    <div className="w-10" /> {/* Spacer for centering */}
                </div>
            </div>

            {/* Main content */}
            <main className="lg:pl-64">
                <div className="min-h-screen pt-16 lg:pt-0">
                    {children}
                </div>
            </main>
        </div>
    )
}
