/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class", // class-based theme switching
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        heading: ["Sora", "ui-serif", "serif"],
        sans: ["Cabin", "ui-sans-serif", "system-ui"],
      },
    },
  },
  plugins: [],
};
