'use client'

import { useEffect, useCallback, useRef } from 'react'

/**
 * Hook to handle browser back button navigation in chat views.
 * When entering a chat, pushes a history state. When back is pressed,
 * it calls the onBack callback instead of navigating away from the app.
 * 
 * @param isInChat - Whether the user is currently viewing a chat
 * @param onBack - Callback to execute when back button is pressed
 * @param enabled - Whether to enable back navigation handling (default: true)
 */
export function useBackNavigation(
    isInChat: boolean,
    onBack: () => void,
    enabled: boolean = true
) {
    const hasSetupRef = useRef(false)
    const isInChatRef = useRef(isInChat)

    // Keep ref in sync with prop
    useEffect(() => {
        isInChatRef.current = isInChat
    }, [isInChat])

    // Handle popstate (back button)
    const handlePopState = useCallback((event: PopStateEvent) => {
        // Only handle if we're in a chat and this was our pushed state
        if (isInChatRef.current && event.state?.chatView) {
            // Prevent the default back navigation
            onBack()
        }
    }, [onBack])

    useEffect(() => {
        if (!enabled) return

        // When entering chat, push a state
        if (isInChat && !hasSetupRef.current) {
            // Push a new history state to capture the back button
            window.history.pushState({ chatView: true }, '', window.location.href)
            hasSetupRef.current = true
        }

        // When leaving chat, reset the flag
        if (!isInChat && hasSetupRef.current) {
            hasSetupRef.current = false
        }
    }, [isInChat, enabled])

    useEffect(() => {
        if (!enabled) return

        window.addEventListener('popstate', handlePopState)
        return () => {
            window.removeEventListener('popstate', handlePopState)
        }
    }, [handlePopState, enabled])
}
