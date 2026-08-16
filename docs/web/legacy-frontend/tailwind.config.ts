import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}", "../../packages/web-ui/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        aegis: {
          ink: "#05070d",
          panel: "#0b1220",
          blue: "#0879ed",
          "blue-light": "#43c7ff",
          orange: "#f87808",
          white: "#edf4ff",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
