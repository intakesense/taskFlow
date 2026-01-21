'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User as SupabaseUser } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
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
        const initAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            setUser(session?.user ?? null)

            if (session?.user) {
                const profileData = await fetchProfile(session.user.id)
                setProfile(profileData)
            }

            setLoading(false)
        }

        initAuth()

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                setUser(session?.user ?? null)

                if (session?.user) {
                    const profileData = await fetchProfile(session.user.id)
                    setProfile(profileData)
                } else {
                    setProfile(null)
                    setMaskedAsUser(null)
                }
            }
        )

        return () => subscription.unsubscribe()
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
