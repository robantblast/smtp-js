/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f6f3ef",
          100: "#ece6df",
          200: "#d7cbbd",
          300: "#b9a690",
          400: "#987c63",
          500: "#7a5f46",
          600: "#604735",
          700: "#473425",
          800: "#332419",
          900: "#24180f"
        },
        clay: {
          50: "#fff6ed",
          100: "#ffe6d2",
          200: "#ffd1aa",
          300: "#ffb677",
          400: "#ff9340",
          500: "#ff7a1a",
          600: "#e15e07",
          700: "#b54707",
          800: "#8f3a0c",
          900: "#74320d"
        }
      },
      boxShadow: {
        soft: "0 14px 40px rgba(36, 24, 15, 0.12)",
        chip: "0 6px 18px rgba(36, 24, 15, 0.14)"
      },
      fontFamily: {
        display: ["Playfair Display", "serif"],
        body: ["Space Grotesk", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};
