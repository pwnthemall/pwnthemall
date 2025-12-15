import React, { useState, useEffect } from 'react';
import type { ThemeConfig } from '@/themes/types';
import { loadTheme, applyTheme, validateThemeAccessibility } from '@/themes/utils';

interface UseThemeReturn {
  theme: ThemeConfig | null;
  loading: boolean;
  error: Error | null;
  setThemeId: (themeId: string) => void;
  validation: {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } | null;
}

/**
 * Hook for loading and applying themes
 * 
 * @param initialThemeId - Theme ID to load on mount (default: 'default')
 * @returns Theme state and controls
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { theme, loading } = useTheme('alien-invasion');
 *   
 *   if (loading) return <div>Loading theme...</div>;
 *   
 *   return <div>Theme: {theme?.name}</div>;
 * }
 * ```
 */
export function useTheme(initialThemeId: string = 'default'): UseThemeReturn {
  const [theme, setTheme] = useState<ThemeConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [themeId, setThemeId] = useState(initialThemeId);
  const [validation, setValidation] = useState<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  } | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadAndApplyTheme = async () => {
      try {
        setLoading(true);
        setError(null);

        // Load theme configuration
        const loadedTheme = await loadTheme(themeId);
        
        if (!mounted) return;

        // Validate accessibility
        const validationResult = validateThemeAccessibility(loadedTheme);
        setValidation(validationResult);

        // Log warnings but don't block
        if (validationResult.warnings.length > 0) {
          console.warn('Theme accessibility warnings:', validationResult.warnings);
        }

        // Block if there are critical errors
        if (!validationResult.valid) {
          console.error('Theme accessibility errors:', validationResult.errors);
          // Still apply theme, but log errors
        }

        // Apply theme to document
        applyTheme(loadedTheme);
        
        setTheme(loadedTheme);
      } catch (err) {
        if (!mounted) return;
        
        const error = err instanceof Error ? err : new Error('Failed to load theme');
        setError(error);
        console.error('Theme loading error:', error);
        
        // Fallback to default theme on error
        if (themeId !== 'default') {
          setThemeId('default');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadAndApplyTheme();

    return () => {
      mounted = false;
    };
  }, [themeId]);

  return {
    theme,
    loading,
    error,
    setThemeId,
    validation,
  };
}

/**
 * Hook for getting current theme ID
 * Priority: 
 * 1. URL param ?theme=default (escape hatch)
 * 2. URL param ?theme=X (testing/preview)
 * 3. Site-wide config (SITE_THEME from backend)
 * 4. Default theme
 * 
 * Note: We don't use SiteConfig context here to avoid circular dependencies.
 * Instead, the theme comes from SITE_THEME public config, which CategoryContent
 * or app components should fetch and pass down.
 * 
 * @returns Current theme ID
 */
export function useThemeId(siteTheme?: string): string {
  const [themeId, setThemeId] = useState<string>(() => {
    if (typeof window === 'undefined') return 'default';
    
    // ESCAPE HATCH: Always honor ?theme= URL parameter
    // ?theme=default reverts to default if custom theme breaks UI
    // ?theme=X allows testing themes without saving
    const urlParams = new URLSearchParams(window.location.search);
    const urlTheme = urlParams.get('theme');
    if (urlTheme) {
      return urlTheme;
    }
    
    // Use site-wide theme if provided
    if (siteTheme) {
      return siteTheme;
    }
    
    // Fallback to default
    return 'default';
  });

  // Update theme when siteTheme prop changes
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const urlTheme = urlParams.get('theme');
    
    if (urlTheme) {
      setThemeId(urlTheme);
    } else if (siteTheme) {
      setThemeId(siteTheme);
    } else {
      setThemeId('default');
    }
  }, [siteTheme]);

  return themeId;
}

/**
 * Hook for theme persistence
 * Saves theme preference to localStorage
 */
export function usePersistTheme(themeId: string): void {
  useEffect(() => {
    if (themeId) {
      localStorage.setItem('theme', themeId);
    }
  }, [themeId]);
}
