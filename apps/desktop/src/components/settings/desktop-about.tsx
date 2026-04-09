import { Info } from 'lucide-react';
import { SettingsSection } from '@taskflow/features';

/**
 * Desktop-specific about section.
 * Shows app version and platform info.
 */
export function DesktopAboutSettings() {
  return (
    <SettingsSection
      title="About"
      description="Application information"
      icon={<Info className="h-5 w-5" />}
    >
      <div className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Version</span>
          <span className="font-medium">0.1.0</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Platform</span>
          <span className="font-medium">Desktop (Tauri)</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Build</span>
          <span className="font-medium font-mono text-xs">
            {import.meta.env.MODE === 'production' ? 'Release' : 'Development'}
          </span>
        </div>
      </div>
    </SettingsSection>
  );
}
