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
        forest: '#1C2B1E',
        gold: '#C9A96E',
        mist: '#F0EDE8',
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
          900: '#1C2B1E',
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
        display: ['Cormorant Garamond', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
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
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'bounce-slow': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(8px)' },
        },
        'fade-out': {
          '0%': { opacity: '1' },
          '100%': { opacity: '0', pointerEvents: 'none' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.6s ease-out forwards',
        'bounce-slow': 'bounce-slow 1.8s ease-in-out infinite',
        'fade-out': 'fade-out 0.5s ease-in 3s forwards',
      },
    },
  },
  plugins: [],
}

export default config
