'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import {
  type ThemeConfig,
  type ThemeEffects,
  type ThemeMode,
  type ThemePreset,
  type ThemeContextValue,
  THEME_PRESETS,
  DEFAULT_THEME,
  applyThemeColors,
  applyThemeFonts,
  getEffectClasses,
  getSystemColorScheme,
  persistTheme,
  loadPersistedTheme,
  mergeTheme,
  persistCustomTheme,
  loadCustomTheme,
} from '@taskflow/core';

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
  defaultPreset?: ThemePreset;
  defaultMode?: ThemeMode;
  /**
   * Called when the active preset changes — use to load platform-specific
   * font assets (e.g. Next.js injects a <link> tag, desktop does nothing).
   */
  onPresetChange?: (preset: ThemePreset) => void;
}

export function ThemeProvider({
  children,
  defaultPreset = 'modern',
  defaultMode = 'system',
  onPresetChange,
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<ThemeConfig>(() => THEME_PRESETS[defaultPreset] || DEFAULT_THEME);
  const [mode, setModeState] = useState<ThemeMode>(defaultMode);
  const [resolvedMode, setResolvedMode] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  // Load persisted theme on mount
  useEffect(() => {
    const persisted = loadPersistedTheme();
    let baseTheme = THEME_PRESETS[defaultPreset] || DEFAULT_THEME;

    if (persisted) {
      const presetTheme = THEME_PRESETS[persisted.preset as ThemePreset];
      if (presetTheme) {
        baseTheme = presetTheme;
        setModeState(persisted.mode as ThemeMode);
      }
    }

    // Merge only chatPattern — never let stored effects override preset-controlled fields
    const customTheme = loadCustomTheme();
    if (customTheme?.effects?.chatPattern) {
      setTheme({ ...baseTheme, effects: { ...baseTheme.effects, chatPattern: customTheme.effects.chatPattern } });
    } else {
      setTheme(baseTheme);
    }

    // Notify platform-specific font loader so fonts load even on page reload
    onPresetChange?.(baseTheme.preset);
    setMounted(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resolve system mode
  useEffect(() => {
    if (mode === 'system') {
      setResolvedMode(getSystemColorScheme());
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = (e: MediaQueryListEvent) => setResolvedMode(e.matches ? 'dark' : 'light');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    } else {
      setResolvedMode(mode);
    }
  }, [mode]);

  // Apply theme whenever it changes
  useEffect(() => {
    if (!mounted) return;
    const colors = resolvedMode === 'dark' ? theme.colors.dark : theme.colors.light;
    applyThemeColors(colors);
    applyThemeFonts(theme.fonts);
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(resolvedMode);
    document.documentElement.setAttribute('data-theme-effects', getEffectClasses(theme.effects));
  }, [theme, resolvedMode, mounted]);

  const setPreset = useCallback((preset: ThemePreset) => {
    const presetTheme = THEME_PRESETS[preset];
    if (!presetTheme) return;
    const customTheme = loadCustomTheme();
    const mergedEffects = customTheme?.effects?.chatPattern
      ? { ...presetTheme.effects, chatPattern: customTheme.effects.chatPattern }
      : presetTheme.effects;
    setTheme({ ...presetTheme, effects: mergedEffects });
    persistTheme(preset, mode);
    onPresetChange?.(preset);
  }, [mode, onPresetChange]);

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    persistTheme(theme.preset, newMode);
  }, [theme.preset]);

  const updateCustomTheme = useCallback((updates: Partial<ThemeConfig>) => {
    setTheme((prev) => {
      const merged = mergeTheme(prev, updates);
      persistCustomTheme({ effects: { chatPattern: merged.effects.chatPattern } as ThemeEffects });
      return merged;
    });
  }, []);

  const resetTheme = useCallback(() => {
    setTheme(DEFAULT_THEME);
    setModeState('system');
    persistTheme('modern', 'system');
  }, []);

  if (!mounted) return null;

  return (
    <ThemeContext.Provider value={{ theme, preset: theme.preset, mode, resolvedMode, setPreset, setMode, updateCustomTheme, resetTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeContext must be used within ThemeProvider');
  return ctx;
}
