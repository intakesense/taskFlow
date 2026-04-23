'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import type { LoginFormData } from '@/lib/schemas/auth'
import { toast } from 'sonner'
import { LoginView } from '@taskflow/features'
import { Loader2 } from 'lucide-react'

function LoginPageContent() {
    const { signIn, signInWithGoogle, user, loading } = useAuth()
    const [isGoogleLoading, setIsGoogleLoading] = useState(false)
    const router = useRouter()
    const searchParams = useSearchParams()

    useEffect(() => {
        const code = searchParams.get('code')
        if (code) {
            setIsGoogleLoading(true)
        }
    }, [searchParams])

    useEffect(() => {
        if (!loading && user) {
            if (isGoogleLoading) {
                toast.success('Welcome back!')
            }
            router.replace('/')
        }
    }, [user, loading, router, isGoogleLoading])

    const handleEmailSignIn = async (data: LoginFormData) => {
        const { error } = await signIn(data.email, data.password)
        if (error) {
            toast.error(error.message || 'Failed to sign in')
        } else {
            toast.success('Welcome back!')
            router.push('/')
        }
    }

    const handleGoogleSignIn = async () => {
        setIsGoogleLoading(true)
        const { error } = await signInWithGoogle()
        if (error) {
            toast.error(error.message || 'Failed to sign in with Google')
            setIsGoogleLoading(false)
        }
    }

    return (
        <LoginView
            onEmailSignIn={handleEmailSignIn}
            onGoogleSignIn={handleGoogleSignIn}
            isGoogleLoading={isGoogleLoading}
            logoSrc="/logo.png"
        />
    )
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        }>
            <LoginPageContent />
        </Suspense>
    )
}
