'use client'

import { useMemo } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { m, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth-context'
import { navIconVariants, springs } from '@/lib/animations'
import {
    MessageSquare,
    ListTodo,
    Users,
    Headphones,
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
    { name: 'ChitChat', href: '/chitchat', icon: Headphones },
    { name: 'Tasks', href: '/tasks', icon: ListTodo },
    { name: 'Users', href: '/admin/users', icon: Users, adminOnly: true },
]

export function BottomNav() {
    const pathname = usePathname()
    const { profile, maskedAsUser } = useAuth()
    const prefersReducedMotion = useReducedMotion()

    // Filter items based on admin status
    const visibleItems = navItems.filter(item => !item.adminOnly || profile?.is_admin)

    const displayUser = maskedAsUser || profile
    const isSettingsActive = pathname === '/settings'

    // Calculate active index for indicator
    const activeIndex = useMemo(() => {
        const navIndex = visibleItems.findIndex(item =>
            item.href === '/'
                ? pathname === '/'
                : pathname === item.href || pathname.startsWith(item.href + '/')
        )
        if (navIndex !== -1) return navIndex
        if (isSettingsActive) return visibleItems.length // Profile is last
        return -1
    }, [pathname, visibleItems, isSettingsActive])

    const totalItems = visibleItems.length + 1 // +1 for profile

    return (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border safe-area-bottom">
            <div className="relative flex items-center justify-around h-16">
                {/* Sliding indicator */}
                {activeIndex >= 0 && !prefersReducedMotion && (
                    <m.div
                        className="absolute top-0 h-0.5 bg-primary rounded-full"
                        initial={false}
                        animate={{
                            left: `${(activeIndex / totalItems) * 100 + (50 / totalItems)}%`,
                            width: 32,
                        }}
                        transition={springs.fast}
                        style={{ translateX: '-50%' }}
                    />
                )}

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
                                'flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[64px]',
                                isActive
                                    ? 'text-primary'
                                    : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            <m.div
                                variants={prefersReducedMotion ? undefined : navIconVariants}
                                animate={isActive ? 'active' : 'inactive'}
                            >
                                <item.icon className="h-5 w-5" />
                            </m.div>
                            <span
                                className={cn(
                                    'text-[10px] font-medium transition-colors',
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
                        'flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[64px]'
                    )}
                >
                    <m.div
                        variants={prefersReducedMotion ? undefined : navIconVariants}
                        animate={isSettingsActive ? 'active' : 'inactive'}
                        className={cn(
                            'h-6 w-6 rounded-full overflow-hidden flex items-center justify-center',
                            isSettingsActive
                                ? 'ring-2 ring-primary ring-offset-1 ring-offset-card'
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
                    </m.div>
                    <span
                        className={cn(
                            'text-[10px] font-medium transition-colors',
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
