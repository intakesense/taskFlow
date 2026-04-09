'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
} from '@taskflow/ui';
import {
  type ThemeMode,
  type ThemePreset,
  type ChatPatternType,
  THEME_PRESETS,
  applyTheme,
  persistTheme,
  persistCustomTheme,
  loadPersistedTheme,
  loadCustomTheme,
  getSystemColorScheme,
} from '@taskflow/core';
import { Palette, Sun, Moon, Monitor } from 'lucide-react';

interface AppearanceSettingsProps {
  /** Called when theme changes */
  onThemeChange?: (preset: ThemePreset, mode: ThemeMode) => void;
}

/**
 * Appearance settings section with theme mode, style, and chat pattern toggles.
 * Uses shared theme system from @taskflow/core.
 */
export function AppearanceSettings({ onThemeChange }: AppearanceSettingsProps) {
  const [mode, setMode] = useState<ThemeMode>('dark');
  const [preset, setPreset] = useState<ThemePreset>('modern');
  const [chatPattern, setChatPattern] = useState<ChatPatternType>('none');
  const [mounted, setMounted] = useState(false);

  // Load persisted settings on mount
  useEffect(() => {
    const persisted = loadPersistedTheme();
    if (persisted) {
      setPreset(persisted.preset as ThemePreset);
      setMode(persisted.mode as ThemeMode);
    }

    const customTheme = loadCustomTheme();
    if (customTheme?.effects?.chatPattern) {
      setChatPattern(customTheme.effects.chatPattern);
    }

    setMounted(true);
  }, []);

  // Apply theme whenever mode/preset changes
  useEffect(() => {
    if (!mounted) return;

    const themeConfig = THEME_PRESETS[preset] || THEME_PRESETS.modern;
    const resolvedMode = mode === 'system' ? getSystemColorScheme() : mode;

    // Merge custom chat pattern
    const finalConfig = {
      ...themeConfig,
      effects: { ...themeConfig.effects, chatPattern },
    };

    applyTheme(finalConfig, resolvedMode);
  }, [mode, preset, chatPattern, mounted]);

  // Listen for system color scheme changes when in 'system' mode
  useEffect(() => {
    if (!mounted || mode !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const themeConfig = THEME_PRESETS[preset] || THEME_PRESETS.modern;
      const resolvedMode = getSystemColorScheme();
      const finalConfig = {
        ...themeConfig,
        effects: { ...themeConfig.effects, chatPattern },
      };
      applyTheme(finalConfig, resolvedMode);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [mode, preset, chatPattern, mounted]);

  const handleModeChange = useCallback((newMode: ThemeMode) => {
    setMode(newMode);
    persistTheme(preset, newMode);
    onThemeChange?.(preset, newMode);
  }, [preset, onThemeChange]);

  const handlePresetChange = useCallback((newPreset: ThemePreset) => {
    setPreset(newPreset);
    persistTheme(newPreset, mode);
    onThemeChange?.(newPreset, mode);
  }, [mode, onThemeChange]);

  const handlePatternChange = useCallback((newPattern: ChatPatternType) => {
    setChatPattern(newPattern);
    persistCustomTheme({ effects: { chatPattern: newPattern } as any });
  }, []);

  const modes = [
    { value: 'light' as const, icon: Sun, label: 'Light' },
    { value: 'dark' as const, icon: Moon, label: 'Dark' },
    { value: 'system' as const, icon: Monitor, label: 'Auto' },
  ];

  const styles = [
    { value: 'modern' as const, label: 'Modern' },
    { value: 'glass' as const, label: 'Glass' },
    { value: 'neumorphism' as const, label: 'Soft' },
    { value: 'y2k' as const, label: 'Retro' },
  ];

  const patterns = [
    { value: 'none' as const, label: 'None' },
    { value: 'dots' as const, label: 'Dots' },
    { value: 'grid' as const, label: 'Grid' },
    { value: 'waves' as const, label: 'Waves' },
    { value: 'confetti' as const, label: 'Confetti' },
  ];

  return (
    <Card data-slot="card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          Appearance
        </CardTitle>
        <CardDescription>Customize the look and feel</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Theme Mode */}
        <div className="space-y-2">
          <Label className="text-sm">Mode</Label>
          <div className="grid grid-cols-3 gap-1.5 rounded-lg bg-muted p-1">
            {modes.map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                onClick={() => handleModeChange(value)}
                className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  mode === value
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Theme Style */}
        <div className="space-y-2">
          <Label className="text-sm">Style</Label>
          <div className="grid grid-cols-4 gap-1.5 rounded-lg bg-muted p-1">
            {styles.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => handlePresetChange(value)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  preset === value
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Chat Pattern */}
        <div className="space-y-2">
          <Label className="text-sm">Chat Pattern</Label>
          <div className="grid grid-cols-5 gap-1.5 rounded-lg bg-muted p-1">
            {patterns.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => handlePatternChange(value)}
                className={`px-2 py-1.5 rounded-md text-xs font-medium transition-all ${
                  chatPattern === value
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
