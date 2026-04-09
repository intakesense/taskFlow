import { ReactNode } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
} from '@taskflow/ui';
import { Settings, User, LogOut, Loader2 } from 'lucide-react';
import { useAuth } from '../../providers/auth-context';
import { OptimizedImage } from '../primitives';

interface SettingsViewProps {
  /** Platform-specific sections to render after profile */
  children?: ReactNode;
  /** Called when user clicks sign out */
  onSignOut?: () => Promise<void>;
  /** Whether sign out is in progress */
  isSigningOut?: boolean;
  /** Custom profile image component (for Next.js Image optimization) */
  renderProfileImage?: (props: { src: string; alt: string; className: string }) => ReactNode;
}

/**
 * Shared settings view component.
 * Renders profile card and sign out button, with slots for platform-specific sections.
 */
export function SettingsView({
  children,
  onSignOut,
  isSigningOut = false,
  renderProfileImage,
}: SettingsViewProps) {
  const { profile, effectiveUser } = useAuth();
  const displayUser = effectiveUser || profile;

  const handleSignOut = async () => {
    if (onSignOut) {
      await onSignOut();
    }
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground flex items-center gap-3">
            <Settings className="h-8 w-8" />
            Settings
          </h1>
          <p className="text-muted-foreground mt-1">
            Customize your TaskFlow experience
          </p>
        </div>

        <div className="space-y-6">
          {/* Profile Card */}
          <Card data-slot="card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile
              </CardTitle>
              <CardDescription>Your account information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                {/* Avatar */}
                <div className="relative shrink-0">
                  {displayUser?.avatar_url ? (
                    renderProfileImage ? (
                      renderProfileImage({
                        src: displayUser.avatar_url,
                        alt: displayUser.name || 'Avatar',
                        className: 'w-20 h-20 aspect-square rounded-full object-cover border-2 border-border',
                      })
                    ) : (
                      <OptimizedImage
                        src={displayUser.avatar_url}
                        alt={displayUser.name || 'Avatar'}
                        width={80}
                        height={80}
                        className="w-20 h-20 aspect-square rounded-full object-cover border-2 border-border"
                      />
                    )
                  ) : (
                    <div className="w-20 h-20 aspect-square rounded-full bg-primary flex items-center justify-center text-primary-foreground text-2xl font-bold border-2 border-border">
                      {displayUser?.name?.charAt(0).toUpperCase() || '?'}
                    </div>
                  )}
                </div>
                <div className="flex-1 text-center sm:text-left min-w-0">
                  <p className="text-lg font-semibold truncate">{displayUser?.name}</p>
                  <p className="text-muted-foreground text-sm truncate">{displayUser?.email}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Platform-specific sections */}
          {children}

          {/* Sign Out */}
          <button
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="w-full flex items-center justify-center gap-2 py-3 text-destructive hover:bg-destructive/5 rounded-lg transition-colors disabled:opacity-50"
          >
            {isSigningOut ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
            <span className="text-sm font-medium">Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Settings section card component for consistent styling.
 */
interface SettingsSectionProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
}

export function SettingsSection({ title, description, icon, children }: SettingsSectionProps) {
  return (
    <Card data-slot="card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">
        {children}
      </CardContent>
    </Card>
  );
}

/**
 * Settings row for toggle/switch items.
 */
interface SettingsRowProps {
  label: string;
  description?: string;
  children: ReactNode;
}

export function SettingsRow({ label, description, children }: SettingsRowProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="space-y-0.5">
        <Label>{label}</Label>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}