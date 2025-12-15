/**
 * Theme System Type Definitions
 * 
 * This defines the complete theme schema for the CTF platform.
 * Themes control colors, typography, spacing, layout, and custom effects.
 */

export interface ThemeConfig {
  /** Unique theme identifier (kebab-case) */
  id: string;
  
  /** Display name for admin UI */
  name: string;
  
  /** Semantic version (e.g., "1.0.0") */
  version: string;
  
  /** Theme author/creator */
  author?: string;
  
  /** Brief description of the theme */
  description?: string;
  
  /** Color palette - uses CSS color values */
  colors: ThemeColors;
  
  /** Typography settings */
  typography: ThemeTypography;
  
  /** Spacing and layout density */
  spacing: ThemeSpacing;
  
  /** Component style variants */
  layout: ThemeLayout;
  
  /** Visual effects and animations */
  effects: ThemeEffects;
  
  /** Custom CSS for advanced theming */
  customCSS?: string;
  
  /** Asset URLs (backgrounds, patterns, etc.) */
  assets?: ThemeAssets;
}

export interface ThemeColors {
  // Primary brand colors
  primary: string;
  primaryHover?: string;
  primaryActive?: string;
  
  // Secondary colors
  secondary: string;
  secondaryHover?: string;
  
  // Accent/highlight color
  accent: string;
  
  // Background colors
  background: string;
  backgroundAlt?: string;
  
  // Surface colors (cards, modals, etc.)
  surface: string;
  surfaceHover?: string;
  surfaceActive?: string;
  
  // Text colors
  text: string;
  textMuted: string;
  textInverted?: string;
  
  // Border colors
  border: string;
  borderHover?: string;
  
  // Semantic colors
  success: string;
  successHover?: string;
  danger: string;
  dangerHover?: string;
  warning: string;
  warningHover?: string;
  info: string;
  infoHover?: string;
  
  // Status colors
  locked?: string;
  solved?: string;
  
  // Shadow colors
  shadow?: string;
  shadowGlow?: string;
}

export interface ThemeTypography {
  /** Font families */
  fontFamily: {
    heading: string;
    body: string;
    mono: string;
  };
  
  /** Scale multiplier: 0.8 (compact) to 1.2 (spacious) */
  scale: 'compact' | 'normal' | 'spacious';
  
  /** Font weights */
  fontWeights?: {
    normal: number;
    medium: number;
    semibold: number;
    bold: number;
  };
  
  /** Line heights */
  lineHeights?: {
    tight: number;
    normal: number;
    relaxed: number;
  };
}

export interface ThemeSpacing {
  /** Overall spacing scale multiplier (0.8 - 1.2) */
  scale: number;
  
  /** Container padding */
  containerPadding?: string;
  
  /** Section gaps */
  sectionGap?: string;
}

export interface ThemeLayout {
  /** Card style variant */
  cardStyle: 'flat' | 'elevated' | 'outlined' | 'glass';
  
  /** Border radius style */
  cardCorners: 'sharp' | 'rounded' | 'pill';
  
  /** Header style */
  headerStyle: 'minimal' | 'normal' | 'bold';
  
  /** Table style */
  tableStyle: 'default' | 'bordered' | 'striped' | 'minimal';
  
  /** Badge shape */
  badgeShape?: 'default' | 'rounded' | 'pill' | 'square';
  
  /** Button style */
  buttonStyle?: 'default' | 'rounded' | 'pill' | 'square';
}

export interface ThemeEffects {
  /** Enable animations */
  animations: boolean;
  
  /** Enable glow effects (for neon themes) */
  glowEffects: boolean;
  
  /** Enable hover scale effects */
  hoverScale: boolean;
  
  /** Transition duration (ms) */
  transitionDuration?: number;
  
  /** Enable backdrop blur */
  backdropBlur: boolean;
}

export interface ThemeAssets {
  /** Background image/pattern URL */
  backgroundImage?: string;
  
  /** Background pattern (for subtle textures) */
  backgroundPattern?: string;
  
  /** Logo override */
  logo?: string;
  
  /** Favicon override */
  favicon?: string;
  
  /** Custom fonts URLs (if not using Google Fonts) */
  customFonts?: string[];
}

/**
 * Theme metadata for discovery and management
 */
export interface ThemeMetadata {
  id: string;
  name: string;
  author?: string;
  description?: string;
  version: string;
  preview?: string; // Screenshot URL
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}
