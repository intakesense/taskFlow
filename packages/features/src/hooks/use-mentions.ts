'use client';

import { useState, useCallback } from 'react';
import type { User } from '@taskflow/core';

/**
 * Manages @mention detection, user filtering, and text insertion.
 */
export function useMentions({
  value,
  onChange,
  users,
  inputRef,
}: {
  value: string;
  onChange: (value: string) => void;
  users: User[];
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);

  const mentionPopupOpen = mentionQuery !== null;

  // Derive filtered users inline
  const filteredUsers = (() => {
    if (mentionQuery === null) return [] as User[];
    if (mentionQuery === '') return users;
    const q = mentionQuery.toLowerCase();
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  })();

  // Detect an active @-trigger at the end of the text.
  // Only matches @ followed by non-space word chars with no space — once
  // the user types or inserts a space after @, the trigger closes.
  const parseMentionTrigger = (text: string): string | null => {
    const match = text.match(/@([a-zA-Z0-9_]*)$/);
    if (!match) return null;
    return match[1];
  };

  // Called whenever the raw input text changes
  const handleMentionInput = useCallback(
    (newValue: string) => {
      onChange(newValue);
      setMentionQuery(parseMentionTrigger(newValue));
    },
    [onChange]
  );

  // Insert the selected user's name, replacing the @query fragment.
  // Reads the live input value from the DOM so it's never stale.
  const selectMention = useCallback(
    (user: User) => {
      const live = inputRef.current?.value ?? value;
      const match = live.match(/@([a-zA-Z0-9_]*)$/);
      const before = match ? live.slice(0, live.length - match[0].length) : live;
      const next = before + '@' + user.name + ' ';
      onChange(next);
      setMentionQuery(null);
      // Restore focus after React re-renders
      requestAnimationFrame(() => inputRef.current?.focus());
    },
    [value, onChange, inputRef]
  );

  const closeMentionPopup = useCallback(() => {
    setMentionQuery(null);
  }, []);

  return {
    mentionPopupOpen,
    filteredUsers,
    handleMentionInput,
    selectMention,
    closeMentionPopup,
  };
}
