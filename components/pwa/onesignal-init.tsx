'use client'

import Script from 'next/script'
import { useEffect, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth-context'

// Env var takes priority, hardcoded fallback ensures push works even without .env setup
const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '81a64162-6917-440c-a52d-7b3e28d4f751'

// Production origin — OneSignal only delivers pushes on HTTPS origins registered in the dashboard.
// Localhost is allowed explicitly via allowLocalhostAsSecureOrigin:true for development testing.
const PRODUCTION_ORIGIN = 'https://tms.intakesense.com'

// ─── Global type declarations ────────────────────────────────────────────────

declare global {
  interface Window {
    OneSignalDeferred?: Array<(OneSignal: OneSignalSDK) => Promise<void>>
    // Exposed after SDK initialises — use callOneSignal() helper to handle both cases safely
    OneSignal?: OneSignalSDK
  }
}

interface PushSubscriptionChangeEvent {
  previous: { optedIn: boolean; id: string | null }
  current: { optedIn: boolean; id: string | null }
}

interface NotificationClickEvent {
  notification: {
    title: string
    body: string
    data?: Record<string, unknown>
    url?: string
  }
  result: { actionId?: string; url?: string }
}

interface ForegroundWillDisplayEvent {
  notification: {
    title: string
    body: string
    data?: Record<string, unknown>
  }
  preventDefault: () => void
}

export interface PushSubscription {
  id: string | null
  token: string | null
  optedIn: boolean
  optIn: () => Promise<void>
  optOut: () => Promise<void>
  addEventListener: (event: 'change', listener: (event: PushSubscriptionChangeEvent) => void) => void
  removeEventListener: (event: 'change', listener: (event: PushSubscriptionChangeEvent) => void) => void
}

interface OneSignalSDK {
  init: (config: {
    appId: string
    allowLocalhostAsSecureOrigin?: boolean
    notifyButton?: { enable: boolean }
    promptOptions?: unknown
    welcomeNotification?: { title: string; message: string }
  }) => Promise<void>
  login: (externalId: string) => Promise<void>
  logout: () => Promise<void>
  User: {
    PushSubscription: PushSubscription
  }
  Notifications: {
    permission: boolean
    addEventListener: (
      event: 'permissionChange' | 'click' | 'foregroundWillDisplay' | 'dismiss' | 'permissionPromptDisplay',
      listener: (event: unknown) => void
    ) => void
    removeEventListener: (
      event: 'permissionChange' | 'click' | 'foregroundWillDisplay' | 'dismiss' | 'permissionPromptDisplay',
      listener: (event: unknown) => void
    ) => void
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const emptySubscribe = () => () => { }

/** true on production AND on localhost (for dev testing) */
function useIsOneSignalEnabled() {
  return useSyncExternalStore(
    emptySubscribe,
    () => {
      if (typeof window === 'undefined') return false
      const origin = window.location.origin
      return origin === PRODUCTION_ORIGIN || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')
    },
    () => false
  )
}

const isDev = () =>
  typeof window !== 'undefined' &&
  (window.location.origin.startsWith('http://localhost') || window.location.origin.startsWith('http://127.0.0.1'))

/**
 * Safely call a OneSignal method whether the SDK has already initialised
 * (window.OneSignal exists) or not (push to deferred queue).
 * Eliminates the race condition where the deferred queue was drained before the React effect ran.
 */
function callOneSignal(fn: (sdk: OneSignalSDK) => Promise<void>) {
  if (window.OneSignal) {
    fn(window.OneSignal).catch(console.error)
  } else {
    window.OneSignalDeferred = window.OneSignalDeferred || []
    window.OneSignalDeferred.push(fn)
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export function OneSignalInit() {
  const { user } = useAuth()
  const router = useRouter()
  const isEnabled = useIsOneSignalEnabled()

  // ── 1. Login / logout with OneSignal when auth state changes ──────────────
  useEffect(() => {
    if (!isEnabled) return
    if (!user?.id) return

    callOneSignal(async (OneSignal) => {
      // Link the Supabase UID as the OneSignal External ID.
      // OneSignal then delivers to ALL subscribed devices for this user.
      await OneSignal.login(user.id)
      if (isDev()) console.log('✅ OneSignal: logged in as', user.id)
    })
  }, [user?.id, isEnabled])

  // ── 2. Wire up notification event listeners ────────────────────────────────
  useEffect(() => {
    if (!isEnabled) return

    // Store cleanup references so we can remove the exact same listener instances
    let cleanup: (() => void) | null = null

    callOneSignal(async (OneSignal) => {

      // ── 2a. foregroundWillDisplay ──────────────────────────────────────────
      // When the user is ACTIVELY in the app, suppress the OS desktop notification
      // banner and show an in-app sonner toast instead. This is the WhatsApp pattern —
      // you don't want a popup banner when you're already reading the chat.
      const handleForeground = (event: unknown) => {
        const e = event as ForegroundWillDisplayEvent

        const title = e.notification.title || 'New notification'
        const body = e.notification.body || ''
        const data = e.notification.data as { conversation_id?: string; task_id?: string; type?: string } | undefined
        const notifType = data?.type

        // Only suppress the OS banner if the user is currently viewing the same conversation.
        // This matches WhatsApp behavior — if you're in Chat A, you don't get a popup for Chat A,
        // but you DO get a native banner for Chat B.
        const currentUrl = window.location.href
        const isViewingThisConversation =
          data?.conversation_id && currentUrl.includes(`conversation=${data.conversation_id}`)
        const isViewingThisTask =
          data?.task_id && currentUrl.includes(`/tasks/${data.task_id}`)

        if (isViewingThisConversation || isViewingThisTask) {
          // User is already looking at this — suppress OS banner, show subtle toast
          e.preventDefault()
          toast(body || title, { description: body ? title : undefined, duration: 4000 })
          return
        }

        // For other conversations/tasks: show an in-app toast WITH an action button,
        // but also let the OS banner through (do NOT call preventDefault).
        const target = data?.conversation_id
          ? `/messages?conversation=${data.conversation_id}`
          : data?.task_id
            ? `/tasks/${data.task_id}`
            : null

        if (target) {
          // Determine button label based on notification type
          const getActionLabel = () => {
            switch (notifType) {
              case 'chat_message':
                return 'View Chat'
              case 'task_progress':
                return 'View Progress'
              case 'task_progress_comment':
                return 'View Comment'
              default:
                return 'View Task'
            }
          }

          toast(body || title, {
            description: body ? title : undefined,
            action: {
              label: getActionLabel(),
              onClick: () => router.push(target),
            },
            duration: 6000,
          })
        }
      }

      // ── 2b. click ─────────────────────────────────────────────────────────
      // When a notification is clicked in the OS notification center, do a
      // client-side navigation instead of a full page reload. This preserves
      // React state and feels instant.
      const handleClick = (event: unknown) => {
        const e = event as NotificationClickEvent
        const data = e.notification.data as { conversation_id?: string; task_id?: string } | undefined

        if (data?.conversation_id) {
          router.push(`/messages?conversation=${data.conversation_id}`)
        } else if (data?.task_id) {
          router.push(`/tasks/${data.task_id}`)
        } else if (e.result.url || e.notification.url) {
          router.push(e.result.url || e.notification.url || '/')
        }
      }

      // ── 2c. PushSubscription change ───────────────────────────────────────
      // Fires when the user grants, revokes, or soft-toggles notifications.
      // Dispatches a custom DOM event so the Settings page toggle stays in sync.
      const handleSubscriptionChange = (event: unknown) => {
        const e = event as PushSubscriptionChangeEvent
        if (isDev()) console.log('🔔 OneSignal subscription changed:', e.current)
        window.dispatchEvent(
          new CustomEvent('onesignal-subscription-change', {
            detail: { optedIn: e.current.optedIn },
          })
        )
      }

      // ── 2d. permissionChange ──────────────────────────────────────────────
      const handlePermissionChange = (permission: unknown) => {
        if (isDev()) console.log('🔔 OneSignal permission changed:', permission)
        window.dispatchEvent(
          new CustomEvent('onesignal-permission-change', {
            detail: { granted: !!permission },
          })
        )
      }

      OneSignal.Notifications.addEventListener('foregroundWillDisplay', handleForeground)
      OneSignal.Notifications.addEventListener('click', handleClick)
      OneSignal.Notifications.addEventListener('permissionChange', handlePermissionChange)
      OneSignal.User.PushSubscription.addEventListener('change', handleSubscriptionChange)

      // Store cleanup so the useEffect return can invoke it
      cleanup = () => {
        OneSignal.Notifications.removeEventListener('foregroundWillDisplay', handleForeground)
        OneSignal.Notifications.removeEventListener('click', handleClick)
        OneSignal.Notifications.removeEventListener('permissionChange', handlePermissionChange)
        OneSignal.User.PushSubscription.removeEventListener('change', handleSubscriptionChange)
      }
    })

    // useEffect cleanup — runs on unmount or dependency change
    return () => { cleanup?.() }
  }, [isEnabled, router])

  // Don't load the SDK if not on an allowed origin
  if (!isEnabled) return null

  const isLocalhost = isDev()

  return (
    <>
      <Script
        src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"
        strategy="afterInteractive"
      />
      <Script id="onesignal-init" strategy="afterInteractive">
        {`
          window.OneSignalDeferred = window.OneSignalDeferred || [];
          OneSignalDeferred.push(async function(OneSignal) {
            await OneSignal.init({
              appId: "${ONESIGNAL_APP_ID}",

              // Allow localhost for dev testing — OneSignal docs recommend this
              // instead of hardcoding production-only origin checks.
              // On production this has no effect; on localhost it enables the SDK.
              allowLocalhostAsSecureOrigin: ${isLocalhost},

              // Bell button off — we use our own Settings UI toggle
              notifyButton: {
                enable: false,
              },

              // Welcome notification — confirms to new subscribers that it works
              welcomeNotification: {
                title: "You're all set! 🔔",
                message: "You'll now receive task updates and messages.",
              },

              // Prompt after 3 page views + 20s delay so user sees app value first.
              // OneSignal best practice: don't prompt on the very first visit.
              promptOptions: {
                slidedown: {
                  prompts: [
                    {
                      type: "push",
                      autoPrompt: true,
                      text: {
                        actionMessage: "Stay on top of tasks and messages — enable notifications.",
                        acceptButton: "Allow",
                        cancelButton: "Not Now",
                      },
                      delay: {
                        pageViews: 3,
                        timeDelay: 20,
                      },
                    },
                  ],
                },
              },
            });
          });
        `}
      </Script>
    </>
  )
}
