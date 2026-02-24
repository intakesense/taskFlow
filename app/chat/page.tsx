'use client'

import { MessagesContainer } from '@/components/messages/messages-container'

export default function ChatPage() {
  // Auth handled by middleware - redirects to /login if not authenticated
  // React Query cache provides instant re-navigation (no skeleton flash)
  return <MessagesContainer />
}