'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth-context'
import {
    MessageSquare,
    ListTodo,
    Settings,
    Users,
} from 'lucide-react'

interface NavItem {
    name: string
    href: string
    icon: React.ElementType
    adminOnly?: boolean
}

const navItems: NavItem[] = [
    { name: 'Messages', href: '/', icon: MessageSquare },
    { name: 'Tasks', href: '/tasks', icon: ListTodo },
    { name: 'Users', href: '/admin/users', icon: Users, adminOnly: true },
    { name: 'Settings', href: '/settings', icon: Settings },
]

export function BottomNav() {
    const pathname = usePathname()
    const { profile } = useAuth()

    // Filter items based on admin status
    const visibleItems = navItems.filter(item => !item.adminOnly || profile?.is_admin)

    return (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border safe-area-bottom">
            <div className="flex items-center justify-around h-16">
                {visibleItems.map((item) => {
                    // Check if current path matches the nav item
                    const isActive = item.href === '/'
                        ? pathname === '/'
                        : pathname === item.href || pathname.startsWith(item.href + '/')

                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                'flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all min-w-[64px]',
                                'active:scale-95',
                                isActive
                                    ? 'text-primary'
                                    : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            <item.icon
                                className={cn(
                                    'h-5 w-5 transition-all',
                                    isActive && 'scale-110'
                                )}
                            />
                            <span
                                className={cn(
                                    'text-[10px] font-medium transition-all',
                                    isActive && 'font-semibold'
                                )}
                            >
                                {item.name}
                            </span>
                        </Link>
                    )
                })}
            </div>
        </nav>
    )
}
