'use client'

import { useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { m, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { PhoneOff, Loader2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { springs, durations } from '@/lib/animations'
import { haptics } from '@/lib/haptics'
import { useAIDirectChat, type AIChatState } from '@/hooks/use-ai-direct-chat'
import { useAuth } from '@/lib/auth-context'

// Dynamic import to avoid SSR issues with @openai/agents -> @modelcontextprotocol/sdk -> zod
const AIDirectVoiceChat = dynamic(
  () => import('./ai-direct-voice-chat').then(mod => mod.AIDirectVoiceChat),
  { ssr: false }
)

interface AIVoiceChatModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Full-screen AI voice chat experience.
 *
 * Renders a centered animated orb that reacts to AI state (connecting,
 * listening, speaking, error) with smooth spring-based animations
 * from the app's shared animation system.
 */
export function AIVoiceChatModal({ open, onOpenChange }: AIVoiceChatModalProps) {
  const {
    state,
    clientSecret,
    model,
    startChat,
    endChat,
    setListening,
    setSpeaking,
  } = useAIDirectChat()

  const { effectiveUser } = useAuth()
  const prefersReducedMotion = useReducedMotion()

  // Start chat when modal opens.
  // Radix Dialog's onOpenChange does NOT fire when `open` prop changes externally.
  useEffect(() => {
    if (open && state === 'idle') {
      startChat()
    }
  }, [open, state, startChat])

  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (!isOpen) {
      endChat()
    }
    onOpenChange(isOpen)
  }, [endChat, onOpenChange])

  // Auto-close on error after a brief delay
  useEffect(() => {
    if (state === 'error' && open) {
      const timer = setTimeout(() => {
        onOpenChange(false)
        endChat()
      }, 2500)
      return () => clearTimeout(timer)
    }
  }, [state, open, onOpenChange, endChat])

  const handleStateChange = useCallback((newState: 'listening' | 'speaking') => {
    if (newState === 'listening') {
      setListening()
    } else {
      setSpeaking()
    }
  }, [setListening, setSpeaking])

  const handleEndCall = useCallback(() => {
    haptics.medium()
    endChat()
    onOpenChange(false)
    toast.success('Call ended')
  }, [endChat, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          'max-w-none w-screen h-screen p-0 border-0 rounded-none',
          'bg-background',
          'flex flex-col items-center justify-between',
        )}
      >
        <VisuallyHidden>
          <DialogTitle>AI Voice Chat</DialogTitle>
          <DialogDescription>Direct voice chat with AI assistant</DialogDescription>
        </VisuallyHidden>

        {/* --- Top status label --- */}
        <div className="pt-safe-top pt-12 text-center">
          <m.p
            key={state}
            initial={prefersReducedMotion ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={springs.fast}
            className={cn(
              'text-sm font-medium tracking-wide',
              state === 'error' ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            {getStateLabel(state)}
          </m.p>
        </div>

        {/* --- Center orb --- */}
        <div className="flex-1 flex items-center justify-center">
          <VoiceOrb state={state} reducedMotion={!!prefersReducedMotion} />
        </div>

        {/* --- Bottom controls --- */}
        <m.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springs.default}
          className="pb-safe-bottom pb-12 flex flex-col items-center gap-3"
        >
          <Button
            id="ai-voice-end-call"
            variant="destructive"
            size="icon-lg"
            className="rounded-full h-16 w-16 shadow-lg active:scale-95 transition-transform"
            onClick={handleEndCall}
          >
            <PhoneOff className="h-6 w-6" />
          </Button>
          <p className="text-muted-foreground text-xs">Tap to end</p>
        </m.div>

        {/* --- Invisible WebRTC handler --- */}
        {clientSecret && effectiveUser && (
          <AIDirectVoiceChat
            clientSecret={clientSecret}
            model={model}
            userId={effectiveUser.id}
            userName={effectiveUser.name}
            onStateChange={handleStateChange}
            onDisconnect={handleEndCall}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStateLabel(state: AIChatState): string {
  switch (state) {
    case 'connecting':
      return 'Connecting…'
    case 'listening':
      return 'Listening…'
    case 'speaking':
      return 'Speaking…'
    case 'error':
      return 'Connection failed'
    default:
      return ''
  }
}

// ---------------------------------------------------------------------------
// Animated orb — the visual heart of the voice chat
// ---------------------------------------------------------------------------

/**
 * Renders three concentric circles (glow → ring → core) that animate
 * differently depending on AI state.  Uses the app's spring presets
 * and respects prefers-reduced-motion.
 */
function VoiceOrb({ state, reducedMotion }: { state: AIChatState; reducedMotion: boolean }) {
  const isConnecting = state === 'connecting'
  const isListening = state === 'listening'
  const isSpeaking = state === 'speaking'
  const isError = state === 'error'

  // Outer glow size & pulse
  const glowScale = isSpeaking
    ? [1, 1.35, 1]
    : isListening
      ? [1, 1.08, 1]
      : 1

  // Middle ring pulse
  const ringScale = isSpeaking
    ? [1, 1.25, 1]
    : isListening
      ? [1, 1.04, 1]
      : 1

  // Core orb pulse
  const coreScale = isConnecting
    ? [1, 0.92, 1]
    : isSpeaking
      ? [1, 1.12, 0.94, 1.06, 1]
      : isListening
        ? [1, 1.02, 1]
        : 1

  return (
    <div className="relative" style={{ width: 200, height: 200 }}>
      {/* Layer 1 — Outer glow */}
      <m.div
        className={cn(
          'absolute inset-0 rounded-full blur-3xl',
          isError
            ? 'bg-destructive/30'
            : 'bg-primary/20',
        )}
        animate={reducedMotion ? {} : {
          scale: glowScale,
          opacity: isSpeaking ? [0.25, 0.5, 0.25] : 0.25,
        }}
        transition={{
          duration: isSpeaking ? 0.5 : 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Layer 2 — Ring */}
      <m.div
        className={cn(
          'absolute rounded-full border',
          isError
            ? 'bg-destructive/10 border-destructive/25'
            : 'bg-primary/10 border-primary/20',
        )}
        style={{ inset: 20 }}
        animate={reducedMotion ? {} : { scale: ringScale }}
        transition={{
          duration: isSpeaking ? 0.4 : 1.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Layer 3 — Core orb */}
      <m.div
        className={cn(
          'absolute rounded-full shadow-lg flex items-center justify-center',
          isError
            ? 'bg-destructive shadow-destructive/40'
            : 'bg-primary shadow-primary/40',
        )}
        style={{ inset: 40 }}
        animate={reducedMotion ? {} : { scale: coreScale }}
        transition={{
          duration: isConnecting ? 0.8 : isSpeaking ? 0.35 : 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        {/* Inner icons */}
        <AnimatePresence mode="wait">
          {isConnecting && (
            <m.div
              key="loader"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: durations.fast }}
            >
              <Loader2 className="h-10 w-10 text-primary-foreground animate-spin" />
            </m.div>
          )}

          {isError && (
            <m.div
              key="error"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={springs.bouncy}
            >
              <AlertCircle className="h-10 w-10 text-white" />
            </m.div>
          )}

          {isSpeaking && (
            <m.div
              key="bars"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: durations.fast }}
              className="flex items-center justify-center gap-[3px]"
            >
              {[0, 1, 2, 3, 4].map((i) => (
                <m.div
                  key={i}
                  className="w-[3px] bg-primary-foreground/80 rounded-full"
                  animate={{ height: [6, 22, 6] }}
                  transition={{
                    duration: 0.45,
                    repeat: Infinity,
                    delay: i * 0.08,
                    ease: 'easeInOut',
                  }}
                />
              ))}
            </m.div>
          )}

          {isListening && (
            <m.div
              key="pulse"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: durations.fast }}
              className="flex items-center justify-center"
            >
              <m.div
                className="w-3 h-3 bg-primary-foreground/60 rounded-full"
                animate={{
                  scale: [1, 1.6, 1],
                  opacity: [0.6, 0.25, 0.6],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
            </m.div>
          )}
        </AnimatePresence>
      </m.div>
    </div>
  )
}