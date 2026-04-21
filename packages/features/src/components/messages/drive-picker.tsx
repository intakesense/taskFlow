'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useConfig } from '../../providers/config-context';

export interface DriveFile {
    id: string
    name: string
    mimeType: string
    url: string
    iconUrl?: string
}

// ── Google SDK types ──────────────────────────────────────────────────────────

interface DrivePicker {
    setVisible: (visible: boolean) => void
    dispose: () => void
}

interface GooglePickerView {
    setIncludeFolders: (include: boolean) => void
}

interface GooglePickerBuilder {
    addView: (view: GooglePickerView) => GooglePickerBuilder
    setOAuthToken: (token: string) => GooglePickerBuilder
    setDeveloperKey: (key: string) => GooglePickerBuilder
    setCallback: (callback: (data: GooglePickerResponse) => void) => GooglePickerBuilder
    setTitle: (title: string) => GooglePickerBuilder
    build: () => DrivePicker
}

interface GooglePickerResponse {
    action: string
    docs?: Array<{
        id: string
        name: string
        mimeType: string
        url: string
        iconUrl?: string
    }>
}

declare global {
    interface Window {
        google?: {
            picker: {
                DocsView: new () => GooglePickerView
                PickerBuilder: new () => GooglePickerBuilder
                Action: { PICKED: string; CANCEL: string }
            }
        }
        gapi?: {
            load: (api: string, callback: () => void) => void
        }
    }
}

// ── Script loader ─────────────────────────────────────────────────────────────

function loadPickerSDK(): Promise<void> {
    return new Promise((resolve, reject) => {
        const src = 'https://apis.google.com/js/api.js'
        if (window.gapi) {
            window.gapi.load('picker', resolve)
            return
        }
        if (document.querySelector(`script[src="${src}"]`)) {
            const poll = setInterval(() => {
                if (window.gapi) {
                    clearInterval(poll)
                    window.gapi.load('picker', resolve)
                }
            }, 50)
            return
        }
        const script = document.createElement('script')
        script.src = src
        script.async = true
        script.onload = () => window.gapi!.load('picker', resolve)
        script.onerror = () => reject(new Error('Failed to load Google Picker SDK'))
        document.head.appendChild(script)
    })
}

// ── Hook ──────────────────────────────────────────────────────────────────────

interface UseDrivePickerOptions {
    onFilePicked: (file: DriveFile) => void
    onError?: (err: string) => void
}

export function useDrivePicker({ onFilePicked, onError }: UseDrivePickerOptions) {
    const pickerRef = useRef<DrivePicker | null>(null)
    const { googleApiKey, apiBaseUrl } = useConfig()

    useEffect(() => {
        return () => { pickerRef.current?.dispose() }
    }, [])

    const openPicker = useCallback(async () => {
        try {
            if (!googleApiKey) {
                onError?.('Google integration is not configured')
                return
            }

            // Fetch a valid access token from our server — no client-side OAuth needed
            // since the user already granted access during Google sign-in
            const res = await fetch(`${apiBaseUrl}/api/google/picker-token`)
            if (!res.ok) {
                const body = await res.json().catch(() => ({}))
                if (body.code === 'NO_TOKEN') {
                    onError?.('Connect your Google account in Settings to use Drive')
                } else {
                    onError?.('Failed to access Google Drive')
                }
                return
            }

            const { accessToken } = await res.json()

            await loadPickerSDK()

            const view = new window.google!.picker.DocsView()
            view.setIncludeFolders(false)

            const picker = new window.google!.picker.PickerBuilder()
                .addView(view)
                .setOAuthToken(accessToken)
                .setDeveloperKey(googleApiKey)
                .setTitle('Select a file from Google Drive')
                .setCallback((data: GooglePickerResponse) => {
                    if (data.action === window.google!.picker.Action.PICKED && data.docs?.[0]) {
                        const doc = data.docs[0]
                        onFilePicked({
                            id: doc.id,
                            name: doc.name,
                            mimeType: doc.mimeType,
                            url: doc.url,
                            iconUrl: doc.iconUrl,
                        })
                    }
                    pickerRef.current?.dispose()
                    pickerRef.current = null
                })
                .build()

            pickerRef.current = picker
            picker.setVisible(true)
        } catch (err) {
            console.error('Drive picker error:', err)
            onError?.('Failed to open Google Drive')
        }
    }, [onFilePicked, onError, googleApiKey, apiBaseUrl])

    return { openPicker }
}
