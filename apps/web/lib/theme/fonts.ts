// Web-only: Google Fonts URL map for each theme preset
import type { ThemePreset } from '@taskflow/core';

// Google Fonts import URLs
export const FONT_IMPORTS: Record<ThemePreset, string> = {
    modern: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap',
    glass: 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=DM+Sans:wght@400;500;600&family=Fira+Code:wght@400;500&display=swap',
    neumorphism: 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700&family=Nunito+Sans:wght@400;500;600&family=Source+Code+Pro:wght@400;500&display=swap',
    y2k: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Rubik:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap',
    custom: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap',
};

// Font display names for UI
export const FONT_OPTIONS = [
    { value: 'Inter', label: 'Inter', category: 'sans-serif' },
    { value: 'Outfit', label: 'Outfit', category: 'sans-serif' },
    { value: 'DM Sans', label: 'DM Sans', category: 'sans-serif' },
    { value: 'Nunito', label: 'Nunito', category: 'sans-serif' },
    { value: 'Nunito Sans', label: 'Nunito Sans', category: 'sans-serif' },
    { value: 'Space Grotesk', label: 'Space Grotesk', category: 'sans-serif' },
    { value: 'Rubik', label: 'Rubik', category: 'sans-serif' },
    { value: 'Poppins', label: 'Poppins', category: 'sans-serif' },
    { value: 'JetBrains Mono', label: 'JetBrains Mono', category: 'monospace' },
    { value: 'Fira Code', label: 'Fira Code', category: 'monospace' },
    { value: 'Source Code Pro', label: 'Source Code Pro', category: 'monospace' },
    { value: 'IBM Plex Mono', label: 'IBM Plex Mono', category: 'monospace' },
] as const;
