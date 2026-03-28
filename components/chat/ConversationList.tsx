"use client";

// ─── ConversationList ─────────────────────────────────────────────────────────
// The sidebar panel — fetches all conversations on mount and renders them as
// a scrollable list of ConversationItem rows.
//
// Backend connection:
//   Calls getConversations() → GET /api/v1/conversations (:with_members view)
//   Returns ConversationWithMembers[] so each row can render a presence dot
//   for DMs without a second request.
//   The list is re-sorted in the store when a new message arrives (addMessage action
//   moves the active conversation to the top), so this component stays reactive.
//
// Scalability notes:
//   - The list renders all conversations the user belongs to at once.
//     For users in 100+ conversations a virtualised list (react-virtual) would be
//     needed — not required until Phase 6.
//   - Error state shows a retry button rather than crashing the whole layout.

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useConversationsStore } from "@/store/conversations.store";
import { useAuthStore } from "@/store/auth.store";
import { getConversations } from "@/services/conversations.service";
import { ConversationItem } from "@/components/chat/ConversationItem";
import { Spinner } from "@/components/ui/spinner";

export function ConversationList() {
  const { conversations, isLoadingConversations, setConversations, setLoadingConversations } =
    useConversationsStore();
  const currentUser = useAuthStore((state) => state.user);

  const pathname = usePathname();
  const activeIdStr = pathname.match(/\/conversations\/(\d+)/)?.[1];
  const activeId = activeIdStr ? parseInt(activeIdStr, 10) : null;

  // ─── Fetch conversations on mount ──────────────────────────────────────────
  useEffect(() => {
    if (conversations.length > 0) return;

    setLoadingConversations(true);
    getConversations()
      .then((data) => setConversations(data))
      .catch(() => {})
      .finally(() => setLoadingConversations(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Loading state ─────────────────────────────────────────────────────────
  if (isLoadingConversations) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner size="sm" className="text-muted" />
      </div>
    );
  }

  // ─── Empty state ───────────────────────────────────────────────────────────
  if (conversations.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
        <p className="text-foreground text-xs font-medium">No conversations yet</p>
        <p className="text-muted text-xs">Start one from your contacts.</p>
      </div>
    );
  }

  // ─── Conversation list ─────────────────────────────────────────────────────
  return (
    <nav
      aria-label="Conversations"
      className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-2"
    >
      {conversations.map((conversation) => (
        <ConversationItem
          key={conversation.id}
          conversation={conversation}
          isActive={conversation.id === activeId}
          currentUserId={currentUser?.id ?? 0}
        />
      ))}
    </nav>
  );
}
