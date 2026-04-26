'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
} from '@taskflow/ui';
import { type ThemeMode, type ThemePreset, type ChatPatternType } from '@taskflow/core';
import { Palette, Sun, Moon, Monitor } from 'lucide-react';
import { useThemeContext } from '../../providers/theme-context';

/**
 * Appearance settings section.
 * Reads from and writes to the shared ThemeProvider context.
 * Wrap your app in <ThemeProvider> before rendering this.
 */
export function AppearanceSettings() {
  const { mode, preset, theme, setMode, setPreset, updateCustomTheme } = useThemeContext();
  const chatPattern = theme.effects.chatPattern || 'none';

  const modes: { value: ThemeMode; icon: typeof Sun; label: string }[] = [
    { value: 'light', icon: Sun, label: 'Light' },
    { value: 'dark', icon: Moon, label: 'Dark' },
    { value: 'system', icon: Monitor, label: 'Auto' },
  ];

  const styles: { value: ThemePreset; label: string }[] = [
    { value: 'modern', label: 'Modern' },
    { value: 'glass', label: 'Glass' },
    { value: 'neumorphism', label: 'Soft' },
    { value: 'y2k', label: 'Retro' },
  ];

  const patterns: { value: ChatPatternType; label: string }[] = [
    { value: 'none', label: 'None' },
    { value: 'dots', label: 'Dots' },
    { value: 'grid', label: 'Grid' },
    { value: 'waves', label: 'Waves' },
    { value: 'confetti', label: 'Confetti' },
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
                onClick={() => setMode(value)}
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
                onClick={() => setPreset(value)}
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
                onClick={() => updateCustomTheme({ effects: { ...theme.effects, chatPattern: value } })}
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
