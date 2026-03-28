"use client";

// ─── ConversationList ─────────────────────────────────────────────────────────
// The scrollable conversation list inside the sidebar.
// Fetches all conversations on mount and renders them as ConversationItem rows.
//
// Backend connection:
//   getConversations() → GET /api/v1/conversations (:with_members view)
//   Returns ConversationWithMembers[] so each row can render an avatar and
//   a presence dot for DMs without a second request.
//
// onNewConversation: callback from the layout to open the NewConversationModal,
//   used both by the header compose button and the empty-state CTA here.

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { MessageCirclePlus } from "lucide-react";
import { useConversationsStore } from "@/store/conversations.store";
import { useAuthStore } from "@/store/auth.store";
import { getConversations } from "@/services/conversations.service";
import { ConversationItem } from "@/components/chat/ConversationItem";
import { Spinner } from "@/components/ui/spinner";

interface ConversationListProps {
  onNewConversation: () => void;
}

export function ConversationList({ onNewConversation }: ConversationListProps) {
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
      .catch(() => {
        toast.error("Failed to load conversations. Please refresh.");
      })
      .finally(() => setLoadingConversations(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoadingConversations) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner size="sm" className="text-muted" />
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="bg-accent-muted flex h-12 w-12 items-center justify-center rounded-full">
          <MessageCirclePlus size={22} className="text-accent" />
        </div>
        <div>
          <p className="text-foreground text-sm font-medium">No conversations yet</p>
          <p className="text-muted mt-0.5 text-xs">Start a new chat or create a group.</p>
        </div>
        <button
          onClick={onNewConversation}
          className="bg-accent text-accent-foreground hover:bg-accent-hover mt-1 rounded-md px-4 py-2 text-xs font-medium transition-colors"
        >
          Start a conversation
        </button>
      </div>
    );
  }

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
