module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './public/index.html',
  ],
  theme: {
    extend: {
      colors: {
        gray: {
          900: '#f9fafb',
          800: '#f3f4f6',
          700: '#e5e7eb',
          600: '#d1d5db',
          500: '#9ca3af',
          400: '#6b7280',
          300: '#4b5563',
          200: '#374151',
          100: '#1f2937',
        }
      },
      fontFamily: {
        mono: ['Fira Code', 'monospace'],
      }
    },
  },
  plugins: [],
}
