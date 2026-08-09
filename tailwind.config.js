/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#0A0A0F',
          surface: '#121218',
          card: '#181824',
          border: 'rgba(255, 255, 255, 0.08)',
          hover: '#222234',
        },
        violet: {
          deep: '#7C3AED',
          accent: '#A855F7',
          light: '#C084FC',
          glow: 'rgba(124, 58, 237, 0.25)',
        },
        coolblue: {
          400: '#38BDF8',
          500: '#0EA5E9',
          glow: 'rgba(56, 189, 248, 0.2)',
        }
      },
      backgroundImage: {
        'purple-gradient': 'linear-gradient(135deg, #7C3AED 0%, #A855F7 50%, #C084FC 100%)',
        'glass-card': 'linear-gradient(180deg, rgba(24, 24, 36, 0.8) 0%, rgba(18, 18, 24, 0.9) 100%)',
        'dark-radial': 'radial-gradient(circle at 50% 0%, rgba(124, 58, 237, 0.15) 0%, rgba(10, 10, 15, 0) 70%)',
      },
      animation: {
        'pulse-glow': 'pulseGlow 3s ease-in-out infinite',
        'fade-in': 'fadeIn 0.3s ease-out forwards',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.8' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      }
    },
  },
  plugins: [],
}
