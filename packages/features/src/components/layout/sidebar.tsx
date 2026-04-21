'use client';

import { useState } from 'react';
import {
  cn,
  Button,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@taskflow/ui';
import {
  ListTodo,
  Users,
  Menu,
  Eye,
  X,
  MessageSquare,
  Headphones,
} from 'lucide-react';
import { useNavigation } from '../../providers/navigation-context';
import { useAuth } from '../../providers/auth-context';
import { NavigationLink } from '../primitives/navigation-link';
import { getLevelLabel } from '../../services/users';
import { AttendanceWidget } from '../attendance';

interface SidebarProps {
  className?: string;
}

const navigation = [
  { name: 'Tasks', href: '/tasks', icon: ListTodo },
  { name: 'Messages', href: '/chat', icon: MessageSquare },
  { name: 'ChitChat', href: '/chitchat', icon: Headphones },
];

const adminNavigation = [
  { name: 'Users', href: '/admin/users', icon: Users },
];


function NavItems({ onClick }: { onClick?: () => void }) {
  const { currentPath } = useNavigation();
  const { effectiveUser } = useAuth();

  return (
    <nav className="flex-1 px-3 py-4 space-y-1">
      {navigation.map((item) => {
        const isActive =
          item.href === '/tasks'
            ? currentPath === '/' || currentPath === '/tasks' || currentPath.startsWith('/tasks/')
            : currentPath === item.href || currentPath.startsWith(item.href + '/');

        return (
          <NavigationLink
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
          </NavigationLink>
        );
      })}

      {effectiveUser?.is_admin && (
        <>
          <div className="pt-4 pb-2">
            <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Admin
            </p>
          </div>
          {adminNavigation.map((item) => {
            const isActive = currentPath === item.href || currentPath.startsWith(item.href + '/');
            return (
              <NavigationLink
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
              </NavigationLink>
            );
          })}
        </>
      )}

      {/* Divider + attendance widget */}
      <div className="pt-2 pb-1">
        <div className="border-t border-border" />
      </div>
      <AttendanceWidget />
    </nav>
  );
}

function UserMenu() {
  const { profile, maskedAsUser, maskAs } = useAuth();
  const displayUser = maskedAsUser || profile;

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

      <NavigationLink
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
      </NavigationLink>
    </div>
  );
}

export function Sidebar({ className }: SidebarProps) {
  return (
    <aside
      className={cn(
        'hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-card border-r border-border',
        className
      )}
    >
      <div className="flex items-center gap-3 px-6 py-5 border-b border-border">
        <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0">
          <img src="/logo.png" alt="TaskFlow" width={40} height={40} className="w-full h-full object-cover" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground">TaskFlow</h1>
          <p className="text-xs text-muted-foreground">Task Management</p>
        </div>
      </div>

      <NavItems />
      <UserMenu />
    </aside>
  );
}

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden">
          <Menu className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0 bg-card border-r border-border">
        <div className="flex items-center gap-3 px-6 py-5 border-b border-border">
          <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0">
            <img src="/logo.png" alt="TaskFlow" width={40} height={40} className="w-full h-full object-cover" />
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
  );
}
