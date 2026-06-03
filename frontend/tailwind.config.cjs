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
        dark: {
          primary:   '#16181D',
          secondary: '#1E2128',
          tertiary:  '#252932',
          hover:     '#2C3140',
          active:    '#313849',
          border:    '#2E3340',
          card:      '#1E2128',
          input:     '#1A1D24',
        },
      },
    },
  },
  plugins: [],
};
