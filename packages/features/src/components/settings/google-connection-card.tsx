'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Calendar, HardDrive } from 'lucide-react';
import { useServices } from '../../providers/services-context';
import { useAuth } from '../../providers/auth-context';
import { SettingsSection } from './settings-view';

interface GoogleStatus {
    connected: boolean
    scopes: string[]
    loading: boolean
}

/**
 * Shows Google account connection status (Calendar + Drive).
 * Tells user whether their Google token is stored and which scopes are active.
 * Drop this inside SettingsView children on both web and desktop.
 */
export function GoogleConnectionCard() {
    const { supabase } = useServices();
    const { user } = useAuth();
    const [status, setStatus] = useState<GoogleStatus>({ connected: false, scopes: [], loading: true });

    useEffect(() => {
        if (!user) return

        supabase
            .from('user_google_tokens')
            .select('scopes')
            .eq('user_id', user.id)
            .maybeSingle()
            .then(({ data }) => {
                if (data) {
                    setStatus({
                        connected: true,
                        scopes: (data.scopes as string).split(' '),
                        loading: false,
                    })
                } else {
                    setStatus({ connected: false, scopes: [], loading: false })
                }
            })
    }, [user, supabase])

    const hasCalendar = status.scopes.includes('https://www.googleapis.com/auth/calendar.events')
    const hasDrive = status.scopes.includes('https://www.googleapis.com/auth/drive.file')

    return (
        <SettingsSection
            title="Google Integration"
            description="Calendar sync and Drive file sharing"
            icon={
                <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
            }
        >
            {status.loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                    Checking connection...
                </div>
            ) : status.connected ? (
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 font-medium">
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        Google account connected
                    </div>
                    <div className="space-y-2 pl-6">
                        <div className="flex items-center gap-2 text-sm">
                            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className={hasCalendar ? 'text-foreground' : 'text-muted-foreground line-through'}>
                                Google Calendar sync
                            </span>
                            {hasCalendar
                                ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 ml-auto" />
                                : <XCircle className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
                            }
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <HardDrive className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className={hasDrive ? 'text-foreground' : 'text-muted-foreground line-through'}>
                                Google Drive sharing
                            </span>
                            {hasDrive
                                ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 ml-auto" />
                                : <XCircle className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
                            }
                        </div>
                    </div>
                    {(!hasCalendar || !hasDrive) && (
                        <p className="text-xs text-muted-foreground pl-6">
                            Sign out and sign in again with Google to grant missing permissions.
                        </p>
                    )}
                </div>
            ) : (
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <XCircle className="h-4 w-4 shrink-0" />
                        Google account not connected
                    </div>
                    <p className="text-xs text-muted-foreground pl-6">
                        Sign in with Google to enable Calendar sync and Drive file sharing.
                    </p>
                </div>
            )}
        </SettingsSection>
    )
}
