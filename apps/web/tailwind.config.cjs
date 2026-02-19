/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"] ,
  theme: {
    extend: {
      colors: {
        // Binance Primary - Yellow
        primary: "#F0B90B",
        "primary-hover": "#F8D33A",
        "primary-dark": "#C89F04",
        
        // Background Scale - Deep Blacks
        "bg-main": "#0B0E11",
        "bg-secondary": "#111418",
        "bg-tertiary": "#151A21",
        
        // Surface Scale - Card Grays
        surface: "#1E2329",
        "surface-hover": "#2B3139",
        "surface-elevated": "#343A42",
        
        // Border Scale
        border: "#2B3139",
        "border-subtle": "#1E2329",
        "border-focus": "#F0B90B",
        
        // Text Scale
        "text-main": "#EAECEF",
        "text-secondary": "#848E9C",
        "text-tertiary": "#5E6673",
        "text-inverse": "#0B0E11",
        
        // Semantic Colors (Binance Standard)
        success: "#0ECB81",
        "success-bg": "#0ECB811A",
        danger: "#F6465D",
        "danger-bg": "#F6465D1A",
        warning: "#F0B90B",
        info: "#3498DB",
        
        // Trading Colors
        "trade-yes": "#0ECB81",
        "trade-no": "#F6465D",
        "trade-up": "#0ECB81",
        "trade-down": "#F6465D",
        
        // Legacy aliases (for gradual migration)
        "bg-terminal": "#0B0E11",
        "surface-terminal": "#1E2329",
        "border-terminal": "#2B3139",
        "border-dark": "#2B3139",
        "background-dark": "#0B0E11",
        "surface-dark": "#1E2329",
        "panel-dark": "#1E2329",
        "card-dark": "#1E2329",
        "text-dim": "#848E9C",
        "text-bright": "#EAECEF",
        "text-muted": "#848E9C",
        "neon-green": "#0ECB81",
        "neon-red": "#F6465D",
        "accent-blue": "#3498DB"
      },
      fontFamily: {
        // Primary: Inter for clean finance UI
        display: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        body: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        // Monospace for numbers/data
        mono: [
          "JetBrains Mono",
          "Fira Code",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace"
        ]
      },
      borderRadius: {
        DEFAULT: "4px",
        sm: "2px",
        md: "4px",
        lg: "6px",
        xl: "8px",
        "2xl": "12px",
        full: "9999px"
      },
      boxShadow: {
        // Subtle depth shadows (no glow)
        sm: "0 1px 2px rgba(0,0,0,0.3)",
        DEFAULT: "0 2px 4px rgba(0,0,0,0.3)",
        md: "0 4px 6px rgba(0,0,0,0.3)",
        lg: "0 8px 16px rgba(0,0,0,0.4)",
        xl: "0 12px 24px rgba(0,0,0,0.5)",
        // Legacy glow shadows (deprecated, kept for compatibility)
        "glow-red": "0 0 10px rgba(246, 70, 93, 0.3)",
        "glow-green": "0 0 8px rgba(14, 203, 129, 0.3)",
        glow: "0 0 15px rgba(240, 185, 11, 0.2)",
        "glow-sm": "0 0 8px rgba(240, 185, 11, 0.3)"
      },
      backgroundImage: {
        // Gradients
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        // Legacy terminal grid (deprecated)
        "terminal-grid":
          "linear-gradient(#111 1px, transparent 1px), linear-gradient(90deg, #111 1px, transparent 1px)",
        "grid-pattern":
          "linear-gradient(to right, #1a1a1a 1px, transparent 1px), linear-gradient(to bottom, #1a1a1a 1px, transparent 1px)"
      }
    }
  },
  plugins: [
    require("@tailwindcss/forms"),
    require("@tailwindcss/typography"),
    require("@tailwindcss/container-queries")
  ]
};
