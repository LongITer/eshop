const { join } = require('node:path');


/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [join(__dirname, 'src/**/*.{ts,tsx,js,jsx,html}'), join(__dirname, '../../packages/components/**/*.{ts,tsx,js,jsx}')],
  theme: {
    extend: {
      fontFamily: {
        Poppins: ["var(--font-poppins)"],
      }
    },
  },
  plugins: [],
};
