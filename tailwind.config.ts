import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        lime: {
          400: "#B4FF47",
          500: "#9FE83A",
        },
        slate: {
          850: "#131620",
          900: "#0F1117",
          800: "#1A1D27",
          700: "#252836",
          600: "#343748",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-space)", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
