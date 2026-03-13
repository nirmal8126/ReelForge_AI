import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: 'hsl(var(--brand-50, 239 100% 95%) / <alpha-value>)',
          100: 'hsl(var(--brand-100, 239 100% 90%) / <alpha-value>)',
          200: 'hsl(var(--brand-200, 239 96% 80%) / <alpha-value>)',
          300: 'hsl(var(--brand-300, 239 90% 70%) / <alpha-value>)',
          400: 'hsl(var(--brand-400, 239 84% 72%) / <alpha-value>)',
          500: 'hsl(var(--brand-500, 239 84% 67%) / <alpha-value>)',
          600: 'hsl(var(--brand-600, 239 84% 59%) / <alpha-value>)',
          700: 'hsl(var(--brand-700, 239 76% 52%) / <alpha-value>)',
          800: 'hsl(var(--brand-800, 239 80% 42%) / <alpha-value>)',
          900: 'hsl(var(--brand-900, 239 84% 35%) / <alpha-value>)',
          950: 'hsl(var(--brand-950, 239 90% 20%) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
