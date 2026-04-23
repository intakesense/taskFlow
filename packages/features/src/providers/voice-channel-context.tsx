'use client';

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
  type ReactNode,
} from 'react';
import DailyIframe, {
  type DailyCall,
  type DailyParticipant,
} from '@daily-co/daily-js';
import { toast } from 'sonner';
import type { VoiceChannel, VoiceConnectionState } from '@taskflow/core';
import { useAuth } from './auth-context';
import { useSupabase } from './services-context';
import { createVoiceChannelsService } from '../services/voice-channels';

interface VoiceChannelContextValue {
  // State
  currentChannel: VoiceChannel | null;
  connectionState: VoiceConnectionState;
  participants: DailyParticipant[];
  localParticipant: DailyParticipant | null;
  callObject: DailyCall | null;
  isMuted: boolean;
  isVideoOn: boolean;
  isScreenSharing: boolean;

  // Actions
  joinChannel: (channel: VoiceChannel) => Promise<void>;
  leaveChannel: () => Promise<void>;
  toggleMute: () => void;
  toggleVideo: () => void;
  toggleScreenShare: () => Promise<void>;
}

const VoiceChannelContext = createContext<VoiceChannelContextValue | null>(null);

export function useVoiceChannel() {
  const context = useContext(VoiceChannelContext);
  if (!context) {
    throw new Error('useVoiceChannel must be used within VoiceChannelProvider');
  }
  return context;
}

interface VoiceChannelProviderProps {
  children: ReactNode;
  apiBaseUrl?: string; // For desktop app to point to web API
}

export function VoiceChannelProvider({
  children,
  apiBaseUrl = '',
}: VoiceChannelProviderProps) {
  const { profile } = useAuth();
  const supabase = useSupabase();
  const voiceService = useMemo(() => createVoiceChannelsService(supabase), [supabase]);

  const callObjectRef = useRef<DailyCall | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const [callObject, setCallObject] = useState<DailyCall | null>(null);
  const [currentChannel, setCurrentChannel] = useState<VoiceChannel | null>(null);
  const [connectionState, setConnectionState] = useState<VoiceConnectionState>('idle');
  const [participants, setParticipants] = useState<DailyParticipant[]>([]);
  const [localParticipant, setLocalParticipant] = useState<DailyParticipant | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // On mount, adopt any existing Daily instance left by a prior provider lifecycle
  // (e.g. after hot reload, or navigating away before cleanup completed)
  useEffect(() => {
    const existing = DailyIframe.getCallInstance();
    if (existing) {
      callObjectRef.current = existing as DailyCall;
    }
  }, []);

  // Cleanup on unmount or page unload
  useEffect(() => {
    const cleanup = () => {
      if (profile?.id) {
        // Use Beacon API for reliable cleanup on page unload
        navigator.sendBeacon(
          `${apiBaseUrl}/api/voice/leave`,
          JSON.stringify({ userId: profile.id })
        );
      }
    };

    window.addEventListener('beforeunload', cleanup);
    return () => {
      window.removeEventListener('beforeunload', cleanup);
      // Normal cleanup on unmount — destroy synchronously so Strict Mode
      // double-mount doesn't leave an orphaned DailyIframe instance
      const call = callObjectRef.current;
      callObjectRef.current = null;
      if (call) {
        call.leave().catch(() => {});
        call.destroy();
      }
      if (profile?.id) {
        voiceService.leaveChannel(profile.id).catch(() => {});
      }
    };
  }, [profile?.id, apiBaseUrl, voiceService]);

  const updateParticipants = useCallback((callObject: DailyCall) => {
    const allParticipants = callObject.participants();
    const participantList = Object.values(allParticipants);

    setParticipants(participantList.filter((p) => !p.local));
    setLocalParticipant(allParticipants.local || null);

    if (allParticipants.local) {
      setIsMuted(!allParticipants.local.audio);
      setIsVideoOn(!!allParticipants.local.video);
      setIsScreenSharing(!!allParticipants.local.screen);
    }
  }, []);

  const joinChannel = useCallback(
    async (channel: VoiceChannel) => {
      if (!profile) {
        toast.error('You must be logged in to join voice channels');
        return;
      }

      try {
        setConnectionState('connecting');

        // Get or create Daily room
        const roomResponse = await fetch(`${apiBaseUrl}/api/daily/room`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channelId: channel.id }),
          credentials: 'include',
        });

        if (!roomResponse.ok) {
          throw new Error('Failed to get room');
        }

        const { roomName, roomUrl } = await roomResponse.json();

        // Get meeting token
        const tokenResponse = await fetch(`${apiBaseUrl}/api/daily/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomName }),
          credentials: 'include',
        });

        if (!tokenResponse.ok) {
          throw new Error('Failed to get token');
        }

        const { token } = await tokenResponse.json();

        // Leave existing call if any
        if (callObjectRef.current) {
          await callObjectRef.current.leave().catch(() => {});
          callObjectRef.current.destroy();
          callObjectRef.current = null;
        }

        // Also destroy any orphaned Daily instance (e.g. from React Strict Mode double-mount)
        const orphaned = DailyIframe.getCallInstance();
        if (orphaned) {
          await (orphaned as DailyCall).leave().catch(() => {});
          (orphaned as DailyCall).destroy();
        }

        // Create new call object
        const callObject = DailyIframe.createCallObject({
          audioSource: true,
          videoSource: false,
        });

        callObjectRef.current = callObject;
        setCallObject(callObject);

        // Set up event listeners
        callObject
          .on('joined-meeting', () => {
            setConnectionState('connected');
            setCurrentChannel(channel);
            updateParticipants(callObject);
          })
          .on('left-meeting', () => {
            setConnectionState('idle');
            setCurrentChannel(null);
            setParticipants([]);
            setLocalParticipant(null);
          })
          .on('participant-joined', () => updateParticipants(callObject))
          .on('participant-left', () => updateParticipants(callObject))
          .on('participant-updated', () => updateParticipants(callObject))
          .on('error', (event) => {
            console.error('Daily error:', event);
            setConnectionState('error');
            toast.error('Voice connection error');
          });

        // Join the call
        await callObject.join({ url: roomUrl, token });

        // Update database
        await voiceService.joinChannel(channel.id, profile.id);

        // Start session tracking
        const sessionId = await voiceService.startSession(channel.id, profile.id);
        sessionIdRef.current = sessionId;

        toast.success(`Joined ${channel.name}`);
      } catch (error) {
        console.error('Failed to join channel:', error);
        setConnectionState('error');
        toast.error('Failed to join voice channel');
      }
    },
    [profile, voiceService, apiBaseUrl, updateParticipants]
  );

  const leaveChannel = useCallback(async () => {
    try {
      if (callObjectRef.current) {
        await callObjectRef.current.leave();
        callObjectRef.current.destroy();
        callObjectRef.current = null;
        setCallObject(null);
      }

      if (profile) {
        await voiceService.leaveChannel(profile.id);
      }

      // End session tracking
      if (sessionIdRef.current) {
        await voiceService.endSession(sessionIdRef.current);
        sessionIdRef.current = null;
      }

      setCurrentChannel(null);
      setConnectionState('idle');
      setParticipants([]);
      setLocalParticipant(null);
      setIsMuted(false);
      setIsVideoOn(false);
      setIsScreenSharing(false);

      toast.success('Left voice channel');
    } catch (error) {
      console.error('Failed to leave channel:', error);
      toast.error('Failed to leave channel');
    }
  }, [profile, voiceService]);

  const toggleMute = useCallback(() => {
    if (!callObjectRef.current) return;

    const newMuted = !isMuted;
    callObjectRef.current.setLocalAudio(!newMuted);
    setIsMuted(newMuted);

  }, [isMuted]);

  const toggleVideo = useCallback(() => {
    if (!callObjectRef.current) return;

    const newVideoOn = !isVideoOn;
    callObjectRef.current.setLocalVideo(newVideoOn);
    setIsVideoOn(newVideoOn);

  }, [isVideoOn]);

  const toggleScreenShare = useCallback(async () => {
    if (!callObjectRef.current) return;

    try {
      if (isScreenSharing) {
        await callObjectRef.current.stopScreenShare();
        setIsScreenSharing(false);
      } else {
        await callObjectRef.current.startScreenShare();
        setIsScreenSharing(true);
      }

    } catch (error) {
      console.error('Screen share error:', error);
      toast.error('Failed to toggle screen share');
    }
  }, [isScreenSharing]);

  const value = useMemo(
    () => ({
      currentChannel,
      connectionState,
      participants,
      localParticipant,
      callObject,
      isMuted,
      isVideoOn,
      isScreenSharing,
      joinChannel,
      leaveChannel,
      toggleMute,
      toggleVideo,
      toggleScreenShare,
    }),
    [
      currentChannel,
      connectionState,
      participants,
      localParticipant,
      callObject,
      isMuted,
      isVideoOn,
      isScreenSharing,
      joinChannel,
      leaveChannel,
      toggleMute,
      toggleVideo,
      toggleScreenShare,
    ]
  );

  return (
    <VoiceChannelContext.Provider value={value}>
      {children}
    </VoiceChannelContext.Provider>
  );
}
