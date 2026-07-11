/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
    "../../packages/editor/src/**/*.{ts,tsx}",
    "../../packages/editor/dist/**/*.{js,cjs}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ruler: {
          amber: "#fbbf24",
          brown: "#78350f",
        },
      },
    },
  },
  plugins: [],
};
