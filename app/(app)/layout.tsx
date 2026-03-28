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
import { usePresence } from "@/hooks/usePresence";
import { useCallChannel } from "@/hooks/useCallChannel";
import { Spinner } from "@/components/ui/spinner";
import { ConversationList } from "@/components/chat/ConversationList";
import { IncomingCallModal } from "@/components/call/IncomingCallModal";
import { ActiveCallOverlay } from "@/components/call/ActiveCallOverlay";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { setAuth, setHydrating, isHydrating, user } = useAuthStore();

  // Mount the PresenceChannel subscription for the entire authenticated session.
  // One subscription per tab — broadcasts online/offline status globally.
  usePresence();

  // Mount the CallChannel subscription for the entire authenticated session.
  // Handles incoming call notifications, WebRTC signaling, and call control events.
  // Must be at layout level — not per-conversation — so calls can arrive regardless
  // of which page the user is on.
  useCallChannel();

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
      <div className="bg-background flex min-h-screen items-center justify-center">
        <Spinner size="lg" className="text-muted" />
        <span className="sr-only">Loading your session…</span>
      </div>
    );
  }

  return (
    // Full viewport height, flex row: sidebar on left, content on right.
    // overflow-hidden on the container — each panel controls its own overflow.
    <div className="bg-background flex h-screen overflow-hidden">
      {/* ─── Sidebar (Phase 2) ───────────────────────────────────────────────
          Placeholder for the conversation list sidebar.
          Fixed width on desktop, collapsible on mobile (Phase 6).
          Will render: search bar, conversation list, user profile footer.    */}
      <aside className="border-border bg-surface hidden w-64 flex-shrink-0 border-r md:flex md:flex-col">
        {/* Sidebar header — fixed height matches the thread header for visual alignment */}
        <div className="border-border flex h-14 items-center border-b px-4">
          <span className="text-foreground text-sm font-semibold">Chatterly</span>
        </div>
        {/* Scrollable conversation list fills remaining sidebar height */}
        <ConversationList />
      </aside>

      {/* ─── Main content area ───────────────────────────────────────────────
          Takes remaining width, scrolls independently from the sidebar.      */}
      <main className="flex flex-1 flex-col overflow-hidden">{children}</main>

      {/* ─── Call overlays ───────────────────────────────────────────────────
          Mounted once at layout level so they render above all page content.
          IncomingCallModal: z-50, renders when incomingCall is set in call store
          ActiveCallOverlay: z-40, renders when activeCallSessionId is set        */}
      <IncomingCallModal />
      <ActiveCallOverlay />
    </div>
  );
}
