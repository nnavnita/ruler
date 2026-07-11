/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
    "../../packages/editor/src/**/*.{ts,tsx}",
    "../../packages/editor/dist/**/*.{js,cjs}",
  ],
  darkMode: "media",
  theme: {
    extend: {
      colors: {
        ruler: {
          amber: "#fbbf24",
          brown: "#78350f",
        },
      },
      fontFamily: {
        sans: [
          "Inter var",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "SF Mono",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
    },
  },
  plugins: [],
};
