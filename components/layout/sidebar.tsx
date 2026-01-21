'use client'

import { useAuth } from '@/lib/auth-context'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import {
    ListTodo,
    Users,
    Settings,
    LogOut,
    Menu,
    Eye,
    X,
    MessageSquare
} from 'lucide-react'
import { getLevelLabel } from '@/lib/services/users'
import { useState } from 'react'

interface SidebarProps {
    className?: string
}

// Navigation - Tasks and Messages
const navigation = [
    { name: 'Messages', href: '/', icon: MessageSquare },
    { name: 'Tasks', href: '/tasks', icon: ListTodo },
]

// Admin-only navigation
const adminNavigation = [
    { name: 'Users', href: '/admin/users', icon: Users },
]

function NavItems({ onClick }: { onClick?: () => void }) {
    const pathname = usePathname()
    const { profile } = useAuth()

    return (
        <nav className="flex-1 px-3 py-4 space-y-1">
            {navigation.map((item) => {
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

            {profile?.is_admin && (
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
    const { profile, maskedAsUser, maskAs, signOut } = useAuth()
    const router = useRouter()

    const handleSignOut = async () => {
        await signOut()
        router.push('/login')
    }

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

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        className="w-full justify-start gap-3 px-2 py-6 hover:bg-muted"
                    >
                        <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                                {displayUser?.name?.charAt(0).toUpperCase() || 'U'}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 text-left">
                            <p className="text-sm font-medium text-foreground truncate">
                                {displayUser?.name}
                            </p>
                            <div className="flex items-center gap-2">
                                <p className="text-xs text-muted-foreground truncate">
                                    {displayUser?.email}
                                </p>
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                    {getLevelLabel(displayUser?.level || 4)}
                                </Badge>
                            </div>
                        </div>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>My Account</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => router.push('/settings')}>
                        <Settings className="mr-2 h-4 w-4" />
                        Settings
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                        <LogOut className="mr-2 h-4 w-4" />
                        Sign Out
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
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
