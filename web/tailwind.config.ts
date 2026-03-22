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
          bg: "#0a0a0f",
          surface: "#0d0d14",
          card: "rgba(15,15,25,0.6)",
          "card-solid": "#0f0f19",
          border: "rgba(255,255,255,0.06)",
          "border-hover": "rgba(255,255,255,0.12)",
          accent: "#3b82f6",
          "accent-hover": "#2563eb",
          purple: "#8b5cf6",
          muted: "#525a73",
          text: "#e2e8f0",
          "text-dim": "#71778a",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-out",
        "fade-in-up": "fadeInUp 0.6s ease-out",
        "fade-in-up-delay": "fadeInUp 0.6s ease-out 0.1s both",
        "fade-in-up-delay-2": "fadeInUp 0.6s ease-out 0.2s both",
        "fade-in-up-delay-3": "fadeInUp 0.6s ease-out 0.3s both",
        "glow-pulse": "glowPulse 3s ease-in-out infinite",
        "shimmer": "shimmer 2s linear infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        glowPulse: {
          "0%, 100%": { boxShadow: "0 0 20px rgba(59,130,246,0.15)" },
          "50%": { boxShadow: "0 0 40px rgba(59,130,246,0.25)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-mesh":
          "radial-gradient(at 20% 20%, rgba(59,130,246,0.08) 0, transparent 50%), radial-gradient(at 80% 80%, rgba(139,92,246,0.06) 0, transparent 50%), radial-gradient(at 50% 0%, rgba(59,130,246,0.04) 0, transparent 60%)",
      },
    },
  },
  plugins: [],
};

export default config;
