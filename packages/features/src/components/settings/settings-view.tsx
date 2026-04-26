'use client';

import { ReactNode, useRef, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  Button,
} from '@taskflow/ui';
import {
  Settings,
  User,
  LogOut,
  Loader2,
  Camera,
  Trash2,
  Eye,
  X,
} from 'lucide-react';
import { useAuth } from '../../providers/auth-context';
import { OptimizedImage } from '../primitives';

export interface AvatarHandlers {
  onUpload: (file: File) => Promise<void>;
  onDelete: () => Promise<void>;
}

interface SettingsViewProps {
  /** Platform-specific sections to render after profile */
  children?: ReactNode;
  /** Called when user clicks sign out */
  onSignOut?: () => Promise<void>;
  /** Whether sign out is in progress */
  isSigningOut?: boolean;
  /** Custom profile image component (for Next.js Image optimization) */
  renderProfileImage?: (props: { src: string; alt: string; className: string }) => ReactNode;
  /** If provided, avatar upload/delete buttons are shown */
  avatarHandlers?: AvatarHandlers;
  /**
   * If provided, shows the "viewing as X" mask banner.
   * Pass the masked user's name.
   */
  maskedAsName?: string | null;
  /** Called when user clicks the X on the mask banner */
  onExitMask?: () => void;
}

/**
 * Shared settings view component.
 * Renders profile card (with optional avatar upload) and sign out button,
 * with slots for platform-specific sections.
 */
export function SettingsView({
  children,
  onSignOut,
  isSigningOut = false,
  renderProfileImage,
  avatarHandlers,
  maskedAsName,
  onExitMask,
}: SettingsViewProps) {
  const { profile, effectiveUser } = useAuth();
  const displayUser = effectiveUser || profile;
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !avatarHandlers) return;
    setIsUploading(true);
    try {
      await avatarHandlers.onUpload(file);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteAvatar = async () => {
    if (!avatarHandlers) return;
    setIsDeleting(true);
    try {
      await avatarHandlers.onDelete();
    } finally {
      setIsDeleting(false);
    }
  };

  const canEdit = avatarHandlers && !maskedAsName;

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
          {/* Mask-as banner */}
          {maskedAsName && (
            <div className="p-3 bg-amber-500/20 border border-amber-500/30 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-300 text-sm">
                  <Eye className="h-4 w-4" />
                  <span>Viewing as <strong>{maskedAsName}</strong> — profile shown is read-only</span>
                </div>
                {onExitMask && (
                  <button
                    onClick={onExitMask}
                    className="text-amber-300 hover:text-amber-200 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Profile Card */}
          <Card data-slot="card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile
              </CardTitle>
              <CardDescription>
                {maskedAsName ? `${maskedAsName}'s account information` : 'Your account information'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                {/* Avatar */}
                <div className={`relative shrink-0 ${canEdit ? 'group' : ''}`}>
                  {canEdit && (
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={handleAvatarChange}
                      className="hidden"
                    />
                  )}
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
                  {/* Hover overlay for upload */}
                  {canEdit && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      {isUploading ? (
                        <Loader2 className="h-6 w-6 text-white animate-spin" />
                      ) : (
                        <Camera className="h-6 w-6 text-white" />
                      )}
                    </button>
                  )}
                </div>

                <div className="flex-1 text-center sm:text-left min-w-0">
                  <p className="text-lg font-semibold truncate">{displayUser?.name}</p>
                  <p className="text-muted-foreground text-sm truncate">{displayUser?.email}</p>
                  {canEdit && (
                    <div className="flex justify-center sm:justify-start gap-2 mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                      >
                        {isUploading ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Camera className="h-4 w-4 mr-2" />
                        )}
                        {displayUser?.avatar_url ? 'Change' : 'Add Photo'}
                      </Button>
                      {displayUser?.avatar_url && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleDeleteAvatar}
                          disabled={isDeleting}
                          className="text-destructive hover:text-destructive"
                        >
                          {isDeleting ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 mr-2" />
                          )}
                          Remove
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {canEdit && (
                <p className="text-xs text-muted-foreground text-center sm:text-left">
                  Square image, at least 200×200px. Max 5MB.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Platform-specific sections */}
          {children}

          {/* Sign Out */}
          <button
            onClick={onSignOut}
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
  id?: string;
}

export function SettingsSection({ title, description, icon, children, id }: SettingsSectionProps) {
  return (
    <Card id={id} data-slot="card">
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
