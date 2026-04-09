// Theme Types for TaskFlow
// Supports: modern, glass, neumorphism, y2k, custom

export type ThemePreset = 'modern' | 'glass' | 'neumorphism' | 'y2k' | 'custom';

export type ThemeMode = 'light' | 'dark' | 'system';

export type ChatPatternType = 'none' | 'dots' | 'grid' | 'waves' | 'confetti';

export interface ThemeColors {
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  accent: string;
  accentForeground: string;
  background: string;
  foreground: string;
  muted: string;
  mutedForeground: string;
  card: string;
  cardForeground: string;
  border: string;
  input: string;
  ring: string;
  destructive: string;
}

export interface ThemeEffects {
  glassmorphism: boolean;
  neumorphism: boolean;
  gradients: boolean;
  shadows: 'none' | 'subtle' | 'medium' | 'dramatic';
  borderRadius: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  animations: boolean;
  chatPattern: ChatPatternType;
}

export interface ThemeFonts {
  heading: string;
  body: string;
  mono: string;
}

export interface ThemeConfig {
  preset: ThemePreset;
  mode: ThemeMode;
  colors: {
    light: ThemeColors;
    dark: ThemeColors;
  };
  effects: ThemeEffects;
  fonts: ThemeFonts;
}

export interface ThemeContextValue {
  theme: ThemeConfig;
  preset: ThemePreset;
  mode: ThemeMode;
  resolvedMode: 'light' | 'dark';
  setPreset: (preset: ThemePreset) => void;
  setMode: (mode: ThemeMode) => void;
  updateCustomTheme: (updates: Partial<ThemeConfig>) => void;
  resetTheme: () => void;
}

// CSS variable mapping
export const CSS_VAR_MAP: Record<keyof ThemeColors, string> = {
  primary: '--primary',
  primaryForeground: '--primary-foreground',
  secondary: '--secondary',
  secondaryForeground: '--secondary-foreground',
  accent: '--accent',
  accentForeground: '--accent-foreground',
  background: '--background',
  foreground: '--foreground',
  muted: '--muted',
  mutedForeground: '--muted-foreground',
  card: '--card',
  cardForeground: '--card-foreground',
  border: '--border',
  input: '--input',
  ring: '--ring',
  destructive: '--destructive',
} as const;