'use client'

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react'
import DailyIframe, { DailyCall } from '@daily-co/daily-js'
import { useAuth } from '@/lib/auth-context'
import { voiceChannelService } from '@/lib/services/voice-channels'
import { toast } from 'sonner'
import type { VoiceChannel } from '@/lib/types'

interface VoiceChannelState {
  isConnected: boolean
  isConnecting: boolean
  currentChannel: VoiceChannel | null
  channelId: string | null
  isMuted: boolean
  isVideoEnabled: boolean
  isScreenSharing: boolean
  callObject: DailyCall | null
  roomUrl: string | null
  joinChannel: (channel: VoiceChannel) => Promise<void>
  leaveChannel: () => Promise<void>
  toggleMute: () => void
  toggleVideo: () => Promise<void>
  toggleScreenShare: () => Promise<void>
}

const VoiceChannelContext = createContext<VoiceChannelState | null>(null)

export function VoiceChannelProvider({ children }: { children: ReactNode }) {
  const { effectiveUser } = useAuth()

  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [currentChannel, setCurrentChannel] = useState<VoiceChannel | null>(null)
  const [roomUrl, setRoomUrl] = useState<string | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoEnabled, setIsVideoEnabled] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)

  const callObjectRef = useRef<DailyCall | null>(null)
  const sessionIdRef = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      if (callObjectRef.current) {
        callObjectRef.current.destroy()
      }
    }
  }, [])

  // Handle page unload/close
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (currentChannel && effectiveUser) {
        navigator.sendBeacon(
          `/api/voice/leave?channelId=${currentChannel.id}&userId=${effectiveUser.id}`
        )
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [currentChannel, effectiveUser])

  // Sync state to Supabase when it changes
  useEffect(() => {
    if (!currentChannel || !effectiveUser || !isConnected) return

    const syncState = async () => {
      try {
        await voiceChannelService.updateParticipantState(
          currentChannel.id,
          effectiveUser.id,
          {
            is_muted: isMuted,
            is_video_on: isVideoEnabled,
            is_screen_sharing: isScreenSharing,
          }
        )
      } catch (error) {
        console.error('Failed to sync participant state:', error)
      }
    }

    syncState()
  }, [isMuted, isVideoEnabled, isScreenSharing, currentChannel, effectiveUser, isConnected])

  const joinChannel = useCallback(async (channel: VoiceChannel) => {
    if (!effectiveUser) {
      toast.error('You must be logged in to join voice channels')
      return
    }

    if (isConnecting || isConnected) {
      toast.error('Already connected to a channel')
      return
    }

    setIsConnecting(true)

    try {
      const { roomName, roomUrl: url } = await voiceChannelService.getRoom(channel.id)
      setRoomUrl(url)

      const token = await voiceChannelService.getToken(roomName)

      const callObject = DailyIframe.createCallObject({
        audioSource: true,
        videoSource: false,
      })

      callObject.on('joined-meeting', () => {
        setIsConnected(true)
        setIsConnecting(false)
        toast.success(`Joined ${channel.name}`)
      })

      callObject.on('left-meeting', () => {
        // Only reset state here if we weren't already cleaned up by leaveChannel
        if (callObjectRef.current) {
          callObjectRef.current = null
          setIsConnected(false)
          setCurrentChannel(null)
          setRoomUrl(null)
        }
      })

      callObject.on('error', (event) => {
        console.error('Daily error:', event)
        toast.error('Voice channel error occurred')
      })

      callObject.on('participant-updated', (event) => {
        if (event?.participant?.local) {
          const p = event.participant
          setIsMuted(!p.audio)
          setIsVideoEnabled(!!p.video)
          setIsScreenSharing(!!p.screen)
        }
      })

      await callObject.join({ url, token })
      callObjectRef.current = callObject

      await voiceChannelService.joinChannel(channel.id, effectiveUser.id)

      sessionIdRef.current = await voiceChannelService.startSession(
        channel.id,
        effectiveUser.id
      )

      setCurrentChannel(channel)
    } catch (error) {
      console.error('Failed to join channel:', error)
      toast.error('Failed to join voice channel')
      setIsConnecting(false)
      setRoomUrl(null)
    }
  }, [effectiveUser, isConnecting, isConnected])

  const leaveChannel = useCallback(async () => {
    if (!callObjectRef.current || !currentChannel || !effectiveUser) return

    // Grab and immediately null the ref so the left-meeting event handler
    // doesn't race us, and so destroy() is called exactly once.
    const callObject = callObjectRef.current
    callObjectRef.current = null

    try {
      await callObject.leave()

      await voiceChannelService.leaveChannel(currentChannel.id, effectiveUser.id)

      if (sessionIdRef.current) {
        await voiceChannelService.endSession(sessionIdRef.current)
        sessionIdRef.current = null
      }

      toast.success(`Left ${currentChannel.name}`)
    } catch (error) {
      console.error('Failed to leave channel:', error)
    } finally {
      callObject.destroy()
      setCurrentChannel(null)
      setRoomUrl(null)
      setIsConnected(false)
      setIsMuted(false)
      setIsVideoEnabled(false)
      setIsScreenSharing(false)
    }
  }, [currentChannel, effectiveUser])

  const toggleMute = useCallback(() => {
    if (!callObjectRef.current) return
    callObjectRef.current.setLocalAudio(isMuted)
    setIsMuted(!isMuted)
  }, [isMuted])

  const toggleVideo = useCallback(async () => {
    if (!callObjectRef.current) return

    try {
      await callObjectRef.current.setLocalVideo(!isVideoEnabled)
      setIsVideoEnabled(!isVideoEnabled)
    } catch (error) {
      console.error('Failed to toggle video:', error)
      toast.error('Failed to toggle camera')
    }
  }, [isVideoEnabled])

  const toggleScreenShare = useCallback(async () => {
    if (!callObjectRef.current) return

    try {
      if (isScreenSharing) {
        await callObjectRef.current.stopScreenShare()
      } else {
        await callObjectRef.current.startScreenShare()
      }
      setIsScreenSharing(!isScreenSharing)
    } catch (error) {
      console.error('Failed to toggle screen share:', error)
      toast.error('Failed to toggle screen share')
    }
  }, [isScreenSharing])

  const value: VoiceChannelState = {
    isConnected,
    isConnecting,
    currentChannel,
    channelId: currentChannel?.id || null,
    isMuted,
    isVideoEnabled,
    isScreenSharing,
    callObject: callObjectRef.current,
    roomUrl,
    joinChannel,
    leaveChannel,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
  }

  return (
    <VoiceChannelContext.Provider value={value}>
      {children}
    </VoiceChannelContext.Provider>
  )
}

export function useVoiceChannel() {
  const context = useContext(VoiceChannelContext)
  if (!context) {
    throw new Error('useVoiceChannel must be used within a VoiceChannelProvider')
  }
  return context
}
