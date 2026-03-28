import type { Config } from "tailwindcss";

// Tailwind v4 supports theme customization through `tailwind.config.*`.
// We map our CSS variables (defined in `app/globals.css`) to the theme keys
// so existing utilities like `bg-background`, `text-foreground`,
// `border-border`, `rounded-md`, and `shadow-sm` keep working.
export default {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        background: "var(--color-background)",
        foreground: "var(--color-foreground)",
        surface: "var(--color-surface)",
        "surface-muted": "var(--color-surface-muted)",
        border: "var(--color-border)",
        muted: "var(--color-muted)",

        // Sidebar — subtle purple-tinted surface
        sidebar: "var(--color-sidebar)",
        "sidebar-hover": "var(--color-sidebar-hover)",
        "sidebar-active": "var(--color-sidebar-active)",
        "sidebar-border": "var(--color-sidebar-border)",

        // Primary purple accent
        accent: "var(--color-accent)",
        "accent-hover": "var(--color-accent-hover)",
        "accent-muted": "var(--color-accent-muted)",
        "accent-foreground": "var(--color-accent-foreground)",

        // Secondary violet
        secondary: "var(--color-secondary)",
        "secondary-muted": "var(--color-secondary-muted)",
        "secondary-foreground": "var(--color-secondary-foreground)",

        destructive: "var(--color-destructive)",
        "destructive-foreground": "var(--color-destructive-foreground)",

        success: "var(--color-success)",
        "success-foreground": "var(--color-success-foreground)",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        full: "var(--radius-full)",
      },
      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
    },
  },
} satisfies Config;
