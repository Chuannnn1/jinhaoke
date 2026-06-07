/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        clay: {
          DEFAULT: 'var(--color-clay)',
          light: 'var(--color-clay-light)',
          soft: 'var(--color-clay-soft)',
          deep: 'var(--color-clay-deep)',
        },
        moss: {
          DEFAULT: 'var(--color-moss)',
          light: 'var(--color-moss-light)',
          soft: 'var(--color-moss-soft)',
        },
        cream: 'var(--color-cream)',
        paper: {
          DEFAULT: 'var(--color-paper)',
          warm: 'var(--color-paper-warm)',
        },
        ink: {
          DEFAULT: 'var(--color-ink)',
          soft: 'var(--color-ink-soft)',
          mute: 'var(--color-ink-mute)',
          faint: 'var(--color-ink-faint)',
        },
        warn: {
          DEFAULT: 'var(--color-warn)',
          soft: 'var(--color-warn-soft)',
        },
        border: {
          DEFAULT: 'var(--color-border)',
          soft: 'var(--color-border-soft)',
          moss: 'var(--color-border-moss)',
        },
        charcoal: {
          300: '#A8A29E',
          700: '#57534E',
          800: '#292524',
          900: '#1C1917',
        },
        gold: {
          50:  '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          400: '#D4A847',
          500: '#B8860B',
          600: '#996F09',
          700: '#7A5807',
        },
      },
      fontFamily: {
        display: ['"Playfair Display"', 'serif'],
        body: ['"DM Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
        tc: ['"PingFang TC"', '"Microsoft JhengHei"', 'sans-serif'],
      },
      borderRadius: {
        sm: '8px',
        md: '10px',
        lg: '12px',
        xl: '16px',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        'card-hover': 'var(--shadow-card-hover)',
      },
    },
  },
  plugins: [],
}