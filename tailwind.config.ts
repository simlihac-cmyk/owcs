import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#112031",
        mist: "#F4F7F5",
        pine: "#2A5C4D",
        leaf: "#5E8B7E",
        sand: "#D7C9AA",
        coral: "#C96C50"
      },
      fontFamily: {
        sans: ["Segoe UI", "Apple SD Gothic Neo", "Noto Sans KR", "sans-serif"]
      },
      boxShadow: {
        panel: "0 20px 50px rgba(17, 32, 49, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
