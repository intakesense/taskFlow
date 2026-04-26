import { useState } from 'react';
import { Info, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { SettingsSection } from './settings-view';
import { Button } from '@taskflow/ui';

export interface AboutSettingsProps {
  /** App version string, e.g. "0.1.0" or "1.2.3" */
  version: string;
  /** Platform label, e.g. "Web" or "Desktop (Tauri)" */
  platform: string;
  /** Build mode label, e.g. "Development" or "Release" */
  buildMode?: string;
  /** If provided, a "Check for updates" button is shown */
  onCheckUpdate?: () => Promise<void>;
}

/**
 * Shared about section. Pass platform-specific values as props.
 */
export function AboutSettings({ version, platform, buildMode, onCheckUpdate }: AboutSettingsProps) {
  const [checking, setChecking] = useState(false);

  const handleCheck = async () => {
    if (!onCheckUpdate) return;
    setChecking(true);
    try {
      await onCheckUpdate();
    } finally {
      setChecking(false);
    }
  };

  return (
    <SettingsSection
      title="About"
      description="Application information"
      icon={<Info className="h-5 w-5" />}
    >
      <div className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Version</span>
          <span className="font-medium">{version}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Platform</span>
          <span className="font-medium">{platform}</span>
        </div>
        {buildMode && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Build</span>
            <span className="font-medium font-mono text-xs">{buildMode}</span>
          </div>
        )}
        {onCheckUpdate && (
          <div className="pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCheck}
              disabled={checking}
              className="w-full gap-2"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${checking ? 'animate-spin' : ''}`} />
              {checking ? 'Checking…' : 'Check for Updates'}
            </Button>
          </div>
        )}
      </div>
    </SettingsSection>
  );
}
