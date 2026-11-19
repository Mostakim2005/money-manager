/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/App.vue",
    "./src/components/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        realbyte: {
          red: '#EF4444',
          green: '#10B981',
          blue: '#3B82F6',
          yellow: '#F59E0B',
          dark: '#0F172A',
          card: '#1E293B',
        },
      },
    },
  },
  plugins: [],
};
