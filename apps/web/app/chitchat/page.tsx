'use client';

import { ChitChatContainer, DashboardLayout } from '@taskflow/features';
import { AIBotManager } from '@/components/ai-chat/ai-bot-manager';

export default function ChitChatPage() {
  return (
    <DashboardLayout>
      {/* AIBotManager is web-only: manages the OpenAI Realtime session for
          the voice channel bot when the current user is the host */}
      <AIBotManager />
      <ChitChatContainer />
    </DashboardLayout>
  );
}
