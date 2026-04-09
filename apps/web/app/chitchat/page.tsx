'use client';

import { ChitChatContainer } from '@/components/voice/chitchat-container';

export default function ChitChatPage() {
  // Auth handled by middleware - redirects to /login if not authenticated
  // VoiceChannelProvider is already in root layout
  return <ChitChatContainer />;
}
