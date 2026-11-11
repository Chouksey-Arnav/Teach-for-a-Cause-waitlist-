import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        card: "var(--card)",
        soft: "var(--soft)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        line: "var(--line)",
        clay: "var(--clay)",
        "clay-hover": "var(--clay-hover)",
        "clay-ink": "var(--clay-ink)",
        success: "var(--success)",
        "success-bg": "var(--success-bg)",
        "badge-bg": "var(--badge-bg)",
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
