/** @type {import('tailwindcss').Config} */
// SDK tailwind config for the demo — same settings as ../tailwind.config.js
// but content paths are relative to THIS file's location (demo/)
export default {
  content: ['../src/**/*.{ts,tsx}'],   // SDK source files
  theme: {
    extend: {
      colors: {
        surf: {
          primary: 'var(--surf-primary, #3B82F6)',
          'primary-text': 'var(--surf-primary-text, #FFFFFF)',
          background: 'var(--surf-background, #EFF6FF)',
          card: 'var(--surf-card-background, #FFFFFF)',
          text: 'var(--surf-text, #111827)',
          'text-secondary': 'var(--surf-text-secondary, #6B7280)',
          apy: 'var(--surf-apy, #3B82F6)',
          border: 'var(--surf-border, #E5E7EB)',
          success: 'var(--surf-success, #10B981)',
        },
      },
      borderRadius: {
        surf: 'var(--surf-border-radius, 12px)',
      },
      fontFamily: {
        surf: 'var(--surf-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
      },
    },
  },
  plugins: [],
  prefix: 'sw-',
  corePlugins: {
    preflight: false,
  },
};
