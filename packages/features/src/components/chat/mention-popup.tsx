'use client';

import { useEffect, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@taskflow/ui';
import { cn } from '@taskflow/ui';
import { getLevelLabel } from '../../services/users';
import type { User } from '@taskflow/core';

interface MentionPopupProps {
  users: User[];
  open: boolean;
  /** Index of the currently highlighted item (driven by parent for keyboard nav) */
  activeIndex: number;
  onSelect: (user: User) => void;
  /** Called when popup should close (click outside, escape key) */
  onClose: () => void;
  className?: string;
}

export function MentionPopup({
  users,
  open,
  activeIndex,
  onSelect,
  onClose,
  className,
}: MentionPopupProps) {
  const activeRef = useRef<HTMLLIElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // Delay adding listener to avoid immediate trigger
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open, onClose]);

  // Scroll active item into view whenever it changes
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (!open || users.length === 0) return null;

  return (
    <div
      ref={popupRef}
      className={cn(
        'absolute bottom-full left-0 mb-2 w-64 max-h-56 rounded-lg border bg-popover shadow-lg z-50 overflow-hidden',
        className
      )}
    >
      <ul className="overflow-y-auto max-h-56 py-1" role="listbox">
        {users.map((user, index) => (
          <li
            key={user.id}
            ref={index === activeIndex ? activeRef : undefined}
            role="option"
            aria-selected={index === activeIndex}
            className={cn(
              'flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors',
              index === activeIndex ? 'bg-muted' : 'hover:bg-muted/50'
            )}
            onClick={() => onSelect(user)}
          >
            <Avatar className="h-8 w-8 flex-shrink-0">
              {user.avatar_url && (
                <AvatarImage src={user.avatar_url} alt={user.name} />
              )}
              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                {user.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{user.name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {getLevelLabel(user.level)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
