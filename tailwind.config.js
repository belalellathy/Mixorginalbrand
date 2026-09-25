/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    screens: {
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
    },
    extend: {
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        body: '#1A1A1A',
        accent: {
          men: '#1A2E4A',
          women: '#C9A0A0',
          skincare: '#8FAF8F',
          makeup: '#7D2335',
        },
      },
      boxShadow: {
        card: '0 2px 8px rgba(0, 0, 0, 0.08)',
        'card-hover': '0 6px 16px rgba(0, 0, 0, 0.12)',
      },
      borderRadius: {
        card: '12px',
        btn: '8px',
      },
      maxWidth: {
        container: '1280px',
      }
    },
  },
  plugins: [],
}
