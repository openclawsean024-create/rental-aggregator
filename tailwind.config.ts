import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      // 設計準則：偏冷的 slate/indigo 為主色（trust + 避坑）
      colors: {
        // 取 slate 為中性、indigo 為主色，amber 為警示，red-700 為嚴重事件
        brand: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
          950: "#1e1b4b",
        },
        warn: {
          500: "#f59e0b", // amber-500 — 預設警示
          700: "#b45309",
        },
        danger: {
          700: "#b91c1c", // red-700 — 黑名單嚴重者
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "Noto Sans TC",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      fontSize: {
        // 內文 14/15px、行高 1.6
        body: ["15px", { lineHeight: "1.6" }],
        bodySm: ["14px", { lineHeight: "1.6" }],
      },
      // 100ms transition — 設計準則
      transitionDuration: {
        DEFAULT: "100ms",
      },
      boxShadow: {
        // Airbnb / Stripe 風格的安靜陰影
        card: "0 1px 2px rgb(15 23 42 / 0.04), 0 1px 3px rgb(15 23 42 / 0.06)",
        cardHover:
          "0 4px 12px rgb(15 23 42 / 0.06), 0 2px 6px rgb(15 23 42 / 0.04)",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fadeIn 200ms ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
