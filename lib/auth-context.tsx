'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User as SupabaseUser } from '@supabase/supabase-js'
import { createClient, resetClient } from '@/lib/supabase/client'
import { User } from '@/lib/types'

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

        const initAuth = async () => {
            try {
                // Add timeout to prevent infinite loading state
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Auth timeout')), 10000)
                )

                // Get session - this will use cached data but also trigger refresh if needed
                const authPromise = supabase.auth.getSession()

                const { data: { session }, error } = await Promise.race([
                    authPromise,
                    timeoutPromise
                ]) as any

                if (!mounted) return

                // If there's an error or no session, clear state
                if (error || !session) {
                    console.error('Session error:', error)
                    setUser(null)
                    setProfile(null)
                } else {
                    // Validate the session by getting the user (this calls the API)
                    const { data: { user: validatedUser }, error: userError } = await supabase.auth.getUser()

                    if (!mounted) return

                    if (userError || !validatedUser) {
                        // Session is invalid, clear everything
                        console.error('User validation error:', userError)
                        setUser(null)
                        setProfile(null)
                        // Reset client to clear stale data
                        resetClient()
                    } else {
                        // Session is valid
                        setUser(validatedUser)
                        const profileData = await fetchProfile(validatedUser.id)
                        if (mounted) {
                            setProfile(profileData)
                        }
                    }
                }
            } catch (error) {
                console.error('Auth initialization error:', error)
                // Even on error, set loading to false to prevent infinite spinner
                if (mounted) {
                    setUser(null)
                    setProfile(null)
                }
            } finally {
                if (mounted) {
                    setLoading(false)
                }
            }
        }

        initAuth()

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (!mounted) return

                // Handle sign out events
                if (event === 'SIGNED_OUT') {
                    setUser(null)
                    setProfile(null)
                    setMaskedAsUser(null)
                    resetClient()
                    return
                }

                // Handle token refresh failures
                if (event === 'TOKEN_REFRESHED' && !session) {
                    console.error('Token refresh failed')
                    setUser(null)
                    setProfile(null)
                    setMaskedAsUser(null)
                    resetClient()
                    return
                }

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

        return () => {
            mounted = false
            subscription.unsubscribe()
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
        // Reset the singleton client to force fresh initialization on next login
        resetClient()
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
