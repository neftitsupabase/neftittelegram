/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {

        // Custom Colors for Wallet Connection Modal
        "WCM-bg-container": "#181A20",
        "WCM-bg-buttons": "#313035",
        "WCM-bg-buttons-hover": "#4c4d4f",
        // Primary Colors
        primary: {
          DEFAULT: "#36F9F6",
          hover: "#1CE8E5",
          dark: "#0B7A78",
          light: "#7CFFFD"
        },
        // Secondary Colors
        secondary: {
          DEFAULT: "#FF2E63",
          hover: "#FF1A53",
          dark: "#CC1744",
          light: "#FF7799"
        },
        // Background Colors
        background: {
          DEFAULT: "#030407",
          lighter: "#0A0B0F",
          card: "#111111",
          hover: "#1A1A1A"
        },
        // Accent Colors
        accent: {
          blue: "#2E8CFF",
          purple: "#8B5CF6",
          green: "#10B981",
          yellow: "#F59E0B"
        },
        // Text Colors
        text: {
          primary: "#FFFFFF",
          secondary: "rgba(255, 255, 255, 0.7)",
          tertiary: "rgba(255, 255, 255, 0.5)"
        },
        // Border Colors
        border: {
          DEFAULT: "rgba(255, 255, 255, 0.1)",
          hover: "rgba(255, 255, 255, 0.2)",
          active: "rgba(255, 255, 255, 0.3)"
        },
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        foreground: "hsl(var(--foreground))",
        primaryForeground: "hsl(var(--primary-foreground))",
        secondaryForeground: "hsl(var(--secondary-foreground))",
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        "neftit-blue": "#3b82f6",
        "neftit-indigo": "#6366f1",
        "neftit-purple": "#8b5cf6",
        "neftit-pink": "#ec4899",
        "neftit-common": "#9ca3af", 
        "neftit-platinum": "#cbd5e1",
        "neftit-silver": "#a5b4fc",
        "neftit-gold": "#fbbf24",
        "nft-purple": "#9b87f5",
        "nft-blue": "#4462ED",
        "nft-pink": "#FF5FA7",
        "nft-dark": "#0F0F1E",
        "neon": {
          blue: "#00c4f4",
          purple: "#9b5de5",
          green: "#00f5d4",
          pink: "#ff3d81",
          yellow: "#fee440",
          orange: "#ff9e00",
          red: "#ef4444",
        },
      },
      fontFamily: {
        sans: ['Sora', 'sans-serif'],
        'sora': ['Sora', 'sans-serif'],
        'space-grotesk': ['Sora', 'sans-serif'],
        'poppins': ['Sora', 'sans-serif'],
        'dm-sans': ['Sora', 'sans-serif'],
        'manrope': ['Sora', 'sans-serif']
      },
      fontSize: {
        'display-1': ['4.5rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'display-2': ['3.75rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'heading-1': ['3rem', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
        'heading-2': ['2.25rem', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
        'heading-3': ['1.875rem', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
        'heading-4': ['1.5rem', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
        'body-large': ['1.125rem', { lineHeight: '1.5' }],
        'body': ['1rem', { lineHeight: '1.5' }],
        'body-small': ['0.875rem', { lineHeight: '1.5' }],
        'caption': ['0.75rem', { lineHeight: '1.5' }]
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        'glow': '0 0 20px rgba(54, 249, 246, 0.2)',
        'glow-secondary': '0 0 20px rgba(255, 46, 99, 0.2)',
        'card': '0 4px 20px rgba(0, 0, 0, 0.2)',
        'card-hover': '0 8px 30px rgba(0, 0, 0, 0.3)'
      },
      animation: {
        'gradient': 'gradient 8s linear infinite',
        'float': 'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.4s ease-out",
        "scale-in": "scale-in 0.3s ease-out",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "shimmer": "shimmer 2s linear infinite",
        "shine": "shine 2s ease-in-out infinite",
        "slide-in": "slide-in 0.3s ease-out",
        "slide-up": "slide-up 0.6s ease-out",
        "glow": "glow 2s ease-in-out infinite",
        "matrix-rain": "matrix-rain 8s linear infinite",
        "spin-slow": "spin-slow 8s linear infinite",
      },
      keyframes: {
        gradient: {
          '0%, 100%': {
            'background-position': '0% 50%'
          },
          '50%': {
            'background-position': '100% 50%'
          }
        },
        float: {
          '0%, 100%': {
            transform: 'translateY(0)'
          },
          '50%': {
            transform: 'translateY(-20px)'
          }
        },
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(5px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%": { transform: "scale(0.98)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "pulse-glow": {
          "0%, 100%": { 
            opacity: "1",
            filter: "brightness(1) blur(0px)"
          },
          "50%": { 
            opacity: "0.8",
            filter: "brightness(1.2) blur(1px)" 
          }
        },
        "shimmer": {
          "0%": {
            backgroundPosition: "-200% 0"
          },
          "100%": {
            backgroundPosition: "200% 0"
          }
        },
        "shine": {
          "0%": {
            transform: "translateX(-100%)"
          },
          "100%": {
            transform: "translateX(100%)"
          }
        },
        "slide-in": {
          "0%": {
            opacity: "0",
            transform: "translateX(-10px)"
          },
          "100%": {
            opacity: "1",
            transform: "translateX(0)"
          }
        },
        "slide-up": {
          "0%": {
            opacity: "0",
            transform: "translateY(20px)"
          },
          "100%": {
            opacity: "1",
            transform: "translateY(0)"
          }
        },
        "glow": {
          "0%, 100%": { 
            opacity: "1", 
            filter: "brightness(100%)" 
          },
          "50%": { 
            opacity: "0.8", 
            filter: "brightness(150%)" 
          }
        },
        "matrix-rain": {
          "0%": { 
            transform: "translateY(-100%)", 
            opacity: "0" 
          },
          "50%": { 
            opacity: "1" 
          },
          "100%": { 
            transform: "translateY(100%)", 
            opacity: "0" 
          }
        },
        "spin-slow": {
          "from": { 
            transform: "rotate(0deg)" 
          },
          "to": { 
            transform: "rotate(360deg)" 
          }
        },
        "rotate": {
          "0%": {
            transform: "rotate(0deg)"
          },
          "100%": {
            transform: "rotate(360deg)"
          }
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      backdropBlur: {
        xs: '2px'
      }
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    require('tailwind-scrollbar')({ nocompatible: true }),
    function({ addBase }) {
      addBase({
        'html, body, #root, *, *::before, *::after': { 
          fontFamily: 'Sora, sans-serif !important'
        },
      })
    }
  ],
}
