'use client';

import { useEffect } from 'react';
import { useAudioRecorder, formatRecordingTime } from '../../hooks/use-audio-recorder';
import { Button, cn } from '@taskflow/ui';
import { Mic, X, Send, Pause, Play, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { haptics } from '../../utils/haptics';

interface VoiceRecorderProps {
  onSend: (audioBlob: Blob) => void;
  onCancel?: () => void;
  maxDuration?: number; // in seconds
  isSending?: boolean; // Show loading state while uploading
  className?: string;
}

/**
 * VoiceRecorder - WhatsApp-style voice message recorder
 *
 * Features:
 * - Press and hold to record (mobile-style)
 * - Click to record (desktop-style)
 * - Visual recording feedback
 * - Duration timer
 * - Pause/resume
 * - Cancel or send
 * - Auto-stop at max duration
 *
 * @example
 * <VoiceRecorder
 *   onSend={(blob) => handleSendVoiceMessage(blob)}
 *   maxDuration={300} // 5 minutes
 * />
 */
export function VoiceRecorder({
  onSend,
  onCancel,
  maxDuration = 300,
  isSending = false,
  className,
}: VoiceRecorderProps) {
  const {
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording,
    recordingState,
    recordingTime,
    audioBlob,
    audioURL,
    isSupported,
  } = useAudioRecorder({
    onRecordingComplete: (blob) => {
      // Auto-send or show preview
      console.log('Recording complete:', blob.size, 'bytes');
    },
    onError: (error) => {
      toast.error(`Recording failed: ${error.message}`);
    },
    maxDuration,
  });

  // Auto-start recording when component mounts (WhatsApp behavior)
  useEffect(() => {
    if (recordingState === 'idle') {
      haptics.medium();
      startRecording();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  // Show warning if max duration is approaching
  useEffect(() => {
    if (recordingTime === maxDuration - 10) {
      toast.warning('10 seconds remaining');
    }
  }, [recordingTime, maxDuration]);

  if (!isSupported) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        Voice recording is not supported in your browser
      </div>
    );
  }

  const handleSend = () => {
    if (audioBlob) {
      haptics.success();
      onSend(audioBlob);
      // Reset state
      cancelRecording();
    }
  };

  const handleCancel = () => {
    haptics.light();
    cancelRecording();
    onCancel?.();
  };

  // Recording interface
  if (recordingState === 'recording' || recordingState === 'paused') {
    return (
      <div className={cn('flex items-center gap-3 p-4 bg-card border-t border-border', className)}>
        {/* Cancel button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleCancel}
          className="flex-shrink-0 text-destructive hover:text-destructive"
        >
          <Trash2 className="h-5 w-5" />
        </Button>

        {/* Recording indicator */}
        <div className="flex items-center gap-3 flex-1">
          {/* Animated mic icon */}
          <div className="relative">
            <Mic
              className={cn(
                'h-5 w-5 text-destructive',
                recordingState === 'recording' && 'animate-pulse'
              )}
            />
            {recordingState === 'recording' && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-destructive rounded-full animate-ping" />
            )}
          </div>

          {/* Waveform visualization (simplified) */}
          <div className="flex items-center gap-1 flex-1">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className={cn(
                  'w-1 rounded-full transition-all',
                  recordingState === 'recording'
                    ? 'bg-destructive animate-pulse'
                    : 'bg-muted-foreground/30'
                )}
                style={{
                  height: recordingState === 'recording' ? `${Math.random() * 20 + 10}px` : '6px',
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>

          {/* Timer */}
          <span className="text-sm font-mono text-muted-foreground tabular-nums">
            {formatRecordingTime(recordingTime)}
          </span>
        </div>

        {/* Pause/Resume button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={recordingState === 'recording' ? pauseRecording : resumeRecording}
          className="flex-shrink-0"
        >
          {recordingState === 'recording' ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5" />
          )}
        </Button>

        {/* Send button */}
        <Button size="icon" onClick={stopRecording} className="flex-shrink-0">
          <Send className="h-5 w-5" />
        </Button>
      </div>
    );
  }

  // Preview interface (after recording stopped)
  if (recordingState === 'stopped' && audioURL) {
    return (
      <div className={cn('flex items-center gap-3 p-4 bg-card border-t border-border', className)}>
        {/* Delete button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleCancel}
          className="flex-shrink-0 text-destructive hover:text-destructive"
        >
          <X className="h-5 w-5" />
        </Button>

        {/* Audio preview */}
        <div className="flex items-center gap-3 flex-1">
          <Mic className="h-5 w-5 text-muted-foreground" />
          <audio src={audioURL} controls className="flex-1 h-10" style={{ maxWidth: '100%' }} />
          <span className="text-sm font-mono text-muted-foreground tabular-nums">
            {formatRecordingTime(recordingTime)}
          </span>
        </div>

        {/* Send button */}
        <Button size="icon" onClick={handleSend} disabled={isSending} className="flex-shrink-0">
          {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        </Button>
      </div>
    );
  }

  // Initial state - show loading while starting (should be brief)
  return (
    <div className={cn('flex items-center gap-3 p-4 bg-card border-t border-border', className)}>
      <div className="flex items-center gap-3 flex-1 justify-center">
        <Mic className="h-5 w-5 text-muted-foreground animate-pulse" />
        <span className="text-sm text-muted-foreground">Starting recorder...</span>
      </div>
    </div>
  );
}

/**
 * AudioMessagePlayer - Player for received voice messages
 *
 * Displays a compact audio player for voice messages in the chat.
 */
interface AudioMessagePlayerProps {
  audioUrl: string;
  duration?: number;
  className?: string;
}

export function AudioMessagePlayer({ audioUrl, duration, className }: AudioMessagePlayerProps) {
  return (
    <div className={cn('flex items-center gap-3 p-3 rounded-2xl bg-muted max-w-xs', className)}>
      <div className="flex items-center gap-2 flex-1">
        <Mic className="h-4 w-4 text-primary flex-shrink-0" />
        <audio src={audioUrl} controls className="flex-1" style={{ height: '32px', maxWidth: '100%' }} />
        {duration && (
          <span className="text-xs text-muted-foreground tabular-nums flex-shrink-0">
            {formatRecordingTime(duration)}
          </span>
        )}
      </div>
    </div>
  );
}
