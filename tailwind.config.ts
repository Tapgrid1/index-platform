import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#0a0a0a', 2: '#3d3d3d', 3: '#767676', 4: '#a3a3a3' },
        line: { DEFAULT: '#e6e6e6', 2: '#f0f0f0' },
        wash: '#fafafa',
        accent: '#1f3ff5',
        admin: { bg: '#0d0f12', panel: '#15181d', line: '#252a31', dim: '#8b949e' },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
