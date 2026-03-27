// PostCSS is the CSS processing pipeline. Next.js runs every CSS file through it.
// Tailwind v4 ships its own PostCSS plugin (@tailwindcss/postcss) that reads the
// @import "tailwindcss" directive and the @theme block from globals.css —
// no tailwind.config.ts needed. The entire design system lives in CSS.
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
