'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
  Textarea,
  Label,
} from '@taskflow/ui';
import { LogOut, Loader2, Plus, X } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCheckedOut: () => void;
  getLocation: () => Promise<GeolocationCoordinates | null>;
}

export function CheckoutDialog({ open, onOpenChange, onCheckedOut, getLocation }: Props) {
  const [taskInput, setTaskInput] = useState('');
  const [tasks, setTasks] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const addTask = () => {
    const trimmed = taskInput.trim();
    if (!trimmed) return;
    setTasks((prev) => [...prev, trimmed]);
    setTaskInput('');
  };

  const removeTask = (index: number) => {
    setTasks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTask();
    }
  };

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const coords = await getLocation();

      const body: Record<string, unknown> = {};
      if (coords) {
        body.latitude = coords.latitude;
        body.longitude = coords.longitude;
        body.accuracy = coords.accuracy;
      }
      if (tasks.length > 0) {
        body.tasks = tasks;
      }

      const res = await fetch('/api/hrms/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.taskReportRequired) {
          toast.error('A daily task report is required to check out. Add at least one task.');
        } else {
          toast.error(data.error || 'Check-out failed');
        }
        return;
      }

      toast.success('Checked out successfully');
      setTasks([]);
      setTaskInput('');
      onOpenChange(false);
      onCheckedOut();
    } catch {
      toast.error('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <LogOut className="w-4 h-4 text-orange-500" />
            </div>
            <DialogTitle>Check Out</DialogTitle>
          </div>
          <DialogDescription>
            Optionally add a daily task summary before checking out.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Task list */}
          {tasks.length > 0 && (
            <ul className="space-y-1.5">
              {tasks.map((task, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm bg-muted/50 rounded-md px-3 py-2"
                >
                  <span className="flex-1 text-foreground">{task}</span>
                  <button
                    type="button"
                    onClick={() => removeTask(i)}
                    className="text-muted-foreground hover:text-destructive mt-0.5 shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Task input */}
          <div className="space-y-1.5">
            <Label htmlFor="task-input">Add task</Label>
            <div className="flex gap-2">
              <Textarea
                id="task-input"
                placeholder="e.g. Reviewed PR for feature/auth"
                className="min-h-[60px] resize-none text-sm"
                value={taskInput}
                onChange={(e) => setTaskInput(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0 self-end"
                onClick={addTask}
                disabled={!taskInput.trim()}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Press Enter or + to add a task</p>
          </div>

          <Button
            className="w-full"
            onClick={handleCheckout}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Checking out...
              </>
            ) : (
              'Check Out'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
