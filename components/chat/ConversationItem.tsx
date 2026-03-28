"use client";

// ─── ConversationItem ─────────────────────────────────────────────────────────
// A single row in the sidebar conversation list.
// Renders the conversation name (or the other member's display_name for DMs),
// a member count badge for group conversations, and highlights when active.
//
// Backend connection:
//   Receives a Conversation (default blueprint view) — no members array.
//   For DM display name resolution we receive the currentUser from the auth store
//   to identify "the other person" — but the default view only has name/type,
//   not the full member list. For now, DMs without a name show "Direct Message".
//   Phase 3 will enrich the sidebar with the other user's display_name by using
//   the ConversationWithMembers shape once we have a user-search / contact list.
//
// Scalability notes:
//   This component is a pure presentational row — no data fetching.
//   Clicks are handled via Next.js Link for client-side navigation (no page reload).

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/types";

interface ConversationItemProps {
  conversation: Conversation;
  // isActive: true when this conversation's id matches the current route param
  isActive: boolean;
}

export function ConversationItem({ conversation, isActive }: ConversationItemProps) {
  // Derive the display label:
  //   - Group conversations use the stored name (or "Group Chat" fallback)
  //   - Direct conversations use name if set, otherwise a generic label
  const label =
    conversation.name ??
    (conversation.conversation_type === "direct" ? "Direct Message" : "Group Chat");

  return (
    <Link
      href={`/conversations/${conversation.id}`}
      // Prefetch on hover (Next.js default for Link) — fast navigation in the sidebar.
      className={cn(
        "flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 transition-colors",
        "hover:bg-surface-muted",
        isActive && "bg-accent-muted text-accent",
      )}
    >
      {/* ── Conversation icon ───────────────────────────────────────────────── */}
      <div
        className={cn(
          "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-medium",
          isActive ? "bg-accent text-accent-foreground" : "bg-surface-muted text-muted",
        )}
        aria-hidden="true"
      >
        {conversation.conversation_type === "direct" ? (
          // Person icon for DMs
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
          </svg>
        ) : (
          // Group hash icon for group conversations
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        )}
      </div>

      {/* ── Label + meta ─────────────────────────────────────────────────────── */}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-sm font-medium",
            isActive ? "text-accent" : "text-foreground",
          )}
        >
          {label}
        </p>
        {conversation.conversation_type === "group" && (
          <p className="text-muted text-xs">{conversation.member_count} members</p>
        )}
      </div>
    </Link>
  );
}
