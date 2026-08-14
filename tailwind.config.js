/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"Outfit"', '"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        serif: ['"Plus Jakarta Sans"', 'Georgia', 'serif'],
      },
      colors: {
        eleven: {
          canvas: '#f5f5f5',
          'canvas-soft': '#fafafa',
          ink: '#0c0a09',
          primary: '#292524',
          body: '#4e4e4e',
          muted: '#777169',
          hairline: '#e7e5e4',
          card: '#ffffff',
          mint: '#a7e5d3',
          peach: '#f4c5a8',
          lavender: '#c8b8e0',
          sky: '#a8c8e8',
          rose: '#e8b8c4'
        }
      }
    },
  },
  plugins: [],
}
