import type { Config } from 'tailwindcss';

const config: Config = {
  // Class strategy: the toggle lives in the Sidebar, persisted to
  // localStorage; globals.css carries the dark palette as overrides on the
  // common light utilities (this app predates semantic color tokens).
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // OneOral brand (matches www.oneoral.com home-v3): deep green + mint on cream
        primary: {
          50: '#eef8f3',
          100: '#e8f8f2',
          200: '#d4f5e9',
          300: '#a8e6cf',
          400: '#7ecfb0',
          500: '#2d6a47',
          600: '#1a3d2b',
          700: '#14301f',
          800: '#0f2418',
          900: '#0a1911',
          950: '#051009',
        },
        brand: {
          50: '#eef8f3',
          100: '#e8f8f2',
          200: '#d4f5e9',
          300: '#a8e6cf',
          400: '#7ecfb0',
          500: '#2d6a47',
          600: '#1a3d2b',
          700: '#14301f',
          800: '#0f2418',
          900: '#0a1911',
        },
        mint: {
          50: '#e8f8f2',
          100: '#d4f5e9',
          200: '#b9edd9',
          300: '#a8e6cf',
          400: '#8ed8bc',
          500: '#7ecfb0',
          600: '#4daf8c',
          700: '#2d6a47',
          800: '#1a3d2b',
          900: '#12291d',
        },
        cream: {
          DEFAULT: '#f9f6f0',
          50: '#fdfbf7',
          100: '#f9f6f0',
          200: '#f0ede8',
          300: '#e5e2dc',
        },
        // Warm stone neutrals (site uses stone, not cool slate)
        slate: {
          50: '#fafaf9',
          100: '#f5f5f4',
          200: '#e7e5e4',
          300: '#d6d3d1',
          400: '#a8a29e',
          500: '#78716c',
          600: '#57534e',
          700: '#44403c',
          800: '#292524',
          900: '#1c1917',
          950: '#0c0a09',
        },
        gray: {
          50: '#fafaf9',
          100: '#f5f5f4',
          200: '#e7e5e4',
          300: '#d6d3d1',
          400: '#a8a29e',
          500: '#78716c',
          600: '#57534e',
          700: '#44403c',
          800: '#292524',
          900: '#1c1917',
          950: '#0c0a09',
        },
        success: { 50: '#f0fdf4', 500: '#22c55e', 600: '#16a34a' },
        warning: { 50: '#fffbeb', 500: '#f59e0b', 600: '#d97706' },
        danger: { 50: '#fef2f2', 500: '#ef4444', 600: '#dc2626' },
      },
      boxShadow: {
        soft: '0 2px 15px -3px rgba(0,0,0,.07), 0 10px 20px -2px rgba(0,0,0,.04)',
      },
    },
  },
  plugins: [],
};

export default config;
