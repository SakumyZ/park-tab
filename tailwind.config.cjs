/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./*.html', './src/**/*.{svelte,ts}'],
  theme: {
    extend: {
      colors: {
        ink: '#17202a',
        muted: '#64748b',
        panel: '#f8fafc',
        line: '#d8dee8',
        brand: '#2563eb'
      }
    }
  },
  plugins: []
};
