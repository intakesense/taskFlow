'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Button, Textarea, cn } from '@taskflow/ui';
import { haptics } from '../../utils/haptics';

interface ProgressInputProps {
  onSubmit: (content: string) => Promise<void>;
  disabled?: boolean;
  isSubmitting?: boolean;
  placeholder?: string;
  className?: string;
}

export function ProgressInput({
  onSubmit,
  disabled = false,
  isSubmitting = false,
  placeholder = 'Share your progress...',
  className,
}: ProgressInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasContent = value.trim().length > 0;

  const handleSubmit = useCallback(async () => {
    if (!value.trim() || isSubmitting) return;
    haptics.medium();

    try {
      await onSubmit(value.trim());
      setValue('');
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch {
      // Error handled by mutation
    }
  }, [value, isSubmitting, onSubmit]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Enter to send, Shift+Enter for newline
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [value]);

  return (
    <div className={cn('flex items-end gap-2 p-3 border-t bg-background', className)}>
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled || isSubmitting}
        className="min-h-[40px] max-h-[120px] resize-none flex-1 py-2"
        rows={1}
      />
      <Button
        size="icon"
        onClick={handleSubmit}
        disabled={!hasContent || disabled || isSubmitting}
        className="h-10 w-10 shrink-0"
      >
        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      </Button>
    </div>
  );
}
