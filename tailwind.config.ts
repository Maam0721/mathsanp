import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1d2b24",
        moss: "#315b40",
        lime: "#d8f36a",
        canvas: "#f7f8f4",
      },
      fontFamily: {
        sans: ["Arial", "Helvetica", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
