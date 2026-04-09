import {
  DashboardLayout,
  TasksContainer,
  TaskDetailContainer,
  CreateTaskDrawer,
  ProgressFeedSheet,
  SettingsView,
  AppearanceSettings,
  MessagesContainer,
  ChitChatContainer,
  VoiceChannelProvider,
} from '@taskflow/features';
import { FilePreview } from '@taskflow/ui';
import { useAuthStore } from '@/stores/auth';
import { DesktopNotificationsSettings, DesktopAboutSettings } from '@/components/settings';

// Web app URL for API routes (Daily.co room/token endpoints)
const WEB_API_URL = 'https://tms.intakesense.com';

interface DashboardPageProps {
  currentPath: string;
}

export function DashboardPage({ currentPath }: DashboardPageProps) {
  const renderContent = () => {
    // Settings
    if (currentPath.startsWith('/settings')) {
      return <DesktopSettingsView />;
    }

    // Messages
    if (currentPath.startsWith('/chat') || currentPath.startsWith('/messages')) {
      return (
        <MessagesContainer
          renderFilePreview={(props) => (
            <FilePreview file={props.file} onRemove={props.onRemove} />
          )}
        />
      );
    }

    // ChitChat voice/video
    if (currentPath.startsWith('/chitchat')) {
      return <ChitChatContainer />;
    }

    // Task detail view - /tasks/:id
    const taskMatch = currentPath.match(/^\/tasks\/([a-f0-9-]+)$/i);
    if (taskMatch) {
      return <TaskDetailContainer taskId={taskMatch[1]} />;
    }

    // Tasks list with Kanban view (default for / and /tasks)
    return (
      <TasksContainer
        renderCreateTask={(props) => (
          <CreateTaskDrawer
            open={props.open}
            onOpenChange={props.onOpenChange}
            initialSelectedUserIds={props.initialSelectedUserIds}
          />
        )}
        renderProgressFeed={() => <ProgressFeedSheet />}
      />
    );
  };

  // VoiceChannelProvider wraps entire dashboard so voice persists across tab changes
  return (
    <VoiceChannelProvider apiBaseUrl={WEB_API_URL}>
      <DashboardLayout>
        {renderContent()}
      </DashboardLayout>
    </VoiceChannelProvider>
  );
}

function DesktopSettingsView() {
  const { signOut } = useAuthStore();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <SettingsView onSignOut={handleSignOut}>
      <AppearanceSettings />
      <DesktopNotificationsSettings />
      <DesktopAboutSettings />
    </SettingsView>
  );
}
