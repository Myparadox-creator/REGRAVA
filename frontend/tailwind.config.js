/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Core Obsidian Palette
        obsidian: {
          bg: "#08090C",
          sidebar: "#0B0D11",
          header: "#0B0D11",
          content: "#08090C",
          card: "#111318",
          cardHover: "#15181F",
          secondary: "#15181F",
          elevated: "#1B1F27",
          modal: "#15181F",
        },
        // Borders & Separators
        border: {
          default: "#252932",
          subtle: "#1C2028",
          active: "#454B58",
          hover: "#555D6B",
        },
        // Typography Colors
        text: {
          primary: "#F5F6F8",
          secondary: "#D1D5DC",
          muted: "#9299A5",
          dim: "#707783",
          disabled: "#515762",
        },
        // Brand Accent: REGRAVA Purple
        regrava: {
          primary: "#7657FF",
          hover: "#896EFF",
          soft: "#211A35",
          border: "#48366F",
        },
        // Semantic Status Colors
        semantic: {
          success: "#10B981",
          danger: "#F04452",
          warning: "#F59E0B",
          active: "#896EFF",
          info: "#9299A5",
        },
        // Mapped legacy aliases ensuring NO blue leaks through
        navy: {
          950: "#08090C",
          900: "#111318",
          850: "#15181F",
          800: "#1B1F27",
          750: "#252932",
          700: "#252932",
          600: "#454B58",
        },
        sentinel: {
          cyan: "#7657FF",      // Purge cyan -> replaced with REGRAVA purple
          blue: "#896EFF",      // Purge blue -> replaced with lighter purple
          amber: "#F59E0B",     // semantic warning
          rose: "#F04452",      // semantic danger
          emerald: "#10B981",   // semantic success
        }
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "Consolas", "monospace"],
      }
    },
  },
  plugins: [],
}
