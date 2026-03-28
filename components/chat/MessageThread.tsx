"use client";

// ─── MessageThread ────────────────────────────────────────────────────────────
// The main content area for an open conversation.
// Orchestrates: fetching the conversation + its messages, subscribing to the
// Action Cable channel, and rendering the message list + input.
//
// Backend connection:
//   - getConversation(id)  → GET /api/v1/conversations/:id (:with_members view)
//   - getMessages(id)      → GET /api/v1/conversations/:id/messages (paginated)
//   - ConversationChannel  → WebSocket stream "conversation_<id>"
//   - sendMessage() is delegated to MessageInput — this component doesn't call it.
//
// Scalability notes:
//   - Auto-scroll: uses a sentinel div at the bottom of the list and
//     scrollIntoView on new messages. We only auto-scroll if the user is already
//     near the bottom — otherwise we'd yank them away from history they're reading.
//   - Pagination: a "Load earlier" button at the top fetches the next cursor page
//     and prepends messages. The scroll position is preserved after prepend.
//   - The component subscribes to the channel only after auth hydration
//     (token is confirmed in useConversationChannel).

import { useEffect, useRef, useCallback } from "react";
import { useConversationsStore } from "@/store/conversations.store";
import { useAuthStore } from "@/store/auth.store";
import { getConversation } from "@/services/conversations.service";
import { getMessages } from "@/services/messages.service";
import { useConversationChannel } from "@/hooks/useConversationChannel";
import { MessageItem } from "@/components/chat/MessageItem";
import { MessageInput } from "@/components/chat/MessageInput";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Spinner } from "@/components/ui/spinner";

interface MessageThreadProps {
  conversationId: number;
}

export function MessageThread({ conversationId }: MessageThreadProps) {
  const currentUser = useAuthStore((state) => state.user);
  const {
    activeConversation,
    messages,
    nextCursors,
    isLoadingMessages,
    setActiveConversation,
    setMessages,
    prependMessages,
    setLoadingMessages,
  } = useConversationsStore();

  // Subscribe to live updates for this conversation.
  useConversationChannel(conversationId);

  // Sentinel div at the bottom — used for auto-scroll.
  const bottomRef = useRef<HTMLDivElement>(null);
  // Track scroll container to detect if user is near the bottom.
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // ─── Initial data fetch ─────────────────────────────────────────────────────
  useEffect(() => {
    // Fetch both in parallel: conversation metadata and first message page.
    setLoadingMessages(true);

    Promise.all([getConversation(conversationId), getMessages(conversationId)])
      .then(([conv, page]) => {
        setActiveConversation(conv);
        setMessages(conversationId, page.messages, page.next_cursor);
      })
      .catch(() => {
        // On error leave the state empty — the empty/error state below handles it.
      })
      .finally(() => setLoadingMessages(false));

    // Cleanup: clear the active conversation when navigating away.
    return () => {
      setActiveConversation(null);
    };
  }, [conversationId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Auto-scroll on new messages ───────────────────────────────────────────
  const threadMessages = messages[conversationId] ?? [];
  const lastMessage = threadMessages[threadMessages.length - 1];

  useEffect(() => {
    if (!lastMessage) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    // Only auto-scroll if the user is within 150px of the bottom.
    // This prevents hijacking scroll position when loading history.
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;

    if (distanceFromBottom < 150) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [lastMessage]);

  // ─── Pagination: load earlier messages ────────────────────────────────────
  const nextCursor = nextCursors[conversationId];

  const loadEarlier = useCallback(async () => {
    if (!nextCursor) return;
    const scrollContainer = scrollContainerRef.current;
    // Snapshot scroll height before prepend to restore position after.
    const prevScrollHeight = scrollContainer?.scrollHeight ?? 0;

    setLoadingMessages(true);
    try {
      const page = await getMessages(conversationId, nextCursor);
      prependMessages(conversationId, page.messages, page.next_cursor);

      // Restore scroll position — adding items above shifts the view down.
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight - prevScrollHeight;
      }
    } finally {
      setLoadingMessages(false);
    }
  }, [conversationId, nextCursor]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Loading state ──────────────────────────────────────────────────────────
  if (isLoadingMessages && threadMessages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner size="md" className="text-muted" />
      </div>
    );
  }

  // ─── Derive conversation display name ──────────────────────────────────────
  let headerTitle = activeConversation?.name ?? "Loading…";
  let headerSub: string | null = null;

  if (activeConversation) {
    if (activeConversation.conversation_type === "direct" && currentUser) {
      // For DMs, show the other person's display_name in the header
      const other = activeConversation.members.find((m) => m.id !== currentUser.id);
      headerTitle = other?.display_name ?? "Direct Message";
      headerSub = other?.online ? "Online" : null;
    } else if (activeConversation.conversation_type === "group") {
      headerTitle = activeConversation.name ?? "Group Chat";
      headerSub = `${activeConversation.member_count} members`;
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* ── Thread header ──────────────────────────────────────────────────────
          Shows conversation name and member count (or online status for DMs).
          Height matches the sidebar header (h-14) for visual alignment.       */}
      <header className="border-border bg-surface flex h-14 flex-shrink-0 items-center gap-3 border-b px-4">
        {/* Avatar cluster: for DMs show the other user's avatar */}
        {activeConversation?.conversation_type === "direct" &&
          currentUser &&
          (() => {
            const other = activeConversation.members.find((m) => m.id !== currentUser.id);
            return other ? <UserAvatar user={other} size="sm" /> : null;
          })()}

        <div>
          <p className="text-foreground text-sm font-semibold">{headerTitle}</p>
          {headerSub && <p className="text-muted text-xs">{headerSub}</p>}
        </div>
      </header>

      {/* ── Message list ───────────────────────────────────────────────────────
          flex-1 + overflow-y-auto makes this area scroll independently.
          The bottom sentinel div triggers auto-scroll on new messages.         */}
      <div
        ref={scrollContainerRef}
        className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4"
      >
        {/* Load earlier button — only shown if more pages exist */}
        {nextCursor && (
          <div className="flex justify-center">
            <button
              onClick={loadEarlier}
              disabled={isLoadingMessages}
              className="border-border bg-surface text-muted hover:bg-surface-muted rounded-full border px-4 py-1.5 text-xs transition-colors disabled:opacity-50"
            >
              {isLoadingMessages ? "Loading…" : "Load earlier messages"}
            </button>
          </div>
        )}

        {/* Empty state — conversation exists but no messages yet */}
        {threadMessages.length === 0 && !isLoadingMessages && (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-muted text-sm">No messages yet. Say hello!</p>
          </div>
        )}

        {threadMessages.map((message) => (
          <MessageItem
            key={message.id}
            message={message}
            isOwn={message.user.id === currentUser?.id}
          />
        ))}

        {/* Scroll sentinel */}
        <div ref={bottomRef} aria-hidden="true" />
      </div>

      {/* ── Message input ──────────────────────────────────────────────────────*/}
      <MessageInput conversationId={conversationId} />
    </div>
  );
}
