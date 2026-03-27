"use client";

// ─── App shell layout ─────────────────────────────────────────────────────────
// Route group: (app) — wraps all authenticated pages (/conversations, calls, etc.)
// This is a Client Component because it:
//   1. Runs /api/me on mount to rehydrate the Zustand auth store after hard refresh
//   2. Reads Zustand state (isHydrating) to show/hide a loading screen
//   3. Connects the Action Cable consumer once the user is confirmed
//
// Structure rendered here:
//   ┌──────────────────────────────────────────────────────┐
//   │  Sidebar (conversation list — Phase 2)               │
//   │  ┌────────────────────────────────────────────────┐  │
//   │  │  Main content area (children)                  │  │
//   │  └────────────────────────────────────────────────┘  │
//   └──────────────────────────────────────────────────────┘

import { useEffect } from "react";
import { useAuthStore } from "@/store/auth.store";
import { getMe } from "@/services/auth.service";
import { Spinner } from "@/components/ui/spinner";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { setAuth, setHydrating, isHydrating, user } = useAuthStore();

  // ─── Auth hydration on mount ────────────────────────────────────────────────
  // On hard refresh, the Zustand store is empty. We call /api/me which reads the
  // httpOnly cookie server-side and re-validates the JWT against the Rails API.
  // If valid: store gets populated → app renders normally.
  // If invalid/missing: middleware would have already redirected to /login,
  // so this is a defensive backstop for any edge case the middleware missed.
  useEffect(() => {
    if (user) {
      // Already hydrated (e.g. after login in the same tab) — skip the /api/me call
      setHydrating(false);
      return;
    }

    getMe().then((result) => {
      if (result) {
        setAuth(result.token, result.user);
      } else {
        // No valid session — redirect to login.
        // Middleware should have caught this, but we handle it here too.
        window.location.href = "/login";
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Hydration loading state ─────────────────────────────────────────────────
  // Show a full-screen spinner while /api/me resolves on hard refresh.
  // Without this guard, the page would flash with empty/default state before the
  // user data arrives — a jarring experience.
  if (isHydrating) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner size="lg" className="text-muted" />
        <span className="sr-only">Loading your session…</span>
      </div>
    );
  }

  return (
    // Full viewport height, flex row: sidebar on left, content on right.
    // overflow-hidden on the container — each panel controls its own overflow.
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ─── Sidebar (Phase 2) ───────────────────────────────────────────────
          Placeholder for the conversation list sidebar.
          Fixed width on desktop, collapsible on mobile (Phase 6).
          Will render: search bar, conversation list, user profile footer.    */}
      <aside className="hidden w-64 flex-shrink-0 border-r border-border bg-surface md:flex md:flex-col">
        <div className="flex h-14 items-center border-b border-border px-4">
          <span className="text-sm font-semibold text-foreground">Chatterly</span>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-xs text-muted">Conversations — Phase 2</p>
        </div>
      </aside>

      {/* ─── Main content area ───────────────────────────────────────────────
          Takes remaining width, scrolls independently from the sidebar.      */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}
