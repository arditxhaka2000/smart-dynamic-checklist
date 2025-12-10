import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#020617",
        foreground: "#0f172a",
        primary: {
          50: "#ecfeff",
          500: "#06b6d4",
          600: "#0891b2"
        }
      }
    },
  },
  plugins: [],
}

export default config
