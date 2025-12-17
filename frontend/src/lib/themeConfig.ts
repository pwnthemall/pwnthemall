export type ThemeType = 'light' | 'dark';

export const themeTypeMap: Record<string, ThemeType> = {
  // Light themes - use dark logo
  'light': 'light',
  'latte': 'light',
  
  // Dark themes - use light logo
  'dark': 'dark',
  'slate': 'dark',
  'macchiato': 'dark',
  'mocha': 'dark',
  'cyberpunk': 'dark',
  'emerald': 'dark',
  'violet': 'dark',
  'orange': 'dark',
};

export function getThemeType(theme: string | undefined): ThemeType {
  if (!theme) return 'light';
  return themeTypeMap[theme] || 'light';
}

export function getThemeLogo(theme: string | undefined): string {
  const type = getThemeType(theme);
  return type === 'dark' 
    ? '/logo-v2-text-dark.png' 
    : '/logo-v2-text-light.png';
}
