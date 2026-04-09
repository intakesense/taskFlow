'use client';

import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Textarea,
} from '@taskflow/ui';

interface OnHoldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  taskTitle?: string;
}

export function OnHoldDialog({
  open,
  onOpenChange,
  onConfirm,
  taskTitle,
}: OnHoldDialogProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const handleConfirm = () => {
    if (!reason.trim()) {
      setError('Please provide a reason for putting this task on hold');
      return;
    }
    onConfirm(reason.trim());
    setReason('');
    setError('');
  };

  const handleCancel = () => {
    setReason('');
    setError('');
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Put Task On Hold</AlertDialogTitle>
          <AlertDialogDescription>
            {taskTitle ? (
              <>Please provide a reason for putting &quot;{taskTitle}&quot; on hold.</>
            ) : (
              <>Please provide a reason for putting this task on hold.</>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-4">
          <Textarea
            placeholder="e.g., Waiting for client feedback, Blocked by dependencies..."
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError('');
            }}
            className="min-h-[100px]"
          />
          {error && (
            <p className="text-sm text-destructive mt-2">{error}</p>
          )}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>
            Put On Hold
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
