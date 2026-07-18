module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'sans-serif'] },
      transitionProperty: {
        width: 'width',
      },
      colors: {
        property: {
          accent: 'var(--property-accent)',
        },
        teal: {
          50: '#e0f0f0',
          100: '#b3d9d9',
          200: '#80c0c0',
          300: '#4da6a6',
          400: '#269696',
          500: '#008080',
          600: '#006666',
          700: '#004d4d',
          800: '#003333',
          900: '#001a1a',
        },
        yellow: {
          accent: '#F5C518',
        },
        dark: {
          primary:   '#020d0d',
          secondary: '#0d2020',
          tertiary:  '#0f2828',
          hover:     '#0f2a2a',
          active:    '#143333',
          border:    'rgba(0,128,128,0.22)',
          card:      '#0d2020',
          input:     '#071414',
        },
      },
    },
  },
  plugins: [],
};
