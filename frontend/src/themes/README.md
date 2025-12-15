# PwnThemAll Theme System

Complete theming system for the CTF challenge platform. Create custom themes with colors, typography, layouts, and effects.

## Quick Start

### Creating a New Theme

1. **Copy the default theme**:
```bash
cp frontend/themes/default.json frontend/themes/my-theme.json
```

2. **Edit the configuration**:
```json
{
  "id": "my-theme",
  "name": "My Awesome Theme",
  "version": "1.0.0",
  "author": "Your Name",
  "description": "A custom theme for my CTF",
  "colors": {
    "primary": "#FF6B6B",
    "secondary": "#4ECDC4",
    ...
  },
  ...
}
```

3. **Apply the theme**:
- Add `?theme=my-theme` to the URL, or
- Set default in config, or
- Let users choose in settings

## Theme Structure

### Colors

Define all colors using hex values:

```json
"colors": {
  "primary": "#3b82f6",          // Main brand color
  "secondary": "#8b5cf6",        // Secondary accent
  "accent": "#06b6d4",           // Highlight color
  "background": "#0a0a0a",       // Page background
  "surface": "#1a1a1a",          // Card backgrounds
  "text": "#ffffff",             // Main text color
  "textMuted": "#a0a0a0",        // Secondary text
  "border": "#333333",           // Border color
  "success": "#22c55e",          // Success states
  "danger": "#ef4444",           // Error states
  "warning": "#f59e0b",          // Warning states
  "info": "#3b82f6"              // Info states
}
```

**Accessibility**: Ensure text/background contrast is at least 4.5:1 (WCAG AA).

### Typography

Choose fonts and sizing:

```json
"typography": {
  "fontFamily": {
    "heading": "'Orbitron', sans-serif",
    "body": "'Rajdhani', sans-serif",
    "mono": "'Fira Code', monospace"
  },
  "scale": "normal"  // "compact" | "normal" | "spacious"
}
```

**Google Fonts**: System will automatically load fonts from Google Fonts.

### Spacing

Control density and padding:

```json
"spacing": {
  "scale": 1.0,  // 0.8 = compact, 1.0 = normal, 1.2 = spacious
  "containerPadding": "1rem",
  "sectionGap": "2rem"
}
```

### Layout Variants

Choose component styles:

```json
"layout": {
  "cardStyle": "elevated",    // "flat" | "elevated" | "outlined" | "glass"
  "cardCorners": "rounded",   // "sharp" | "rounded" | "pill"
  "headerStyle": "bold",      // "minimal" | "normal" | "bold"
  "tableStyle": "bordered",   // "default" | "bordered" | "striped" | "minimal"
  "badgeShape": "pill",       // "default" | "rounded" | "pill" | "square"
  "buttonStyle": "rounded"    // "default" | "rounded" | "pill" | "square"
}
```

### Effects

Enable visual enhancements:

```json
"effects": {
  "animations": true,          // Enable transitions/animations
  "glowEffects": true,         // Enable neon glow effects
  "hoverScale": true,          // Cards scale on hover
  "transitionDuration": 300,   // Transition time in ms
  "backdropBlur": true         // Enable backdrop blur
}
```

### Custom CSS

Add your own CSS for advanced customization:

```json
"customCSS": "
  .challenge-card:hover {
    box-shadow: 0 0 20px var(--color-primary);
  }
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }
"
```

**Security**: Dangerous properties (`url()`, `@import`, etc.) are automatically removed.

### Assets

Include custom backgrounds and images:

```json
"assets": {
  "backgroundImage": "/themes/my-theme/bg.jpg",
  "backgroundPattern": "/themes/my-theme/pattern.svg",
  "logo": "/themes/my-theme/logo.png",
  "favicon": "/themes/my-theme/favicon.ico"
}
```

## CSS Variables

Your theme colors are available as CSS variables:

```css
/* Auto-generated from your theme */
:root[data-theme="my-theme"] {
  --color-primary: #FF6B6B;
  --color-background: #0a0a0a;
  --color-text: #ffffff;
  /* ... all colors */
  
  --font-heading: 'Orbitron', sans-serif;
  --font-body: 'Rajdhani', sans-serif;
  --spacing-scale: 1.0;
  --transition-duration: 300ms;
}
```

## Theme Examples

### 🛸 Alien Invasion Theme

See `alien-invasion.json` for a complete sci-fi theme with:
- Neon green (#39FF14) and purple (#8B00FF) colors
- Glowing effects and animations
- Animated starfield background
- Futuristic fonts (Orbitron, Rajdhani)

### 🕷️ Cyberpunk Theme (Example)

```json
{
  "id": "cyberpunk",
  "name": "Cyberpunk 2077",
  "colors": {
    "primary": "#FFD700",
    "secondary": "#FF00FF",
    "accent": "#00FFFF",
    "background": "#0D0208",
    "surface": "#1A1423",
    "text": "#FFFFFF"
  },
  "typography": {
    "fontFamily": {
      "heading": "'Audiowide', sans-serif",
      "body": "'Saira', sans-serif",
      "mono": "'Share Tech Mono', monospace"
    },
    "scale": "normal"
  },
  "effects": {
    "animations": true,
    "glowEffects": true,
    "hoverScale": true,
    "backdropBlur": true
  }
}
```

### 🌲 Forest Theme (Example)

```json
{
  "id": "forest",
  "name": "Forest CTF",
  "colors": {
    "primary": "#2D5016",
    "secondary": "#8B4513",
    "accent": "#9ACD32",
    "background": "#1C2415",
    "surface": "#2A3A1F",
    "text": "#E8F5E9"
  },
  "typography": {
    "fontFamily": {
      "heading": "'Cabin', sans-serif",
      "body": "'Lato', sans-serif",
      "mono": "'Inconsolata', monospace"
    },
    "scale": "normal"
  },
  "assets": {
    "backgroundPattern": "/themes/forest/trees.svg"
  }
}
```

## Testing Your Theme

### 1. Accessibility Check

Use the validation tool:

```bash
npm run validate-theme my-theme
```

Checks:
- ✅ Color contrast ratios (WCAG AA)
- ✅ Text readability
- ✅ Button contrast
- ⚠️ Warnings for WCAG AAA

### 2. Visual Test

Preview your theme:

```
http://localhost:3000/pwn?theme=my-theme
```

Test on:
- Desktop (1920x1080)
- Tablet (768x1024)
- Mobile (375x667)

### 3. Performance Test

Check loading time:
```bash
npm run lighthouse -- --theme=my-theme
```

Target metrics:
- First Contentful Paint < 1.5s
- Largest Contentful Paint < 2.5s
- Total theme size < 200KB

## Deployment

### Option 1: Place in themes folder (Recommended)

```bash
# Copy your theme
cp my-theme.json frontend/themes/

# Copy assets (if any)
cp -r my-theme-assets/ frontend/public/themes/my-theme/

# Rebuild
npm run build
```

The theme will be automatically discovered and loaded.

### Option 2: Load from URL

```json
{
  "theme": {
    "source": "https://cdn.example.com/themes/my-theme.json"
  }
}
```

### Option 3: Admin Upload

Use the admin panel:
1. Navigate to `/admin/themes`
2. Click "Upload Theme"
3. Select your `my-theme.json`
4. Preview and activate

## Troubleshooting

### Theme not loading

1. Check filename matches `id` field: `my-theme.json` → `"id": "my-theme"`
2. Validate JSON syntax: `npm run validate-theme my-theme`
3. Check console for errors: Open DevTools → Console

### Colors look wrong

1. Verify hex format: `#RRGGBB` (6 digits)
2. Check contrast ratios
3. Clear browser cache: Ctrl+Shift+R

### Fonts not showing

1. Verify font names are exact (case-sensitive)
2. Check Google Fonts availability
3. Add font fallbacks: `'MyFont', sans-serif`

### Custom CSS not working

1. Check for syntax errors
2. Verify selectors target correct elements
3. Use `!important` if needed (sparingly)
4. Check browser DevTools → Styles

## Best Practices

### Colors
- ✅ Use semantic color names consistently
- ✅ Provide hover states for interactive elements
- ✅ Test in both dark and light environments
- ❌ Don't use pure white (#FFFFFF) text on pure black (#000000) - too harsh

### Typography
- ✅ Limit to 2-3 font families max
- ✅ Use system fonts for best performance
- ✅ Set appropriate line heights (1.5 for body text)
- ❌ Don't use decorative fonts for body text

### Spacing
- ✅ Maintain consistent spacing scale
- ✅ Use relative units (rem, em) over pixels
- ✅ Test responsive layouts
- ❌ Don't use negative margins excessively

### Effects
- ✅ Keep animations subtle (<300ms)
- ✅ Respect `prefers-reduced-motion`
- ✅ Test performance on lower-end devices
- ❌ Don't overuse glows/shadows

### Custom CSS
- ✅ Use CSS variables for maintainability
- ✅ Comment your code
- ✅ Keep CSS DRY (Don't Repeat Yourself)
- ❌ Don't use `!important` everywhere

## API Reference

### Theme Config Type

```typescript
interface ThemeConfig {
  id: string;
  name: string;
  version: string;
  author?: string;
  description?: string;
  colors: ThemeColors;
  typography: ThemeTypography;
  spacing: ThemeSpacing;
  layout: ThemeLayout;
  effects: ThemeEffects;
  customCSS?: string;
  assets?: ThemeAssets;
}
```

Full type definitions: See `frontend/themes/types.ts`

### React Hook

```typescript
import { useTheme } from '@/hooks/useTheme';

function MyComponent() {
  const { theme, loading, error, setThemeId } = useTheme('my-theme');
  
  // Switch theme
  const switchTheme = () => setThemeId('alien-invasion');
  
  return <div>Current theme: {theme?.name}</div>;
}
```

## Support

- **Documentation**: `/docs/theming`
- **Examples**: `/themes/examples/`
- **Issues**: GitHub Issues
- **Discord**: #theme-development

## License

Themes are MIT licensed. Feel free to share and remix!
