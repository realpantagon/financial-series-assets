/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        // shadcn's generated components use bare data-* variants (data-open, data-active…)
        data: {
            open: 'state~="open"', closed: 'state~="closed"', active: 'state~="active"',
            vertical: 'orientation~="vertical"', horizontal: 'orientation~="horizontal"',
            disabled: 'disabled', placeholder: 'placeholder',
        },
        extend: {
            colors: {
                // shadcn CSS variable mappings
                background: 'oklch(var(--background) / <alpha-value>)',
                foreground: 'oklch(var(--foreground) / <alpha-value>)',
                card: {
                    DEFAULT: 'oklch(var(--card) / <alpha-value>)',
                    foreground: 'oklch(var(--card-foreground) / <alpha-value>)',
                },
                popover: {
                    DEFAULT: 'oklch(var(--popover) / <alpha-value>)',
                    foreground: 'oklch(var(--popover-foreground) / <alpha-value>)',
                },
                primary: {
                    DEFAULT: 'oklch(var(--primary) / <alpha-value>)',
                    foreground: 'oklch(var(--primary-foreground) / <alpha-value>)',
                },
                secondary: {
                    DEFAULT: 'oklch(var(--secondary) / <alpha-value>)',
                    foreground: 'oklch(var(--secondary-foreground) / <alpha-value>)',
                },
                muted: {
                    DEFAULT: 'oklch(var(--muted) / <alpha-value>)',
                    foreground: 'oklch(var(--muted-foreground) / <alpha-value>)',
                },
                accent: {
                    DEFAULT: 'oklch(var(--accent) / <alpha-value>)',
                    foreground: 'oklch(var(--accent-foreground) / <alpha-value>)',
                },
                destructive: {
                    DEFAULT: 'oklch(var(--destructive) / <alpha-value>)',
                },
                border: 'oklch(var(--border) / <alpha-value>)',
                input: 'oklch(var(--input) / <alpha-value>)',
                ring: 'oklch(var(--ring) / <alpha-value>)',
                // Custom financial colors (raw values for direct use)
                success: '#43a047',
                danger: '#d81b60',
                // Legacy "cyan" accent remapped to the blue brand token
                cyan: {
                    200: 'oklch(var(--brand) / <alpha-value>)',
                    300: 'oklch(var(--brand) / <alpha-value>)',
                    400: 'oklch(var(--brand) / <alpha-value>)',
                    500: 'oklch(var(--brand) / <alpha-value>)',
                    600: 'oklch(var(--brand) / <alpha-value>)',
                },
            },
            borderRadius: {
                '4xl': '2rem',
                lg: 'var(--radius)',
                md: 'calc(var(--radius) - 2px)',
                sm: 'calc(var(--radius) - 4px)',
            },
            fontFamily: {
                sans: ['IBM Plex Sans Thai', 'ui-sans-serif', 'system-ui', 'sans-serif'],
                mono: ['IBM Plex Sans Thai', 'ui-sans-serif', 'system-ui', 'sans-serif'],
            },
        },
    },
    plugins: [],
}
