// ─── Root layout ─────────────────────────────────────────────────────────────
// This is the outermost shell for every page — the equivalent of
// ApplicationController + application.html.erb in Rails. It renders once and
// wraps all route segments below it.
//
// Server Component by default (no "use client") — it runs on the server at request
// time and never re-renders on the client. This means we can safely read env vars,
// set metadata, and avoid shipping this code to the browser bundle.

import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

// next/font downloads Inter at build time and self-hosts it as a static asset.
// Benefits over a <link> tag to Google Fonts:
//   1. No external network request — faster, privacy-friendly, no CORS issues
//   2. No layout shift (CLS) — font is preloaded and size-adjusted automatically
//   3. Inlined CSS — no render-blocking stylesheet load
const inter = Inter({
  subsets: ["latin"],
  // variable maps the font to our CSS variable --font-sans defined in globals.css @theme.
  // This lets Tailwind's font-sans utility pick up Inter automatically.
  variable: "--font-sans",
  display: "swap", // show system font while Inter loads, then swap — no invisible text
});

export const metadata: Metadata = {
  title: {
    // Template: individual pages set title, root layout provides the suffix.
    // e.g. "Conversations | Chatterly"
    template: "%s | Chatterly",
    default: "Chatterly",
  },
  description: "Real-time chat, reimagined.",
  // Prevent search engines from indexing the authenticated app shell.
  // Auth pages (login/register) are fine to index; the app itself is private.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  // width=device-width prevents iOS from zooming out on narrow screens.
  // initial-scale=1 ensures 1px CSS = 1px device pixel on load.
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      // Apply Inter's CSS variable to the html element so Tailwind utilities
      // that reference --font-sans work anywhere in the tree.
      className={inter.variable}
    >
      <body>
        {children}

        {/* Sonner's Toaster renders toast notifications from anywhere in the app.
            We call toast() directly (no context needed) — Sonner handles placement.
            richColors: success=green, error=red, info=blue — semantic at a glance.
            closeButton: lets users dismiss without waiting for the timeout.        */}
        <Toaster position="top-right" richColors closeButton duration={4000} />
      </body>
    </html>
  );
}
