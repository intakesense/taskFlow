// Theme Presets: modern, glass, neumorphism, y2k, custom
import { ThemeConfig, ThemeColors, ThemeEffects } from './types';
import { THEME_FONTS } from './fonts';

// shadcn default colors (oklch)
const shadcnLightColors: ThemeColors = {
    primary: 'oklch(0.205 0 0)',
    primaryForeground: 'oklch(0.985 0 0)',
    secondary: 'oklch(0.97 0 0)',
    secondaryForeground: 'oklch(0.205 0 0)',
    accent: 'oklch(0.97 0 0)',
    accentForeground: 'oklch(0.205 0 0)',
    background: 'oklch(1 0 0)',
    foreground: 'oklch(0.145 0 0)',
    muted: 'oklch(0.97 0 0)',
    mutedForeground: 'oklch(0.556 0 0)',
    card: 'oklch(1 0 0)',
    cardForeground: 'oklch(0.145 0 0)',
    border: 'oklch(0.922 0 0)',
    input: 'oklch(0.922 0 0)',
    ring: 'oklch(0.708 0 0)',
    destructive: 'oklch(0.577 0.245 27.325)',
};

const shadcnDarkColors: ThemeColors = {
    primary: 'oklch(0.922 0 0)',
    primaryForeground: 'oklch(0.205 0 0)',
    secondary: 'oklch(0.269 0 0)',
    secondaryForeground: 'oklch(0.985 0 0)',
    accent: 'oklch(0.269 0 0)',
    accentForeground: 'oklch(0.985 0 0)',
    background: 'oklch(0.145 0 0)',
    foreground: 'oklch(0.985 0 0)',
    muted: 'oklch(0.269 0 0)',
    mutedForeground: 'oklch(0.708 0 0)',
    card: 'oklch(0.205 0 0)',
    cardForeground: 'oklch(0.985 0 0)',
    border: 'oklch(1 0 0 / 10%)',
    input: 'oklch(1 0 0 / 15%)',
    ring: 'oklch(0.556 0 0)',
    destructive: 'oklch(0.704 0.191 22.216)',
};

// Modern (clean, minimal - shadcn default)
const modernEffects: ThemeEffects = {
    glassmorphism: false,
    neumorphism: false,
    gradients: false,
    shadows: 'subtle',
    borderRadius: 'md',
    animations: true,
    chatPattern: 'none',
};

// Glass (glassmorphism with transparency)
const glassEffects: ThemeEffects = {
    glassmorphism: true,
    neumorphism: false,
    gradients: true,
    shadows: 'medium',
    borderRadius: 'lg',
    animations: true,
    chatPattern: 'waves',
};

const glassLightColors: ThemeColors = {
    ...shadcnLightColors,
    card: 'oklch(1 0 0 / 70%)',
    background: 'oklch(0.97 0.01 280)',
    primary: 'oklch(0.55 0.2 280)',
    primaryForeground: 'oklch(1 0 0)',
    accent: 'oklch(0.85 0.05 280 / 50%)',
};

const glassDarkColors: ThemeColors = {
    ...shadcnDarkColors,
    card: 'oklch(0.2 0.02 280 / 60%)',
    background: 'oklch(0.15 0.02 280)',
    primary: 'oklch(0.7 0.15 280)',
    primaryForeground: 'oklch(0.1 0 0)',
    accent: 'oklch(0.3 0.05 280 / 50%)',
    border: 'oklch(1 0 0 / 15%)',
};

// Neumorphism (soft shadows, embossed look)
const neumorphismEffects: ThemeEffects = {
    glassmorphism: false,
    neumorphism: true,
    gradients: false,
    shadows: 'dramatic',
    borderRadius: 'xl',
    animations: true,
    chatPattern: 'dots',
};

const neumorphismLightColors: ThemeColors = {
    ...shadcnLightColors,
    background: 'oklch(0.94 0.01 250)',
    card: 'oklch(0.94 0.01 250)',
    primary: 'oklch(0.55 0.15 250)',
    primaryForeground: 'oklch(1 0 0)',
    border: 'oklch(0.94 0.01 250)', // Same as bg for neumorphism
};

const neumorphismDarkColors: ThemeColors = {
    ...shadcnDarkColors,
    background: 'oklch(0.22 0.02 250)',
    card: 'oklch(0.22 0.02 250)',
    primary: 'oklch(0.6 0.12 250)',
    primaryForeground: 'oklch(0.1 0 0)',
    border: 'oklch(0.22 0.02 250)',
};

// Y2K (bold, playful, retro-futuristic)
const y2kEffects: ThemeEffects = {
    glassmorphism: true,
    neumorphism: false,
    gradients: true,
    shadows: 'dramatic',
    borderRadius: 'xl',
    animations: true,
    chatPattern: 'confetti',
};

const y2kLightColors: ThemeColors = {
    ...shadcnLightColors,
    primary: 'oklch(0.7 0.25 330)',      // Hot pink
    primaryForeground: 'oklch(1 0 0)',
    secondary: 'oklch(0.85 0.2 180)',    // Cyan
    secondaryForeground: 'oklch(0.2 0 0)',
    accent: 'oklch(0.9 0.2 100)',        // Lime
    accentForeground: 'oklch(0.2 0 0)',
    background: 'oklch(0.98 0.02 300)',
};

const y2kDarkColors: ThemeColors = {
    ...shadcnDarkColors,
    primary: 'oklch(0.75 0.25 330)',
    primaryForeground: 'oklch(0.1 0 0)',
    secondary: 'oklch(0.7 0.2 180)',
    secondaryForeground: 'oklch(0.1 0 0)',
    accent: 'oklch(0.8 0.2 100)',
    accentForeground: 'oklch(0.1 0 0)',
    background: 'oklch(0.12 0.03 280)',
};

// Theme presets
export const THEME_PRESETS: Record<string, ThemeConfig> = {
    modern: {
        preset: 'modern',
        mode: 'system',
        colors: {
            light: shadcnLightColors,
            dark: shadcnDarkColors,
        },
        effects: modernEffects,
        fonts: THEME_FONTS.modern,
    },
    glass: {
        preset: 'glass',
        mode: 'system',
        colors: {
            light: glassLightColors,
            dark: glassDarkColors,
        },
        effects: glassEffects,
        fonts: THEME_FONTS.glass,
    },
    neumorphism: {
        preset: 'neumorphism',
        mode: 'system',
        colors: {
            light: neumorphismLightColors,
            dark: neumorphismDarkColors,
        },
        effects: neumorphismEffects,
        fonts: THEME_FONTS.neumorphism,
    },
    y2k: {
        preset: 'y2k',
        mode: 'system',
        colors: {
            light: y2kLightColors,
            dark: y2kDarkColors,
        },
        effects: y2kEffects,
        fonts: THEME_FONTS.y2k,
    },
    custom: {
        preset: 'custom',
        mode: 'system',
        colors: {
            light: shadcnLightColors,
            dark: shadcnDarkColors,
        },
        effects: modernEffects,
        fonts: THEME_FONTS.modern,
    },
};

export const DEFAULT_THEME = THEME_PRESETS.modern;
