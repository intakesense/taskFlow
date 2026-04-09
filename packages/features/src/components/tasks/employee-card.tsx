'use client';

import { useState } from 'react';
import { Plus, ChevronDown } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage, Button, cn } from '@taskflow/ui';
import { EMPLOYEE_LEVEL_COLORS, type User, type TaskWithUsers } from '@taskflow/core';
import { TaskMiniCard } from './task-mini-card';

interface EmployeeCardProps {
  user: User;
  tasks: TaskWithUsers[];
  isSelf: boolean;
  onAssignTask: (userId: string) => void;
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function EmployeeCard({ user, tasks, isSelf, onAssignTask }: EmployeeCardProps) {
  const [expanded, setExpanded] = useState(false);
  const taskCount = tasks.length;

  return (
    <div className="bg-card rounded-xl border overflow-hidden">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpanded(!expanded);
          }
        }}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer"
      >
        <Avatar className="h-9 w-9 flex-shrink-0">
          {user.avatar_url && <AvatarImage src={user.avatar_url} alt={user.name} />}
          <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
            {getInitials(user.name)}
          </AvatarFallback>
        </Avatar>

        <span className="flex-1 text-left font-medium truncate">
          {user.name}
          {isSelf && <span className="text-muted-foreground font-normal"> (You)</span>}
        </span>

        <span className="text-sm text-muted-foreground tabular-nums">
          {taskCount} {taskCount === 1 ? 'task' : 'tasks'}
        </span>

        <span
          className={cn(
            'px-1.5 py-0.5 rounded text-[10px] font-semibold text-white',
            EMPLOYEE_LEVEL_COLORS[user.level] || 'bg-gray-500'
          )}
        >
          L{user.level}
        </span>

        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'h-8 w-8 rounded-full flex-shrink-0',
            isSelf && 'opacity-30 cursor-not-allowed'
          )}
          disabled={isSelf}
          onClick={(e) => {
            e.stopPropagation();
            if (!isSelf) onAssignTask(user.id);
          }}
          aria-label={isSelf ? 'Cannot assign to self' : `Assign task to ${user.name}`}
        >
          <Plus className="h-4 w-4" />
        </Button>

        <ChevronDown
          className={cn(
            'h-4 w-4 text-muted-foreground transition-transform flex-shrink-0',
            expanded && 'rotate-180'
          )}
        />
      </div>

      {expanded && (
        <div className="px-4 pb-3 space-y-2 border-t bg-muted/30">
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3 text-center">No active tasks</p>
          ) : (
            <div className="pt-3 space-y-2">
              {tasks.map((task) => (
                <TaskMiniCard key={task.id} task={task} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
