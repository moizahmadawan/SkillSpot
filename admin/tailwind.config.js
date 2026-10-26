export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {
    colors: { ink: '#12241F', leaf: { DEFAULT: '#0E5B47', dark: '#0A4536', soft: '#DCEBE5' }, saffron: '#F0A202', mist: '#EEF3F1', danger: '#B3261E' },
    fontFamily: { display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'], sans: ['"Hanken Grotesk"', 'system-ui', 'sans-serif'] },
  } },
  plugins: [],
};
