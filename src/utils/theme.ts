export interface Theme {
  name: string;
  primary: string;      // Main accent color
  secondary: string;    // Secondary text
  dim: string;          // Dimmed text
  success: string;      // Success color
  error: string;        // Error color
  warning: string;      // Warning color
  border: string;       // Border color
  bg: string;           // Background hint
  prompt: string;       // Prompt symbol color
  userLabel: string;    // "You:" label
  assistantLabel: string; // "TaseesCode:" label
}

export const THEMES: Record<string, Theme> = {
  silver: {
    name: 'Silver',
    primary: '#E8E8E8',
    secondary: '#8B8B8B',
    dim: '#4A4A4A',
    success: '#5A9E6F',
    error: '#C75050',
    warning: '#C9A962',
    border: '#707070',
    bg: '#1A1A1A',
    prompt: '#707070',
    userLabel: '#8B8B8B',
    assistantLabel: '#E8E8E8',
  },
  minimal: {
    name: 'Minimal',
    primary: '#FFFFFF',
    secondary: '#AAAAAA',
    dim: '#666666',
    success: '#77DD77',
    error: '#FF6B6B',
    warning: '#FFD93D',
    border: '#555555',
    bg: '#000000',
    prompt: '#AAAAAA',
    userLabel: '#AAAAAA',
    assistantLabel: '#FFFFFF',
  },
  dark: {
    name: 'Dark',
    primary: '#61AFEF',
    secondary: '#ABB2BF',
    dim: '#5C6370',
    success: '#98C379',
    error: '#E06C75',
    warning: '#E5C07B',
    border: '#3E4451',
    bg: '#282C34',
    prompt: '#61AFEF',
    userLabel: '#ABB2BF',
    assistantLabel: '#61AFEF',
  },
};

export function getTheme(name: string): Theme {
  return THEMES[name] || THEMES.silver;
}
