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