// Mirrors the CSS variables in index.css (ECharts needs literal colour strings).
export type ThemeName = 'light' | 'dark'

export interface Tokens {
  bg: string; surface: string; line: string; lineSoft: string
  fg: string; fg2: string; muted: string
  accent: string; accentSoft: string
  good: string; bad: string; goodSoft: string; badSoft: string
  cats: string[]
}

// Muted secondary palette (6 hues + 2 neutrals). Green and red are reserved for good/bad variance.
const catsLight = ['#5c7c9c', '#c9ae7c', '#c98a5a', '#5f9c9a', '#b87a8e', '#9a9a63', '#8d86b0', '#8a857a']
const catsDark = ['#7f9fc0', '#d6be92', '#d9a074', '#7dbab6', '#cf98a9', '#b4b481', '#a9a3cc', '#a8a398']

export const TOKENS: Record<ThemeName, Tokens> = {
  light: {
    bg: '#f6f4ee', surface: '#fdfcf9', line: '#e2ded2', lineSoft: '#ece9e0',
    fg: '#1b1a17', fg2: '#47433b', muted: '#6a655a',
    accent: '#4338ca', accentSoft: '#e8e7fa',
    good: '#17754a', bad: '#b3261e', goodSoft: '#e1f1e8', badSoft: '#f8e5e2',
    cats: catsLight,
  },
  dark: {
    bg: '#111110', surface: '#191917', line: '#2f2e2a', lineSoft: '#252421',
    fg: '#ece9e1', fg2: '#c9c5ba', muted: '#a29e93',
    accent: '#9a97f6', accentSoft: '#26253f',
    good: '#5cc08a', bad: '#f2857b', goodSoft: '#17281f', badSoft: '#301d1b',
    cats: catsDark,
  },
}

export const CATEGORY_ORDER = ['Furniture', 'Bedding & Bath', 'Kitchen & Dining', 'Decor', 'Lighting', 'Storage & Organization', 'Outdoor & Garden', 'Rugs & Textiles']
export const MKT_LABEL: Record<string, string> = { paid_search: 'Paid search', social: 'Social', email: 'Email', tv: 'TV', promotions: 'Promotions' }
