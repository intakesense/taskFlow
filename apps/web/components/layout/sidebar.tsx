'use client'

import { useAuth } from '@/lib/auth-context'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import {
    ListTodo,
    Users,
    Menu,
    Eye,
    X,
    MessageSquare,
    Headphones
} from 'lucide-react'
import { getLevelLabel } from '@/lib/services/users'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { voiceChannelService } from '@/lib/services/voice-channels'
import { useVoiceParticipantCount } from '@/hooks/use-voice-participants'

interface SidebarProps {
    className?: string
}

// Navigation - Tasks, Messages, and ChitChat
const navigation = [
    { name: 'Tasks', href: '/tasks', icon: ListTodo, showBadge: false },
    { name: 'Messages', href: '/chat', icon: MessageSquare, showBadge: false },
    { name: 'ChitChat', href: '/chitchat', icon: Headphones, showBadge: true },
]

// Admin-only navigation
const adminNavigation = [
    { name: 'Users', href: '/admin/users', icon: Users },
]

function NavItems({ onClick }: { onClick?: () => void }) {
    const pathname = usePathname()
    const { effectiveUser } = useAuth()

    // Get default voice channel for badge
    const { data: defaultChannel } = useQuery({
        queryKey: ['voice-channel', 'default'],
        queryFn: () => voiceChannelService.getDefaultChannel(),
    })

    const participantCount = useVoiceParticipantCount(defaultChannel?.id || null)

    return (
        <nav className="flex-1 px-3 py-4 space-y-1">
            {navigation.map((item) => {
                // Tasks (/tasks) is also active when on root (/)
                const isActive = item.href === '/tasks'
                    ? pathname === '/' || pathname === '/tasks' || pathname.startsWith('/tasks/')
                    : pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                    <Link
                        key={item.name}
                        href={item.href}
                        onClick={onClick}
                        className={cn(
                            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                            isActive
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        )}
                    >
                        <item.icon className="h-5 w-5" />
                        {item.name}
                        {item.showBadge && participantCount > 0 && (
                            <Badge
                                variant={isActive ? 'secondary' : 'default'}
                                className="ml-auto h-5 min-w-5 flex items-center justify-center px-1.5"
                            >
                                {participantCount}
                            </Badge>
                        )}
                    </Link>
                )
            })}

            {effectiveUser?.is_admin && (
                <>
                    <div className="pt-4 pb-2">
                        <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Admin
                        </p>
                    </div>
                    {adminNavigation.map((item) => {
                        const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                onClick={onClick}
                                className={cn(
                                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                                    isActive
                                        ? 'bg-primary text-primary-foreground'
                                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                )}
                            >
                                <item.icon className="h-5 w-5" />
                                {item.name}
                            </Link>
                        )
                    })}
                </>
            )}
        </nav>
    )
}

function UserMenu() {
    const { profile, maskedAsUser, maskAs } = useAuth()

    const displayUser = maskedAsUser || profile

    return (
        <div className="p-3 border-t border-border">
            {maskedAsUser && (
                <div className="mb-2 p-2 bg-amber-500/20 border border-amber-500/30 rounded-lg">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-amber-300 text-xs">
                            <Eye className="h-3 w-3" />
                            <span>Viewing as {maskedAsUser.name}</span>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-amber-300 hover:text-amber-200"
                            onClick={() => maskAs(null)}
                        >
                            <X className="h-3 w-3" />
                        </Button>
                    </div>
                </div>
            )}

            <Link
                href="/settings"
                className="flex items-center gap-3 px-2 py-3 rounded-lg hover:bg-muted transition-colors"
            >
                <Avatar className="h-9 w-9">
                    {displayUser?.avatar_url && (
                        <AvatarImage src={displayUser.avatar_url} alt={displayUser.name || 'Avatar'} />
                    )}
                    <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                        {displayUser?.name?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                        {displayUser?.name}
                    </p>
                    <div className="flex items-center gap-2">
                        <p className="text-xs text-muted-foreground truncate">
                            {displayUser?.email}
                        </p>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                            {getLevelLabel(displayUser?.level || 4)}
                        </Badge>
                    </div>
                </div>
            </Link>
        </div>
    )
}

export function Sidebar({ className }: SidebarProps) {
    return (
        <aside
            className={cn(
                'hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-card border-r border-border',
                className
            )}
        >
            {/* Logo */}
            <div className="flex items-center gap-3 px-6 py-5 border-b border-border">
                <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                    <ListTodo className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                    <h1 className="text-lg font-bold text-foreground">TaskFlow</h1>
                    <p className="text-xs text-muted-foreground">Task Management</p>
                </div>
            </div>

            <NavItems />
            <UserMenu />
        </aside>
    )
}

export function MobileNav() {
    const [open, setOpen] = useState(false)

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                    <Menu className="h-6 w-6" />
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 bg-card border-r border-border">
                {/* Logo */}
                <div className="flex items-center gap-3 px-6 py-5 border-b border-border">
                    <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                        <ListTodo className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-foreground">TaskFlow</h1>
                        <p className="text-xs text-muted-foreground">Task Management</p>
                    </div>
                </div>

                <NavItems onClick={() => setOpen(false)} />
                <UserMenu />
            </SheetContent>
        </Sheet>
    )
}
