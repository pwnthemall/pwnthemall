import type { Config } from 'tailwindcss'

const config: Config = {
    darkMode: ['class'],
    content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
        // AJOUT DES ANIMATIONS ICI
        keyframes: {
            "collapsible-down": {
                from: { height: "0" },
                to: { height: "var(--radix-collapsible-content-height)" },
            },
            "collapsible-up": {
                from: { height: "var(--radix-collapsible-content-height)" },
                to: { height: "0" },
            },
        },
        animation: {
            "collapsible-down": "collapsible-down 0.3s ",
            "collapsible-up": "collapsible-up 0.3s ease-out",
        },
        // FIN AJOUT
        backgroundImage: {
            'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
            'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))'
        },
        borderRadius: {
            lg: 'var(--radius)',
            md: 'calc(var(--radius) - 2px)',
            sm: 'calc(var(--radius) - 4px)'
        },
        colors: {
            // Existing shadcn colors (keep for compatibility)
            background: 'hsl(var(--background))',
            foreground: 'hsl(var(--foreground))',
            card: {
                DEFAULT: 'hsl(var(--card))',
                foreground: 'hsl(var(--card-foreground))'
            },
            popover: {
                DEFAULT: 'hsl(var(--popover))',
                foreground: 'hsl(var(--popover-foreground))'
            },
            primary: {
                DEFAULT: 'hsl(var(--primary))',
                foreground: 'hsl(var(--primary-foreground))'
            },
            secondary: {
                DEFAULT: 'hsl(var(--secondary))',
                foreground: 'hsl(var(--secondary-foreground))'
            },
            muted: {
                DEFAULT: 'hsl(var(--muted))',
                foreground: 'hsl(var(--muted-foreground))'
            },
            accent: {
                DEFAULT: 'hsl(var(--accent))',
                foreground: 'hsl(var(--accent-foreground))'
            },
            destructive: {
                DEFAULT: 'hsl(var(--destructive))',
                foreground: 'hsl(var(--destructive-foreground))'
            },
            border: 'hsl(var(--border))',
            input: 'hsl(var(--input))',
            ring: 'hsl(var(--ring))',
            chart: {
                '1': 'hsl(var(--chart-1))',
                '2': 'hsl(var(--chart-2))',
                '3': 'hsl(var(--chart-3))',
                '4': 'hsl(var(--chart-4))',
                '5': 'hsl(var(--chart-5))'
            },
            // Theme system colors (CSS variables from theme JSON)
            'theme-primary': 'var(--color-primary)',
            'theme-secondary': 'var(--color-secondary)',
            'theme-accent': 'var(--color-accent)',
            'theme-background': 'var(--color-background)',
            'theme-surface': 'var(--color-surface)',
            'theme-text': 'var(--color-text)',
            'theme-text-muted': 'var(--color-text-muted)',
            'theme-border': 'var(--color-border)',
            'theme-success': 'var(--color-success)',
            'theme-danger': 'var(--color-danger)',
            'theme-warning': 'var(--color-warning)',
            'theme-info': 'var(--color-info)',
        },
        fontFamily: {
            heading: 'var(--font-heading)',
            body: 'var(--font-body)',
            mono: 'var(--font-mono)',
        }
    }
  },
  plugins: [require("tailwindcss-animate")],
}
export default config