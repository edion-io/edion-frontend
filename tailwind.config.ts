import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px'
      }
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))'
        }
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' }
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' }
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' }
        },
        'slide-up-fade': {
          '0%': { opacity: '0', transform: 'translateY(100%) scale(0.96)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' }
        },
        'slide-down-fade': {
          '0%': { opacity: '1', transform: 'translateY(0) scale(1)' },
          '100%': { opacity: '0', transform: 'translateY(100%) scale(0.96)' }
        },
        'slide-across': {
          '0%': { 
            transform: 'translateX(-200px) scale(0.9)', 
            opacity: '0', 
            filter: 'blur(3px)',
            boxShadow: '0 0 0 rgba(0, 0, 0, 0)'
          },
          '20%': { 
            opacity: '0.8', 
            filter: 'blur(1px)',
            boxShadow: '-4px 0 15px rgba(0, 0, 0, 0.1)'
          },
          '60%': { 
            transform: 'translateX(0) scale(1)', 
            opacity: '1', 
            filter: 'blur(0px)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.12)'
          },
          '100%': { 
            transform: 'translateX(0) scale(1)', 
            opacity: '1', 
            filter: 'blur(0px)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.12)'
          }
        },
        'slide-out-right': {
          '0%': { 
            transform: 'translateX(0) scale(1)', 
            opacity: '1', 
            filter: 'blur(0px)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.12)'
          },
          '20%': { 
            opacity: '0.8', 
            filter: 'blur(1px)'
          },
          '80%': { 
            opacity: '0.3', 
            filter: 'blur(2px)',
            boxShadow: '4px 0 15px rgba(0, 0, 0, 0.1)'
          },
          '100%': { 
            transform: 'translateX(200px) scale(0.9)', 
            opacity: '0', 
            filter: 'blur(3px)',
            boxShadow: '0 0 0 rgba(0, 0, 0, 0)'
          }
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 0.3s ease-out',
        'fade-up': 'fade-up 0.4s ease-out',
        'scale-in': 'scale-in 0.3s ease-out',
        'slide-up-fade': 'slide-up-fade 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-down-fade': 'slide-down-fade 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-across': 'slide-across 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'slide-out-right': 'slide-out-right 0.5s cubic-bezier(0.36, 0, 0.66, -0.56) forwards'
      }
    }
  },
  plugins: [
    require("tailwindcss-animate"),
    function({ addUtilities }) {
      const newUtilities = {
        '.scrollbar-hide': {
          /* Firefox */
          'scrollbar-width': 'none !important',
          /* Safari and Chrome */
          '&::-webkit-scrollbar': {
            display: 'none !important'
          }
        },
        '.scrollbar-thin': {
          /* Firefox */
          'scrollbar-width': 'thin !important',
          'scrollbar-color': 'rgba(0, 0, 0, 0.5) transparent !important',
          
          /* Chrome, Edge, Safari */
          '&::-webkit-scrollbar': {
            width: '6px !important',
            height: '6px !important',
            backgroundColor: 'transparent !important',
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: 'transparent !important',
            borderRadius: '10px !important',
            margin: '2px !important',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(0, 0, 0, 0.5) !important',
            backdropFilter: 'blur(10px) !important',
            '-webkit-backdrop-filter': 'blur(10px) !important',
            borderRadius: '10px !important',
            border: 'none !important',
            'background-clip': 'content-box !important',
            'min-height': '40px !important',
          },
          '&::-webkit-scrollbar-thumb:hover, &::-webkit-scrollbar-thumb:active, &::-webkit-scrollbar-thumb:window-inactive': {
            backgroundColor: 'rgba(0, 0, 0, 0.6) !important',
            width: '6px !important',
          },
          
          /* Dark mode */
          '&.dark, .dark &': {
            'scrollbar-color': 'rgba(0, 0, 0, 0.7) transparent !important',
          },
          '&.dark::-webkit-scrollbar-thumb, .dark &::-webkit-scrollbar-thumb, &.dark::-webkit-scrollbar-thumb:hover, .dark &::-webkit-scrollbar-thumb:hover, &.dark::-webkit-scrollbar-thumb:active, .dark &::-webkit-scrollbar-thumb:active, &.dark::-webkit-scrollbar-thumb:window-inactive, .dark &::-webkit-scrollbar-thumb:window-inactive': {
            backgroundColor: 'rgba(0, 0, 0, 0.7) !important',
          },
        },
      };
      
      addUtilities(newUtilities, ['responsive', 'dark']);
    },
  ],
} satisfies Config;
