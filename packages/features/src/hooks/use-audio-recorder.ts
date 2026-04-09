'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

export type RecordingState = 'idle' | 'recording' | 'paused' | 'stopped';

interface UseAudioRecorderOptions {
  onRecordingComplete?: (audioBlob: Blob) => void;
  onError?: (error: Error) => void;
  maxDuration?: number; // in seconds, default 5 minutes
  mimeType?: string; // default 'audio/webm'
}

interface AudioRecorderControls {
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  cancelRecording: () => void;
  recordingState: RecordingState;
  recordingTime: number; // in seconds
  audioBlob: Blob | null;
  audioURL: string | null;
  isSupported: boolean;
}

/**
 * useAudioRecorder - Native browser audio recording hook
 *
 * Provides WhatsApp-style voice message recording using native MediaRecorder API.
 * No external dependencies needed - works in all modern browsers.
 *
 * Features:
 * - Record, pause, resume audio
 * - Automatic duration tracking
 * - Max duration limit
 * - Audio visualization support (via mediaRecorderRef)
 * - WebM format (widely supported)
 * - Automatic cleanup
 *
 * @example
 * const { startRecording, stopRecording, recordingState, recordingTime, audioURL } = useAudioRecorder({
 *   onRecordingComplete: (blob) => uploadAudio(blob),
 *   maxDuration: 300 // 5 minutes
 * })
 */
export function useAudioRecorder(options: UseAudioRecorderOptions = {}): AudioRecorderControls {
  const {
    onRecordingComplete,
    onError,
    maxDuration = 300, // 5 minutes default
    mimeType = 'audio/webm', // WebM is widely supported
  } = options;

  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioURL, setAudioURL] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  // Check if browser supports audio recording
  const isSupported =
    typeof window !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

  // Stop recording timer
  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Stop recording - declared before startTimer since startTimer references it
  const stopRecordingRef = useRef<() => void>(() => {});

  // Start recording timer
  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setRecordingTime(elapsed);

      // Auto-stop at max duration
      if (elapsed >= maxDuration) {
        stopRecordingRef.current();
      }
    }, 1000);
  }, [maxDuration]);

  // Cleanup function
  const cleanup = useCallback(() => {
    stopTimer();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current = null;
    }
  }, [stopTimer]);

  // Start recording
  const startRecording = useCallback(async () => {
    if (!isSupported) {
      const error = new Error('Audio recording is not supported in this browser');
      onError?.(error);
      return;
    }

    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;

      // Check if mimeType is supported
      const finalMimeType = MediaRecorder.isTypeSupported(mimeType)
        ? mimeType
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : ''; // Let browser choose

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: finalMimeType,
      });

      chunksRef.current = [];

      // Handle data available
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      // Handle recording stop
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: finalMimeType || 'audio/webm' });
        const url = URL.createObjectURL(blob);

        setAudioBlob(blob);
        setAudioURL(url);
        setRecordingState('stopped');

        // Callback with the blob
        onRecordingComplete?.(blob);

        // Cleanup
        cleanup();
      };

      // Handle errors
      mediaRecorder.onerror = (event) => {
        const error = new Error(
          `MediaRecorder error: ${(event as ErrorEvent).message || 'Unknown error'}`
        );
        onError?.(error);
        cleanup();
        setRecordingState('idle');
      };

      mediaRecorderRef.current = mediaRecorder;

      // Start recording
      mediaRecorder.start(100); // Collect data every 100ms
      setRecordingState('recording');
      setRecordingTime(0);
      startTimer();
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to start recording');
      onError?.(err);
      cleanup();
      setRecordingState('idle');
    }
  }, [isSupported, mimeType, onRecordingComplete, onError, cleanup, startTimer]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && recordingState !== 'idle') {
      mediaRecorderRef.current.stop();
      stopTimer();
    }
  }, [recordingState, stopTimer]);

  // Update ref in an effect to avoid updating during render
  useEffect(() => {
    stopRecordingRef.current = stopRecording;
  });

  // Pause recording
  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && recordingState === 'recording') {
      mediaRecorderRef.current.pause();
      setRecordingState('paused');
      stopTimer();
    }
  }, [recordingState, stopTimer]);

  // Resume recording
  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && recordingState === 'paused') {
      mediaRecorderRef.current.resume();
      setRecordingState('recording');
      startTimer();
    }
  }, [recordingState, startTimer]);

  // Cancel recording
  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && recordingState !== 'idle') {
      // Stop without saving
      chunksRef.current = [];
      mediaRecorderRef.current.stop();
      cleanup();
      setRecordingState('idle');
      setRecordingTime(0);
      setAudioBlob(null);
      setAudioURL(null);
    }
  }, [recordingState, cleanup]);

  return {
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
  };
}

/**
 * Format seconds into MM:SS format
 */
export function formatRecordingTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
