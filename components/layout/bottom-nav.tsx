'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth-context'
import {
    MessageSquare,
    ListTodo,
    Users,
} from 'lucide-react'
import { haptics } from '@/lib/haptics'

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
]

export function BottomNav() {
    const pathname = usePathname()
    const { profile, maskedAsUser } = useAuth()

    // Filter items based on admin status
    const visibleItems = navItems.filter(item => !item.adminOnly || profile?.is_admin)

    const displayUser = maskedAsUser || profile
    const isSettingsActive = pathname === '/settings'

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
                            onClick={() => {
                                // Haptic feedback on navigation
                                if (!isActive) {
                                    haptics.light()
                                }
                            }}
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

                {/* Profile/Settings link with avatar */}
                <Link
                    href="/settings"
                    onClick={() => {
                        if (!isSettingsActive) {
                            haptics.light()
                        }
                    }}
                    className={cn(
                        'flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all min-w-[64px]',
                        'active:scale-95'
                    )}
                >
                    <div
                        className={cn(
                            'h-6 w-6 rounded-full overflow-hidden transition-all flex items-center justify-center',
                            isSettingsActive
                                ? 'ring-2 ring-primary ring-offset-1 ring-offset-card scale-110'
                                : 'ring-1 ring-border'
                        )}
                    >
                        {displayUser?.avatar_url ? (
                            <Image
                                src={displayUser.avatar_url}
                                alt={displayUser.name || 'Profile'}
                                width={24}
                                height={24}
                                className="h-full w-full object-cover"
                            />
                        ) : (
                            <div className="h-full w-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-semibold">
                                {displayUser?.name?.charAt(0).toUpperCase() || 'U'}
                            </div>
                        )}
                    </div>
                    <span
                        className={cn(
                            'text-[10px] font-medium transition-all',
                            isSettingsActive
                                ? 'text-primary font-semibold'
                                : 'text-muted-foreground'
                        )}
                    >
                        Profile
                    </span>
                </Link>
            </div>
        </nav>
    )
}
