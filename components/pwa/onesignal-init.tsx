'use client'

import Script from 'next/script'
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { createClient } from '@/lib/supabase/client'

const ONESIGNAL_APP_ID = '81a64162-6917-440c-a52d-7b3e28d4f751'
const ALLOWED_ORIGIN = 'https://tms.intakesense.com'

declare global {
  interface Window {
    OneSignalDeferred?: Array<(OneSignal: OneSignalSDK) => Promise<void>>
  }
}

interface OneSignalSDK {
  init: (config: { appId: string; notifyButton?: { enable: boolean } }) => Promise<void>
  login: (externalId: string) => Promise<void>
  User: {
    PushSubscription: {
      id: string | null
    }
  }
}

export function OneSignalInit() {
  const { user } = useAuth()
  const [isAllowedOrigin, setIsAllowedOrigin] = useState(false)

  // Check if we're on the allowed origin
  useEffect(() => {
    setIsAllowedOrigin(window.location.origin === ALLOWED_ORIGIN)
  }, [])

  // Link user to OneSignal after login
  useEffect(() => {
    if (!user || !isAllowedOrigin) return

    window.OneSignalDeferred = window.OneSignalDeferred || []
    window.OneSignalDeferred.push(async (OneSignal) => {
      // Link Supabase user ID to OneSignal
      await OneSignal.login(user.id)

      // Store player ID in database for server-side notifications
      const playerId = OneSignal.User.PushSubscription.id
      if (playerId) {
        const supabase = createClient()
        await supabase
          .from('users')
          .update({ onesignal_player_id: playerId })
          .eq('id', user.id)
      }
    })
  }, [user, isAllowedOrigin])

  // Don't load OneSignal on localhost or other origins
  if (!isAllowedOrigin) {
    return null
  }

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
              notifyButton: {
                enable: true,
              },
            });
          });
        `}
      </Script>
    </>
  )
}
