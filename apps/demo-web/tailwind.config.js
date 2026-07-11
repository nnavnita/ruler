/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
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
