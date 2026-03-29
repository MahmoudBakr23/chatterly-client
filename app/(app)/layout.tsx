"use client";

// ─── App shell layout ─────────────────────────────────────────────────────────
// Route group: (app) — wraps all authenticated pages (/conversations, calls, etc.)
//
// Sidebar structure (Messenger/Instagram-inspired):
//   ┌──────────────────────────────────────────────────────┐
//   │  Header: "Chatterly" logo  +  Compose button          │
//   │  ─────────────────────────────────────────────────    │
//   │  Conversation list (scrollable)                        │
//   │  ─────────────────────────────────────────────────    │
//   │  Footer: Current user avatar + name + logout           │
//   └──────────────────────────────────────────────────────┘
//
// Responsive behavior:
//   Mobile  — sidebar is full-screen when no conversation is open;
//              hidden when /conversations/[id] is active (chat fills screen).
//   Tablet+ — sidebar (w-72) and chat area side by side, always visible.
//
// Auth hydration:
//   On hard refresh the Zustand store is empty. /api/me reads the httpOnly
//   cookie server-side and repopulates the store. A full-screen spinner is
//   shown during this window to avoid a flash of empty state.

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Toaster } from "sonner";
import { PenSquare, LogOut } from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import { getMe, logout as logoutService } from "@/services/auth.service";
import { usePresence } from "@/hooks/usePresence";
import { useCallChannel } from "@/hooks/useCallChannel";
import { useUserChannel } from "@/hooks/useUserChannel";
import { Spinner } from "@/components/ui/spinner";
import { UserAvatar } from "@/components/ui/user-avatar";
import { ConversationList } from "@/components/chat/ConversationList";
import { IncomingCallModal } from "@/components/call/IncomingCallModal";
import { ActiveCallOverlay } from "@/components/call/ActiveCallOverlay";
import { NewConversationModal } from "@/components/chat/NewConversationModal";
import { cn } from "@/lib/utils";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { setAuth, setHydrating, logout: logoutStore, isHydrating, user } = useAuthStore();
  const [showNewConversation, setShowNewConversation] = useState(false);

  // On mobile: hide sidebar when a specific conversation is open.
  // The chat fills the screen; a back button in MessageThread returns here.
  const isInConversation = /\/conversations\/\d+/.test(pathname);

  usePresence();
  useCallChannel();
  useUserChannel();

  // ─── Auth hydration ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (user) {
      setHydrating(false);
      return;
    }
    getMe().then((result) => {
      if (result) {
        setAuth(result.token, result.user);
      } else {
        window.location.href = "/login";
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleLogout() {
    try {
      await logoutService();
    } finally {
      logoutStore();
      router.push("/login");
    }
  }

  if (isHydrating) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center">
        <Spinner size="lg" className="text-muted" />
        <span className="sr-only">Loading your session…</span>
      </div>
    );
  }

  return (
    <div className="bg-background flex h-screen overflow-hidden">
      {/* ─── Sidebar ──────────────────────────────────────────────────────────
          Hidden on mobile when inside a conversation (chat takes full screen).
          Full-width on mobile when on the conversations index page.           */}
      <aside
        className={cn(
          "bg-sidebar border-sidebar-border flex flex-shrink-0 flex-col border-r",
          "transition-all duration-200",
          // Mobile: full-screen sidebar OR hidden depending on nav state
          isInConversation ? "hidden md:flex" : "flex w-full",
          // Desktop: fixed 288px width
          "md:w-72",
        )}
      >
        {/* ── Sidebar header ──────────────────────────────────────────────────
            Logo + compose button. Height h-14 matches the thread header.     */}
        <div className="border-sidebar-border flex h-14 flex-shrink-0 items-center justify-between border-b px-4">
          <button
            onClick={() => router.push("/conversations")}
            className="text-accent hover:text-accent-hover flex items-center gap-2 font-bold tracking-tight transition-colors"
          >
            {/* Chat bubble brand icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2.546 20.7a.75.75 0 0 0 .956.93l3.684-1.452A9.956 9.956 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2Z" />
            </svg>
            <span className="text-foreground text-base font-semibold">Chatterly</span>
          </button>

          {/* Compose / new conversation button */}
          <button
            onClick={() => setShowNewConversation(true)}
            aria-label="New conversation"
            title="New conversation"
            className={cn(
              "text-muted hover:text-accent hover:bg-accent-muted",
              "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
            )}
          >
            <PenSquare size={16} />
          </button>
        </div>

        {/* ── Conversation list (scrollable) ──────────────────────────────────*/}
        <ConversationList onNewConversation={() => setShowNewConversation(true)} />

        {/* ── User profile footer ─────────────────────────────────────────────
            Shows the logged-in user's avatar + display name + logout button.
            Tapping the avatar/name in future can open a profile sheet.       */}
        {user && (
          <div className="border-sidebar-border flex flex-shrink-0 items-center gap-3 border-t px-4 py-3">
            <button
              onClick={() => router.push(`/conversations`)}
              className="min-w-0 flex-1 flex items-center gap-2.5 text-left"
              title="Your profile"
            >
              <UserAvatar user={user} size="sm" />
              <div className="min-w-0">
                <p className="text-foreground truncate text-sm font-medium leading-tight">
                  {user.display_name || user.username}
                </p>
                <p className="text-muted truncate text-xs leading-tight">@{user.username}</p>
              </div>
            </button>

            <button
              onClick={handleLogout}
              aria-label="Sign out"
              title="Sign out"
              className="text-muted hover:text-destructive flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md transition-colors"
            >
              <LogOut size={15} />
            </button>
          </div>
        )}
      </aside>

      {/* ─── Main content area ────────────────────────────────────────────────
          On mobile: only visible when inside a conversation.
          On desktop: always visible alongside the sidebar.                   */}
      <main
        className={cn(
          "flex flex-1 flex-col overflow-hidden",
          isInConversation ? "flex" : "hidden md:flex",
        )}
      >
        {children}
      </main>

      {/* ─── Global overlays ──────────────────────────────────────────────────*/}
      {showNewConversation && (
        <NewConversationModal onClose={() => setShowNewConversation(false)} />
      )}
      <IncomingCallModal />
      <ActiveCallOverlay />
      <Toaster position="bottom-right" richColors closeButton />
    </div>
  );
}
