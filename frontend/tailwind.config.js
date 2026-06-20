/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        card: "var(--surface)",
        border: "var(--border)",
        elevated: "var(--surface-elevated)",
        accent: "var(--accent)",
        accentForeground: "var(--accent-foreground)",
        textPrimary: "var(--foreground)",
        textSecondary: "var(--muted-foreground)",
        textMuted: "var(--disabled)",
        statusGreen: "#22C55E",
        statusAmber: "#EAB308",
        statusRed: "#EF4444",
      },
      borderRadius: {
        custom: "6px",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
}
