'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User as SupabaseUser } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { User } from '@/lib/types'
import { toast } from 'sonner'

interface AuthContextType {
    user: SupabaseUser | null
    profile: User | null
    loading: boolean
    signIn: (email: string, password: string) => Promise<{ error: Error | null }>
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

        const clearAuthState = async () => {
            // Clear all Supabase auth data from localStorage
            const keys = Object.keys(localStorage)
            keys.forEach(key => {
                if (key.startsWith('sb-') && key.includes('-auth-token')) {
                    localStorage.removeItem(key)
                }
            })
            // Also sign out to ensure clean state
            await supabase.auth.signOut()
        }

        const initAuth = async () => {
            try {
                // Get user directly - this validates the token against the API
                // No need for getSession() -> getUser() double-check or timeout race
                const { data: { user: currentUser }, error } = await supabase.auth.getUser()

                if (!mounted) return

                if (error) {
                    // Check if it's a refresh token error (stale/invalid token)
                    if (error.message?.includes('refresh_token_not_found') ||
                        error.message?.includes('Invalid Refresh Token')) {
                        // Silent cleanup - this is expected after code changes
                        await clearAuthState()
                        setUser(null)
                        setProfile(null)
                    } else {
                        // Other auth errors - could be network issues
                        console.error('Auth error:', error)
                        setUser(null)
                        setProfile(null)
                    }
                } else if (!currentUser) {
                    // No user - normal unauthenticated state
                    setUser(null)
                    setProfile(null)
                } else {
                    // Valid session found
                    setUser(currentUser)
                    const profileData = await fetchProfile(currentUser.id)
                    if (mounted) {
                        setProfile(profileData)
                    }
                }
            } catch (error: any) {
                console.error('Auth initialization error:', error)

                // If it's an auth error with invalid tokens, clean up silently
                if (error?.__isAuthError &&
                    (error.code === 'refresh_token_not_found' ||
                     error.message?.includes('Invalid Refresh Token'))) {
                    await clearAuthState()
                    if (mounted) {
                        setUser(null)
                        setProfile(null)
                    }
                } else {
                    // Unexpected error - show toast
                    if (mounted) {
                        setUser(null)
                        setProfile(null)
                        toast.error('Failed to initialize authentication')
                    }
                }
            } finally {
                if (mounted) {
                    setLoading(false)
                }
            }
        }

        initAuth()

        // Listen for auth state changes (login, logout, token refresh)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
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
                    const profileData = await fetchProfile(session.user.id)
                    if (mounted) {
                        setProfile(profileData)
                    }
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
