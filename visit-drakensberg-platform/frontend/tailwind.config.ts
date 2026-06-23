import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        forest: '#000000',
        gold: '#C9A96E',
        mist: '#F7F5F2',
        sage: '#4A7251',
        primary: {
          50: '#f2f7f3',
          100: '#deeee2',
          200: '#beddc7',
          300: '#91c4a3',
          400: '#5fa37a',
          DEFAULT: '#4A7251',
          500: '#4A7251',
          600: '#3a5c41',
          700: '#2f4a34',
          800: '#253b29',
          900: '#000000',
        },
        brown: {
          300: '#dbc098',
          400: '#d0ad7e',
          DEFAULT: '#C9A96E',
          500: '#C9A96E',
          600: '#b8935a',
          700: '#9a7a48',
        },
        mountain: {
          300: '#7db3e8',
          400: '#5ea1de',
          DEFAULT: '#4A90D9',
          500: '#4A90D9',
          600: '#3478c0',
          700: '#2762a0',
        },
        sand: {
          50: '#fefcf7',
          100: '#fdf8ee',
          DEFAULT: '#F0EDE8',
          200: '#F0EDE8',
          300: '#e2dbd0',
          400: '#d0c5b5',
        },
      },
      fontFamily: {
        display: ['DM Serif Display', 'Georgia', 'serif'],
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 2px 16px rgba(0,0,0,0.08)',
        'card-hover': '0 8px 30px rgba(0,0,0,0.14)',
        gold: '0 4px 24px rgba(201,169,110,0.3)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
      keyframes: {
        'fade-up': {
          '0%':   { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%':   { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'slide-up': {
          '0%':   { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'bounce-slow': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(8px)' },
        },
        'fade-out': {
          '0%':   { opacity: '1' },
          '100%': { opacity: '0' },
        },
        'skeleton': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.4' },
        },
      },
      animation: {
        'fade-up':    'fade-up 0.25s cubic-bezier(0,0,0.2,1) forwards',
        'fade-in':    'fade-in 0.25s cubic-bezier(0,0,0.2,1) forwards',
        'scale-in':   'scale-in 0.25s cubic-bezier(0,0,0.2,1) forwards',
        'slide-up':   'slide-up 0.25s cubic-bezier(0,0,0.2,1) forwards',
        'bounce-slow':'bounce-slow 1.8s ease-in-out infinite',
        'fade-out':   'fade-out 0.16s cubic-bezier(0.4,0,1,1) forwards',
        'skeleton':   'skeleton 1.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}

export default config
