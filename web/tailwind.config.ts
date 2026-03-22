import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        aegis: {
          bg: "#0a0e1a",
          surface: "#111827",
          card: "#1a2235",
          border: "#2a3550",
          accent: "#3b82f6",
          "accent-hover": "#2563eb",
          muted: "#6b7fa3",
          text: "#e2e8f0",
          "text-dim": "#94a3b8",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
