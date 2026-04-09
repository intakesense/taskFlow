// Theme utility functions
import type { ThemeColors, ThemeConfig, ThemeEffects, ThemeFonts } from './types';
import { CSS_VAR_MAP } from './types';

// Apply theme colors to CSS variables
export function applyThemeColors(colors: ThemeColors): void {
  const root = document.documentElement;
  Object.entries(colors).forEach(([key, value]) => {
    const cssVar = CSS_VAR_MAP[key as keyof ThemeColors];
    if (cssVar) {
      root.style.setProperty(cssVar, value);
    }
  });
}

// Apply theme effects as CSS classes
export function getEffectClasses(effects: ThemeEffects): string {
  const classes: string[] = [];

  if (effects.glassmorphism) classes.push('theme-glass');
  if (effects.neumorphism) classes.push('theme-neumorphism');
  if (effects.gradients) classes.push('theme-gradients');
  if (effects.animations) classes.push('theme-animated');

  classes.push(`theme-shadows-${effects.shadows}`);
  classes.push(`theme-radius-${effects.borderRadius}`);

  return classes.join(' ');
}

// Apply fonts to CSS variables
export function applyThemeFonts(fonts: ThemeFonts): void {
  const root = document.documentElement;
  root.style.setProperty('--font-heading', `"${fonts.heading}", sans-serif`);
  root.style.setProperty('--font-body', `"${fonts.body}", sans-serif`);
  root.style.setProperty('--font-mono', `"${fonts.mono}", monospace`);
}

// Get system color scheme preference
export function getSystemColorScheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// Merge theme configs
export function mergeTheme(base: ThemeConfig, overrides: Partial<ThemeConfig>): ThemeConfig {
  return {
    ...base,
    ...overrides,
    colors: {
      light: { ...base.colors.light, ...overrides.colors?.light },
      dark: { ...base.colors.dark, ...overrides.colors?.dark },
    },
    effects: { ...base.effects, ...overrides.effects },
    fonts: { ...base.fonts, ...overrides.fonts },
  };
}

// Local storage keys
export const THEME_STORAGE_KEY = 'taskflow-theme';
export const CUSTOM_THEME_STORAGE_KEY = 'taskflow-custom-theme';

// Persist theme to localStorage
export function persistTheme(preset: string, mode: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify({ preset, mode }));
}

// Load theme from localStorage
export function loadPersistedTheme(): { preset: string; mode: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

// Persist custom theme
export function persistCustomTheme(theme: Partial<ThemeConfig>): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CUSTOM_THEME_STORAGE_KEY, JSON.stringify(theme));
}

// Load custom theme
export function loadCustomTheme(): Partial<ThemeConfig> | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(CUSTOM_THEME_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

// Apply full theme (convenience function)
export function applyTheme(config: ThemeConfig, resolvedMode: 'light' | 'dark'): void {
  const colors = resolvedMode === 'dark' ? config.colors.dark : config.colors.light;
  applyThemeColors(colors);
  applyThemeFonts(config.fonts);

  // Apply mode class
  document.documentElement.classList.remove('light', 'dark');
  document.documentElement.classList.add(resolvedMode);

  // Apply effect classes
  const effectClasses = getEffectClasses(config.effects);
  document.documentElement.setAttribute('data-theme-effects', effectClasses);
}
