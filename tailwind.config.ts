import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#172126",
        mist: "#eff3f4",
        copper: "#b56a3a",
        sage: "#6e8b7b",
        marina: "#27556c"
      },
      boxShadow: {
        soft: "0 16px 40px rgba(23, 33, 38, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
