import { Plus, Search, X, ClipboardList, UserCheck, PenLine, Users2 } from 'lucide-react';
import { Button, Input, cn } from '@taskflow/ui';
import type { User, TaskWithUsers, TaskStatus } from '@taskflow/core';
import { EmployeeCard } from './employee-card';
import type { FilterType } from './types';

const BOT_USER_ID = '00000000-0000-0000-0000-000000000001';

interface TeamViewProps {
  users: User[];
  tasksByAssignee: Map<string, TaskWithUsers[]>;
  isLoading: boolean;
  searchQuery: string;
  statusFilter: TaskStatus | 'all';
  typeFilter: FilterType;
  onSearchChange: (query: string) => void;
  onStatusFilterChange: (status: TaskStatus | 'all') => void;
  onTypeFilterChange: (type: FilterType) => void;
  currentUserId?: string;
  onCreateTask?: (userId?: string) => void;
  renderProgressFeed?: () => React.ReactNode;
}

const TYPE_OPTIONS: { value: FilterType; icon: typeof ClipboardList; label: string; short: string }[] = [
  { value: 'all', icon: ClipboardList, label: 'All Tasks', short: 'All' },
  { value: 'created', icon: PenLine, label: 'Created', short: 'Created' },
  { value: 'assigned', icon: UserCheck, label: 'Assigned', short: 'Assigned' },
  { value: 'team', icon: Users2, label: 'Team', short: 'Team' },
];

const STATUS_OPTIONS: { value: TaskStatus | 'all'; label: string; dot?: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending', dot: 'bg-amber-500' },
  { value: 'in_progress', label: 'In Progress', dot: 'bg-blue-500' },
];

export function TeamView({
  users,
  tasksByAssignee,
  isLoading,
  searchQuery,
  statusFilter,
  typeFilter,
  onSearchChange,
  onStatusFilterChange,
  onTypeFilterChange,
  currentUserId,
  onCreateTask,
  renderProgressFeed,
}: TeamViewProps) {
  const filteredUsers = users.filter((user) => {
    if (user.id === BOT_USER_ID) return false;
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return user.name.toLowerCase().includes(query);
  });

  const getFilteredTasks = (userId: string): TaskWithUsers[] => {
    const tasks = tasksByAssignee.get(userId) || [];
    if (statusFilter === 'all') return tasks;
    return tasks.filter((t) => t.status === statusFilter);
  };

  const displayUsers =
    statusFilter === 'all'
      ? filteredUsers
      : filteredUsers.filter((user) => getFilteredTasks(user.id).length > 0);

  const handleAssignTask = (userId: string) => {
    onCreateTask?.(userId);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b bg-card sticky top-0 z-10 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Tasks</h1>
          <div className="flex items-center gap-2">
            {renderProgressFeed?.()}
            {onCreateTask && (
              <Button size="icon" onClick={() => onCreateTask()} className="h-9 w-9 rounded-full">
                <Plus className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1 rounded-lg bg-muted p-1">
          {TYPE_OPTIONS.map(({ value, icon: Icon, label, short }) => (
            <button
              key={value}
              onClick={() => onTypeFilterChange(value)}
              className={cn(
                'flex items-center justify-center gap-1.5 px-2 py-2 rounded-md text-xs font-medium transition-all',
                typeFilter === value
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{short}</span>
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search team..."
              className="pl-9 rounded-full bg-muted/50 border-0 focus-visible:ring-1 h-9"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-shrink-0 max-w-[55%]">
            {STATUS_OPTIONS.map(({ value, label, dot }) => (
              <button
                key={value}
                onClick={() => onStatusFilterChange(value)}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-all',
                  statusFilter === value
                    ? 'bg-foreground/10 border-foreground/20 text-foreground'
                    : 'bg-transparent border-border text-muted-foreground hover:text-foreground hover:border-foreground/20'
                )}
              >
                {dot && <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dot)} />}
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : displayUsers.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">👥</div>
            <h3 className="text-lg font-semibold mb-2">
              {searchQuery ? 'No team members found' : 'No team members'}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchQuery
                ? `No one matches "${searchQuery}"`
                : "You don't have any team members at your level or below."}
            </p>
            {searchQuery && (
              <Button variant="outline" onClick={() => onSearchChange('')} className="rounded-full">
                Clear Search
              </Button>
            )}
          </div>
        ) : (
          displayUsers.map((user) => (
            <EmployeeCard
              key={user.id}
              user={user}
              tasks={getFilteredTasks(user.id)}
              isSelf={user.id === currentUserId}
              onAssignTask={handleAssignTask}
            />
          ))
        )}
      </div>
    </div>
  );
}
