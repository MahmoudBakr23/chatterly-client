"use client";

// ─── MessageThread ────────────────────────────────────────────────────────────
// The main content area for an open conversation.
// Orchestrates: fetching the conversation + its messages, subscribing to the
// Action Cable channel, and rendering the message list + input.
//
// Phase 5 additions:
//   - Message grouping: consecutive messages from the same sender within 5 minutes
//     are passed isGrouped=true, suppressing the repeated avatar and name header.
//   - Toast error notifications on failed conversation/message fetch.
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
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Users } from "lucide-react";
import { useConversationsStore } from "@/store/conversations.store";
import { useAuthStore } from "@/store/auth.store";
import { usePresenceStore } from "@/store/presence.store";
import { getConversation } from "@/services/conversations.service";
import { getMessages } from "@/services/messages.service";
import { useConversationChannel } from "@/hooks/useConversationChannel";
import { MessageItem } from "@/components/chat/MessageItem";
import { MessageInput } from "@/components/chat/MessageInput";
import { UserAvatar } from "@/components/ui/user-avatar";
import { PresenceDot } from "@/components/ui/PresenceDot";
import { Spinner } from "@/components/ui/spinner";
import { CallButton } from "@/components/call/CallButton";
import type { Message } from "@/types";

// Two consecutive messages are grouped when they share the same sender and were
// sent within this threshold. Keeps the thread compact for fast back-and-forth.
const GROUP_THRESHOLD_MS = 5 * 60 * 1_000; // 5 minutes

function isGroupedWith(prev: Message, curr: Message): boolean {
  if (prev.user.id !== curr.user.id) return false;
  return (
    new Date(curr.created_at).getTime() - new Date(prev.created_at).getTime() < GROUP_THRESHOLD_MS
  );
}

interface MessageThreadProps {
  conversationId: number;
}

export function MessageThread({ conversationId }: MessageThreadProps) {
  const router = useRouter();
  const currentUser = useAuthStore((state) => state.user);
  const isOnline = usePresenceStore((state) => state.isOnline);
  const {
    activeConversation,
    messages,
    nextCursors,
    isLoadingMessages,
    typingUsers,
    setActiveConversation,
    setMessages,
    prependMessages,
    setLoadingMessages,
  } = useConversationsStore();

  // Subscribe to live updates for this conversation.
  // sendTyping/sendStopTyping are passed to MessageInput for logical start/stop events.
  const { sendTyping, sendStopTyping } = useConversationChannel(conversationId);

  // Sentinel div at the bottom — used for auto-scroll.
  const bottomRef = useRef<HTMLDivElement>(null);
  // Track scroll container to detect if user is near the bottom.
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // True until the initial message batch has been scrolled into view.
  // On first load we jump instantly to the bottom; subsequent new messages
  // only auto-scroll if the user is already near the bottom.
  const hasInitialScrolledRef = useRef(false);

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
        toast.error("Failed to load conversation. Please try again.");
      })
      .finally(() => setLoadingMessages(false));

    // Cleanup: clear the active conversation when navigating away,
    // and reset the initial-scroll flag for the next conversation.
    return () => {
      setActiveConversation(null);
      hasInitialScrolledRef.current = false;
    };
  }, [conversationId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Auto-scroll on new messages ───────────────────────────────────────────
  const threadMessages = messages[conversationId] ?? [];
  const lastMessage = threadMessages[threadMessages.length - 1];

  useEffect(() => {
    if (!lastMessage) return;

    // Initial load: jump instantly to the bottom so the user lands at the
    // newest message, not the oldest. Skip the distance guard here.
    if (!hasInitialScrolledRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "instant" });
      hasInitialScrolledRef.current = true;
      return;
    }

    const container = scrollContainerRef.current;
    if (!container) return;

    // Subsequent messages: only auto-scroll if the user is within 150px of the
    // bottom. This prevents hijacking scroll position when reading history.
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
    } catch {
      toast.error("Failed to load earlier messages.");
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

  // otherMember: the other person in a DM — used for avatar + presence status
  let otherMember = activeConversation?.members.find((m) => m.id !== currentUser?.id) ?? null;

  if (activeConversation) {
    if (activeConversation.conversation_type === "direct" && currentUser) {
      headerTitle = otherMember?.display_name ?? "Direct Message";
      // Read presence live from the store — updates in real-time via PresenceChannel
      headerSub = otherMember && isOnline(otherMember.id) ? "Online" : null;
    } else if (activeConversation.conversation_type === "group") {
      otherMember = null; // groups don't have a single "other" member
      headerTitle = activeConversation.name ?? "Group Chat";
      headerSub = `${activeConversation.member_count} members`;
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* ── Thread header ──────────────────────────────────────────────────────
          Height matches the sidebar header (h-14) for visual alignment.
          Back arrow on mobile returns to the conversation list.              */}
      <header className="border-border bg-surface flex h-14 flex-shrink-0 items-center gap-2.5 border-b px-3">
        {/* Back button — mobile only */}
        <button
          onClick={() => router.push("/conversations")}
          aria-label="Back to conversations"
          className="text-muted hover:text-foreground hover:bg-surface-muted -ml-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md transition-colors md:hidden"
        >
          <ArrowLeft size={18} />
        </button>

        {/* Avatar + presence dot for DM header */}
        {activeConversation?.conversation_type === "direct" && otherMember ? (
          <div className="relative flex-shrink-0">
            <UserAvatar user={otherMember} size="md" />
            <PresenceDot
              userId={otherMember.id}
              size="sm"
              className="absolute -right-0.5 -bottom-0.5"
            />
          </div>
        ) : activeConversation?.conversation_type === "group" ? (
          <div className="bg-accent-muted flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full">
            <Users size={14} className="text-accent" />
          </div>
        ) : null}

        <div className="flex-1 min-w-0">
          <p className="text-foreground truncate text-sm font-semibold">{headerTitle}</p>
          {headerSub && <p className="text-muted truncate text-xs">{headerSub}</p>}
        </div>

        {activeConversation && <CallButton conversationId={activeConversation.id} />}
      </header>

      {/* ── Message list ───────────────────────────────────────────────────────
          flex-1 + overflow-y-auto makes this area scroll independently.
          The bottom sentinel div triggers auto-scroll on new messages.
          gap-0 here — MessageItem controls its own top padding via isGrouped.  */}
      <div ref={scrollContainerRef} className="flex flex-1 flex-col overflow-y-auto px-4 py-4">
        {/* Load earlier button — only shown if more pages exist */}
        {nextCursor && (
          <div className="flex justify-center pb-2">
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

        {/* Message list — isGrouped computed by comparing each message to the
            previous one. The first message in the list is never grouped.      */}
        {threadMessages.map((message, index) => {
          const prev = threadMessages[index - 1];
          const grouped = !!prev && isGroupedWith(prev, message);

          return (
            <MessageItem
              key={message.id}
              message={message}
              isOwn={message.user.id === currentUser?.id}
              isGrouped={grouped}
            />
          );
        })}

        {/* Scroll sentinel */}
        <div ref={bottomRef} aria-hidden="true" />
      </div>

      {/* ── Typing indicator ───────────────────────────────────────────────────
          Shows "Alice is typing…" below the message list.
          typingUsers[conversationId] is a Record<userId, displayName>.
          Populated on typing_start, cleared immediately on typing_stop.       */}
      <TypingIndicator typingUsers={typingUsers[conversationId] ?? {}} />

      {/* ── Message input ──────────────────────────────────────────────────────*/}
      <MessageInput conversationId={conversationId} onTyping={sendTyping} onStopTyping={sendStopTyping} />
    </div>
  );
}

// ─── TypingIndicator ──────────────────────────────────────────────────────────
// Renders "Alice is typing…" (or "Alice and Bob are typing…") between the
// message list and the input bar.
//
// typingUsers is a Record<userId, displayName> for users currently typing.
// Populated on typing_start, cleared immediately on typing_stop (10s safety fallback).
// Renders nothing when the map is empty.

interface TypingIndicatorProps {
  typingUsers: Record<number, string>;
}

function TypingIndicator({ typingUsers }: TypingIndicatorProps) {
  const names = Object.values(typingUsers);
  if (names.length === 0) return null;

  let label: string;
  if (names.length === 1) {
    label = `${names[0]} is typing…`;
  } else if (names.length === 2) {
    label = `${names[0]} and ${names[1]} are typing…`;
  } else {
    label = "Several people are typing…";
  }

  return (
    <div className="flex items-center gap-2 px-4 py-1">
      {/* Animated dot trio — standard typing indicator pattern */}
      <span className="flex gap-0.5" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="bg-muted inline-block h-1.5 w-1.5 rounded-full"
            style={{ animation: `typing-dot 1.2s ${i * 0.2}s ease-in-out infinite` }}
          />
        ))}
      </span>
      <p className="text-muted text-xs">{label}</p>
    </div>
  );
}
