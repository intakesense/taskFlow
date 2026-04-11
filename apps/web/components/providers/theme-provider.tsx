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
    ThemeConfig,
    ThemeEffects,
    ThemeMode,
    ThemePreset,
    ThemeContextValue,
} from '@/lib/theme/types';
import {
    THEME_PRESETS,
    DEFAULT_THEME,
} from '@/lib/theme/presets';
import { FONT_IMPORTS } from '@/lib/theme/fonts';
import {
    applyThemeColors,
    applyThemeFonts,
    getEffectClasses,
    getSystemColorScheme,
    persistTheme,
    loadPersistedTheme,
    mergeTheme,
    persistCustomTheme,
    loadCustomTheme,
} from '@/lib/theme/utils';

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

interface ThemeProviderProps {
    children: ReactNode;
    defaultPreset?: ThemePreset;
    defaultMode?: ThemeMode;
}

export function ThemeProvider({
    children,
    defaultPreset = 'modern',
    defaultMode = 'system',
}: ThemeProviderProps) {
    const [theme, setTheme] = useState<ThemeConfig>(() => {
        return THEME_PRESETS[defaultPreset] || DEFAULT_THEME;
    });
    const [mode, setModeState] = useState<ThemeMode>(defaultMode);
    const [resolvedMode, setResolvedMode] = useState<'light' | 'dark'>('light');
    const [mounted, setMounted] = useState(false);

    // Load persisted theme on mount
    useEffect(() => {
        const persisted = loadPersistedTheme();
        let baseTheme = THEME_PRESETS[defaultPreset] || DEFAULT_THEME;

        if (persisted) {
            const presetTheme = THEME_PRESETS[persisted.preset];
            if (presetTheme) {
                baseTheme = presetTheme;
                setModeState(persisted.mode as ThemeMode);
            }
        }

        // Always load custom overrides (for settings like chatPattern)
        const customTheme = loadCustomTheme();
        if (customTheme?.effects?.chatPattern) {
            // Only merge chatPattern — never let stored effects override preset-controlled
            // fields (borderRadius, glassmorphism, etc.) which belong to the preset.
            const mergedTheme = {
                ...baseTheme,
                effects: { ...baseTheme.effects, chatPattern: customTheme.effects.chatPattern },
            };
            setTheme(mergedTheme);
        } else {
            setTheme(baseTheme);
        }

        setMounted(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Resolve system mode
    useEffect(() => {
        if (mode === 'system') {
            setResolvedMode(getSystemColorScheme());
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            const handler = (e: MediaQueryListEvent) => {
                setResolvedMode(e.matches ? 'dark' : 'light');
            };
            mediaQuery.addEventListener('change', handler);
            return () => mediaQuery.removeEventListener('change', handler);
        } else {
            setResolvedMode(mode);
        }
    }, [mode]);

    // Apply theme when it changes
    useEffect(() => {
        if (!mounted) return;

        const colors = resolvedMode === 'dark' ? theme.colors.dark : theme.colors.light;
        applyThemeColors(colors);
        applyThemeFonts(theme.fonts);

        // Apply mode class
        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add(resolvedMode);

        // Apply effect classes
        const effectClasses = getEffectClasses(theme.effects);
        document.documentElement.setAttribute('data-theme-effects', effectClasses);

    }, [theme, resolvedMode, mounted]);

    // Load font
    useEffect(() => {
        if (!mounted) return;
        const fontUrl = FONT_IMPORTS[theme.preset];
        if (fontUrl) {
            const linkId = 'theme-fonts';
            let link = document.getElementById(linkId) as HTMLLinkElement;
            if (!link) {
                link = document.createElement('link');
                link.id = linkId;
                link.rel = 'stylesheet';
                document.head.appendChild(link);
            }
            link.href = fontUrl;
        }
    }, [theme.preset, mounted]);

    const setPreset = useCallback((preset: ThemePreset) => {
        const presetTheme = THEME_PRESETS[preset];
        if (presetTheme) {
            // Only merge chatPattern from custom storage — not preset-controlled fields
            const customTheme = loadCustomTheme();
            const mergedEffects = customTheme?.effects?.chatPattern
                ? { ...presetTheme.effects, chatPattern: customTheme.effects.chatPattern }
                : presetTheme.effects;

            setTheme({
                ...presetTheme,
                effects: mergedEffects,
            });
            persistTheme(preset, mode);
        }
    }, [mode]);

    const setMode = useCallback((newMode: ThemeMode) => {
        setModeState(newMode);
        persistTheme(theme.preset, newMode);
    }, [theme.preset]);

    const updateCustomTheme = useCallback((updates: Partial<ThemeConfig>) => {
        setTheme((prev) => {
            // Merge updates while keeping the current preset
            const merged = mergeTheme(prev, updates);
            // Only persist user-overrideable fields (chatPattern), NOT preset-controlled
            // fields like borderRadius, glassmorphism, etc. — those come from the preset.
            persistCustomTheme({ effects: { chatPattern: merged.effects.chatPattern } as ThemeEffects });
            return merged;
        });
    }, []);

    const resetTheme = useCallback(() => {
        setTheme(DEFAULT_THEME);
        setModeState('system');
        persistTheme('modern', 'system');
    }, []);

    // Prevent hydration mismatch
    if (!mounted) {
        return <>{children}</>;
    }

    return (
        <ThemeContext.Provider
            value={{
                theme,
                preset: theme.preset,
                mode,
                resolvedMode,
                setPreset,
                setMode,
                updateCustomTheme,
                resetTheme,
            }}
        >
            {children}
        </ThemeContext.Provider>
    );
}

export function useThemeContext() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useThemeContext must be used within a ThemeProvider');
    }
    return context;
}
