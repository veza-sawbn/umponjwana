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
        primary: {
          50: '#f0faf5',
          100: '#dcf2e7',
          200: '#bbdfd0',
          300: '#86c3ae',
          400: '#4fa285',
          DEFAULT: '#2D6A4F',
          500: '#2D6A4F',
          600: '#245c43',
          700: '#1c4d38',
          800: '#163d2c',
          900: '#102e21',
        },
        brown: {
          300: '#c49a76',
          400: '#a67a56',
          DEFAULT: '#8B5E3C',
          500: '#8B5E3C',
          600: '#7a5234',
          700: '#643f27',
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
          DEFAULT: '#F5E6C8',
          200: '#F5E6C8',
          300: '#ecd0a0',
          400: '#e0b870',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 2px 16px rgba(0,0,0,0.08)',
        'card-hover': '0 8px 30px rgba(0,0,0,0.14)',
      },
    },
  },
  plugins: [],
}

export default config
