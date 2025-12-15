/**
 * Theme Utilities
 * Helper functions for theme loading, validation, and CSS generation
 */

import type { ThemeConfig, ThemeColors } from './types';

/**
 * Load theme from JSON file
 */
export async function loadTheme(themeId: string): Promise<ThemeConfig> {
  try {
    const response = await fetch(`/themes/${themeId}.json`);
    if (!response.ok) {
      throw new Error(`Theme ${themeId} not found`);
    }
    const theme: ThemeConfig = await response.json();
    return theme;
  } catch (error) {
    console.error(`Failed to load theme ${themeId}:`, error);
    // Fallback to default theme
    return loadTheme('default');
  }
}

/**
 * Generate CSS variables from theme colors
 */
export function generateCSSVariables(colors: ThemeColors): Record<string, string> {
  const cssVars: Record<string, string> = {};
  
  Object.entries(colors).forEach(([key, value]) => {
    // Convert camelCase to kebab-case
    const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
    cssVars[`--color-${cssKey}`] = value;
  });
  
  return cssVars;
}

/**
 * Apply theme to document
 */
export function applyTheme(theme: ThemeConfig): void {
  const root = document.documentElement;
  
  // Set theme ID as data attribute
  root.dataset.theme = theme.id;
  
  // Apply color variables
  const cssVars = generateCSSVariables(theme.colors);
  Object.entries(cssVars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
  
  // Apply typography variables
  root.style.setProperty('--font-heading', theme.typography.fontFamily.heading);
  root.style.setProperty('--font-body', theme.typography.fontFamily.body);
  root.style.setProperty('--font-mono', theme.typography.fontFamily.mono);
  
  // Apply spacing scale
  root.style.setProperty('--spacing-scale', theme.spacing.scale.toString());
  
  // Apply effects
  root.style.setProperty('--transition-duration', `${theme.effects.transitionDuration || 200}ms`);
  
  // Load custom CSS if present
  if (theme.customCSS) {
    injectCustomCSS(theme.id, theme.customCSS);
  }
  
  // Load custom fonts
  loadCustomFonts(theme);
}

/**
 * Inject custom CSS into document
 */
function injectCustomCSS(themeId: string, css: string): void {
  // Remove existing custom CSS for this theme
  const existingStyle = document.getElementById(`theme-custom-${themeId}`);
  if (existingStyle) {
    existingStyle.remove();
  }
  
  // Create new style element
  const style = document.createElement('style');
  style.id = `theme-custom-${themeId}`;
  style.textContent = css;
  document.head.appendChild(style);
}

/**
 * Load custom fonts from Google Fonts or custom URLs
 */
function loadCustomFonts(theme: ThemeConfig): void {
  const fonts = [
    theme.typography.fontFamily.heading,
    theme.typography.fontFamily.body,
    theme.typography.fontFamily.mono,
  ];
  
  // Extract font names (remove fallbacks)
  const fontNames = fonts
    .map(font => font.split(',')[0].replace(/['"]/g, '').trim())
    .filter(font => !font.includes('system') && !font.includes('apple') && !font.includes('BlinkMacSystemFont'));
  
  if (fontNames.length === 0) return;
  
  // Check if fonts are already loaded
  const existingLink = document.getElementById('theme-fonts');
  if (existingLink) {
    existingLink.remove();
  }
  
  // Build Google Fonts URL
  const googleFontsUrl = `https://fonts.googleapis.com/css2?${fontNames
    .map(font => `family=${font.replace(/ /g, '+')}:wght@400;500;600;700`)
    .join('&')}&display=swap`;
  
  // Create link element
  const link = document.createElement('link');
  link.id = 'theme-fonts';
  link.rel = 'stylesheet';
  link.href = googleFontsUrl;
  document.head.appendChild(link);
  
  // Preload fonts for better performance
  const preload = document.createElement('link');
  preload.rel = 'preconnect';
  preload.href = 'https://fonts.googleapis.com';
  document.head.appendChild(preload);
  
  const preloadCrossorign = document.createElement('link');
  preloadCrossorign.rel = 'preconnect';
  preloadCrossorign.href = 'https://fonts.gstatic.com';
  preloadCrossorign.crossOrigin = 'anonymous';
  document.head.appendChild(preloadCrossorign);
}

/**
 * Calculate contrast ratio between two colors
 * Used for accessibility validation
 */
export function getContrastRatio(color1: string, color2: string): number {
  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Get relative luminance of a color
 */
function getLuminance(color: string): number {
  // Convert hex to RGB
  const hex = color.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16) / 255;
  const g = parseInt(hex.substr(2, 2), 16) / 255;
  const b = parseInt(hex.substr(4, 2), 16) / 255;
  
  // Apply sRGB formula
  const rsRGB = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
  const gsRGB = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
  const bsRGB = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);
  
  return 0.2126 * rsRGB + 0.7152 * gsRGB + 0.0722 * bsRGB;
}

/**
 * Validate theme accessibility
 */
export function validateThemeAccessibility(theme: ThemeConfig): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check text contrast on background
  const textContrast = getContrastRatio(theme.colors.text, theme.colors.background);
  if (textContrast < 4.5) {
    errors.push(`Text contrast is ${textContrast.toFixed(2)}:1, should be at least 4.5:1 for WCAG AA`);
  } else if (textContrast < 7) {
    warnings.push(`Text contrast is ${textContrast.toFixed(2)}:1, consider 7:1 for WCAG AAA`);
  }
  
  // Check text contrast on surface
  const textSurfaceContrast = getContrastRatio(theme.colors.text, theme.colors.surface);
  if (textSurfaceContrast < 4.5) {
    errors.push(`Text on surface contrast is ${textSurfaceContrast.toFixed(2)}:1, should be at least 4.5:1`);
  }
  
  // Check button contrast
  const primaryContrast = getContrastRatio(theme.colors.text, theme.colors.primary);
  if (primaryContrast < 3) {
    warnings.push(`Primary button contrast is ${primaryContrast.toFixed(2)}:1, should be at least 3:1`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Get list of available themes
 */
export async function getAvailableThemes(): Promise<string[]> {
  // In a real implementation, this would query the backend or read a manifest file
  // For now, return hardcoded list
  return ['default', 'alien-invasion'];
}

/**
 * Sanitize custom CSS (basic implementation)
 * Remove dangerous properties that could be used for attacks
 */
export function sanitizeCustomCSS(css: string): string {
  // Remove dangerous patterns
  const dangerous = [
    /url\s*\(/gi,           // External URLs
    /@import/gi,             // Import statements
    /behavior\s*:/gi,        // IE behavior
    /expression\s*\(/gi,     // IE expressions
    /-moz-binding/gi,        // Mozilla binding
    /javascript:/gi,         // JavaScript protocol
  ];
  
  let sanitized = css;
  dangerous.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '/* removed */');
  });
  
  // Limit size
  const maxLength = 102400; // 100KB
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
    console.warn('Custom CSS truncated to 100KB');
  }
  
  return sanitized;
}
