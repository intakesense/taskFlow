'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User as SupabaseUser } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { User } from '@/lib/types'
import { toast } from 'sonner'
import { registerForPushNotifications, unregisterFromPushNotifications } from '@/lib/firebase'

interface AuthContextType {
    user: SupabaseUser | null
    profile: User | null
    loading: boolean
    signIn: (email: string, password: string) => Promise<{ error: Error | null }>
    signInWithGoogle: () => Promise<{ error: Error | null }>
    signUp: (email: string, password: string, name: string) => Promise<{ error: Error | null }>
    signOut: () => Promise<void>
    refreshProfile: () => Promise<void>
    // Admin mask-as feature
    maskedAsUser: User | null
    maskAs: (userId: string | null) => Promise<void>
    effectiveUser: User | null // The user being viewed as (masked or real)
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<SupabaseUser | null>(null)
    const [profile, setProfile] = useState<User | null>(null)
    const [maskedAsUser, setMaskedAsUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)
    const supabase = createClient()

    const fetchProfile = async (userId: string) => {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .maybeSingle()

        if (error) {
            // Silent error for profile fetch - auth state will handle login redirect
            return null
        }

        return data as User | null
    }

    const refreshProfile = async () => {
        if (user) {
            const profileData = await fetchProfile(user.id)
            setProfile(profileData)
        }
    }

    useEffect(() => {
        let mounted = true

        const initAuth = async () => {
            try {
                // Get user directly - this validates the token against the API
                const { data: { user: currentUser }, error } = await supabase.auth.getUser()

                if (!mounted) return

                if (error) {
                    // Auth error - check if it's a stale token issue
                    if (error.message?.includes('refresh_token_not_found') ||
                        error.message?.includes('Invalid Refresh Token')) {
                        // Silent cleanup for stale tokens
                        await supabase.auth.signOut({ scope: 'local' }) // Local only - don't hit API
                    } else if (error.name === 'AuthSessionMissingError') {
                        // Expected when not logged in - no need to log
                    } else {
                        // Other errors
                        console.error('Auth error:', error)
                    }
                    setUser(null)
                    setProfile(null)
                } else if (!currentUser) {
                    // No session - normal unauthenticated state
                    setUser(null)
                    setProfile(null)
                } else {
                    // Valid session - fetch profile
                    setUser(currentUser)
                    const profileData = await fetchProfile(currentUser.id)
                    if (mounted) {
                        setProfile(profileData)
                    }
                }
            } catch (error: unknown) {
                console.error('Auth initialization error:', error)
                if (mounted) {
                    setUser(null)
                    setProfile(null)
                    // Only show toast for non-auth errors
                    const authError = error as { __isAuthError?: boolean }
                    if (!authError?.__isAuthError) {
                        toast.error('Failed to initialize authentication')
                    }
                }
            } finally {
                // ALWAYS set loading to false, even if there was an error
                if (mounted) {
                    setLoading(false)
                }
            }
        }

        initAuth()

        // ─────────────────────────────────────────────────────────────────────
        // ASYNC FORBIDDEN INSIDE onAuthStateChange
        //
        // Supabase JS v2 holds an internal session lock while firing this callback.
        // Any async operation that also tries to read/write the session (getUser,
        // getSession, setSession, or even fetchProfile which calls supabase.from())
        // will deadlock: the lock is never released because the callback never
        // returns synchronously, and the inner call waits for the lock forever.
        //
        // Rule: this callback body must be synchronous. Side-effects that need
        // awaiting must be deferred with .then() or setTimeout (which runs after
        // the lock is released). Do NOT refactor this to async/await.
        //
        // Reference: https://github.com/supabase/supabase/issues/35754
        // ─────────────────────────────────────────────────────────────────────
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
                if (!mounted) return

                // Handle sign out events
                if (event === 'SIGNED_OUT') {
                    setUser(null)
                    setProfile(null)
                    setMaskedAsUser(null)
                    return
                }

                // Handle token refresh failures
                if (event === 'TOKEN_REFRESHED' && !session) {
                    console.error('Token refresh failed')
                    setUser(null)
                    setProfile(null)
                    setMaskedAsUser(null)
                    toast.error('Session expired. Please login again.')
                    return
                }

                // Update user state
                setUser(session?.user ?? null)

                if (session?.user) {
                    // Use .then() instead of await to avoid deadlock
                    fetchProfile(session.user.id).then((profileData) => {
                        if (mounted) {
                            setProfile(profileData)
                            // Register for push notifications after login
                            registerForPushNotifications(session.user.id).catch(() => {
                                // Non-fatal - user may have denied permission
                            })
                        }
                    })

                } else {
                    setProfile(null)
                    setMaskedAsUser(null)
                }
            }
        )

        // Listen for cross-tab auth changes (login/logout in another tab)
        const handleStorageChange = (e: StorageEvent) => {
            // Supabase stores auth tokens in localStorage with this prefix
            if (e.key?.startsWith('sb-') && e.key?.includes('-auth-token')) {
                // Auth state changed in another tab, reinitialize
                initAuth()
            }
        }

        window.addEventListener('storage', handleStorageChange)

        return () => {
            mounted = false
            subscription.unsubscribe()
            window.removeEventListener('storage', handleStorageChange)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const signIn = async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        return { error: error as Error | null }
    }

    const signInWithGoogle = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
                scopes: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/drive.file',
                queryParams: {
                    access_type: 'offline',    // ensures refresh_token is returned on first consent
                    prompt: 'select_account',  // shows account picker but skips consent after first grant
                }
            }
        })
        return { error: error as Error | null }
    }

    const signUp = async (email: string, password: string, name: string) => {
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { name }
            }
        })
        return { error: error as Error | null }
    }

    const signOut = async () => {
        setMaskedAsUser(null)
        // Unregister push notifications before sign-out to prevent
        // notifications being sent to the wrong user
        if (user) {
            await unregisterFromPushNotifications(user.id).catch(() => { /* non-fatal */ })
        }
        await supabase.auth.signOut()
    }

    const maskAs = async (userId: string | null) => {
        if (!profile?.is_admin) return

        if (userId === null) {
            setMaskedAsUser(null)
        } else {
            const maskedProfile = await fetchProfile(userId)
            setMaskedAsUser(maskedProfile)
        }
    }

    // The effective user is who we're "viewing as" - either masked user or real user
    const effectiveUser = maskedAsUser || profile

    return (
        <AuthContext.Provider value={{
            user,
            profile,
            loading,
            signIn,
            signInWithGoogle,
            signUp,
            signOut,
            refreshProfile,
            maskedAsUser,
            maskAs,
            effectiveUser
        }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}
