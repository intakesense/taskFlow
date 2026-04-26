'use client';

import { ReactNode } from 'react';
import { ThemeProvider as SharedThemeProvider, useThemeContext } from '@taskflow/features';
import { type ThemePreset } from '@taskflow/core';
import { FONT_IMPORTS } from '@/lib/theme/fonts';

function loadFont(preset: ThemePreset) {
  const fontUrl = FONT_IMPORTS[preset];
  if (!fontUrl) return;
  const linkId = 'theme-fonts';
  let link = document.getElementById(linkId) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }
  link.href = fontUrl;
}

interface ThemeProviderProps {
  children: ReactNode;
  defaultPreset?: ThemePreset;
  defaultMode?: 'light' | 'dark' | 'system';
}

export function ThemeProvider({ children, defaultPreset, defaultMode }: ThemeProviderProps) {
  return (
    <SharedThemeProvider
      defaultPreset={defaultPreset}
      defaultMode={defaultMode}
      onPresetChange={loadFont}
    >
      {children}
    </SharedThemeProvider>
  );
}

// Re-export so existing imports of useThemeContext from this file keep working
export { useThemeContext };
