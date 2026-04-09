'use client';

// Reusable dialog state management hook
import { useState, useCallback } from 'react';

export interface UseDialogReturn {
  open: boolean;
  openDialog: () => void;
  closeDialog: () => void;
  toggleDialog: () => void;
}

/**
 * Hook for managing dialog/modal open/close state
 * Eliminates repetitive useState for dialogs
 *
 * @example
 * const deleteDialog = useDialog()
 *
 * <Dialog open={deleteDialog.open} onOpenChange={deleteDialog.toggleDialog}>
 *   ...
 * </Dialog>
 */
export function useDialog(defaultOpen = false): UseDialogReturn {
  const [open, setOpen] = useState(defaultOpen);

  const openDialog = useCallback(() => setOpen(true), []);
  const closeDialog = useCallback(() => setOpen(false), []);
  const toggleDialog = useCallback(() => setOpen((prev) => !prev), []);

  return {
    open,
    openDialog,
    closeDialog,
    toggleDialog,
  };
}

/**
 * Hook for managing multiple dialogs
 *
 * @example
 * const dialogs = useDialogs(['edit', 'delete', 'create'])
 *
 * <Dialog open={dialogs.edit.open} onOpenChange={dialogs.edit.toggle}>
 */
export function useDialogs<T extends string>(names: T[]): Record<T, UseDialogReturn> {
  const [states, setStates] = useState<Record<T, boolean>>(
    () => Object.fromEntries(names.map((name) => [name, false])) as Record<T, boolean>
  );

  const createHandlers = useCallback(
    (name: T): UseDialogReturn => ({
      open: states[name],
      openDialog: () => setStates((prev) => ({ ...prev, [name]: true })),
      closeDialog: () => setStates((prev) => ({ ...prev, [name]: false })),
      toggleDialog: () => setStates((prev) => ({ ...prev, [name]: !prev[name] })),
    }),
    [states]
  );

  return Object.fromEntries(names.map((name) => [name, createHandlers(name)])) as Record<
    T,
    UseDialogReturn
  >;
}
