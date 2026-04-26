'use client'

import { useCallback, useState, useSyncExternalStore } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout'
import { useAuth } from '@/lib/auth-context'
import {
  SettingsView,
  AppearanceSettings,
  AIBotSettings,
  HrmsSettings,
  GoogleConnectionCard,
  NotificationsSettings,
  AboutSettings,
  type BotConfig,
} from '@taskflow/features'
import { uploadAvatar, deleteAvatar } from '@/lib/services/avatar'
import { registerForPushNotifications, unregisterFromPushNotifications } from '@/lib/firebase/notifications'
import { toast } from 'sonner'
import { User as UserType } from '@/lib/types'

// Minimal hydration guard - avoids SSR mismatch without showing spinner
const emptySubscribe = () => () => { }
const useIsClient = () => useSyncExternalStore(emptySubscribe, () => true, () => false)

export default function SettingsPage() {
    const isClient = useIsClient()
    const { profile, maskedAsUser } = useAuth()

    if (!isClient) return null

    return <SettingsContent profile={profile} maskedAsUser={maskedAsUser} />
}

function SettingsContent({ profile, maskedAsUser }: { profile: UserType | null; maskedAsUser: UserType | null }) {
    const { refreshProfile, signOut, maskAs } = useAuth()
    const router = useRouter()
    const [isSigningOut, setIsSigningOut] = useState(false)

    // ── Sign out ──────────────────────────────────────────────────────────
    const handleSignOut = async () => {
        setIsSigningOut(true)
        try {
            await signOut()
            router.push('/login')
        } finally {
            setIsSigningOut(false)
        }
    }

    // ── Avatar ────────────────────────────────────────────────────────────
    const avatarHandlers = maskedAsUser ? undefined : {
        onUpload: async (file: File) => {
            if (!profile?.id) return
            await uploadAvatar(file, profile.id)
            await refreshProfile()
            toast.success('Avatar updated successfully')
        },
        onDelete: async () => {
            if (!profile?.id) return
            await deleteAvatar(profile.id)
            await refreshProfile()
            toast.success('Avatar removed')
        },
    }

    // ── Notifications ─────────────────────────────────────────────────────
    const handleLoadNotifications = useCallback(async () => {
        const permission = typeof window !== 'undefined' && 'Notification' in window
            ? Notification.permission
            : 'denied'
        return {
            enabled: permission === 'granted',
            sound: false,
            messages: true,
            tasks: true,
            progress: true,
            mentions: true,
        }
    }, [])

    const handleNotificationToggle = useCallback(async (enabled: boolean) => {
        if (!profile?.id) return
        if (enabled) {
            const token = await registerForPushNotifications(profile.id)
            if (token) {
                toast.success('Push notifications enabled')
            } else {
                const permission = Notification.permission
                if (permission === 'denied') {
                    toast.error('Notification permission was denied')
                } else {
                    toast.error('Failed to enable notifications')
                }
                throw new Error('Registration failed')
            }
        } else {
            await unregisterFromPushNotifications(profile.id)
            toast.success('Push notifications disabled')
        }
    }, [profile?.id])

    const isNotificationBlocked =
        typeof window !== 'undefined' && 'Notification' in window
            ? Notification.permission === 'denied'
            : false

    // ── AI Bot ────────────────────────────────────────────────────────────
    const handleLoadBotConfig = useCallback(async () => {
        const res = await fetch('/api/ai/bot/config')
        if (!res.ok) throw new Error('Failed to load config')
        return res.json()
    }, [])

    const handleSaveBotConfig = useCallback(async (config: BotConfig) => {
        const res = await fetch('/api/ai/bot/config', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config),
        })
        if (!res.ok) {
            const error = await res.json()
            throw new Error(error.error || 'Failed to save settings')
        }
    }, [])

    // ── HRMS ──────────────────────────────────────────────────────────────
    const handleFetchHrmsStatus = useCallback(async () => {
        const res = await fetch('/api/hrms/status')
        if (!res.ok) throw new Error('Failed to fetch status')
        return res.json()
    }, [])

    const handleUnlinkHrms = useCallback(async () => {
        const res = await fetch('/api/hrms/link', { method: 'DELETE' })
        if (!res.ok) throw new Error('Failed to unlink HRMS account')
    }, [])

    return (
        <DashboardLayout>
            <SettingsView
                onSignOut={handleSignOut}
                isSigningOut={isSigningOut}
                avatarHandlers={avatarHandlers}
                maskedAsName={maskedAsUser?.name}
                onExitMask={() => maskAs(null)}
                renderProfileImage={({ src, alt, className }) => (
                    <Image src={src} alt={alt} width={80} height={80} className={className} />
                )}
            >
                <AppearanceSettings />

                {profile?.is_admin && !maskedAsUser && (
                    <AIBotSettings
                        onLoadConfig={handleLoadBotConfig}
                        onSaveConfig={handleSaveBotConfig}
                    />
                )}

                {!maskedAsUser && (
                    <HrmsSettings
                        onFetchStatus={handleFetchHrmsStatus}
                        onUnlink={handleUnlinkHrms}
                    />
                )}

                {!maskedAsUser && <GoogleConnectionCard />}

                <NotificationsSettings
                    onLoad={handleLoadNotifications}
                    onToggle={handleNotificationToggle}
                    blocked={isNotificationBlocked}
                />

                <AboutSettings
                    version="1.0.0"
                    platform="Web"
                    buildMode={process.env.NODE_ENV === 'production' ? 'Release' : 'Development'}
                />
            </SettingsView>
        </DashboardLayout>
    )
}
