"use client";

// ─── ConversationItem ─────────────────────────────────────────────────────────
// A single row in the sidebar conversation list.
// Renders the conversation name (or the other member's display_name for DMs),
// a member count badge for group conversations, a presence dot for DMs,
// and highlights when active.
//
// Backend connection:
//   Receives a ConversationWithMembers — includes the members array so we can
//   derive the other user's display_name and id for presence dot rendering.
//   Presence status is read live from the presence store (populated by
//   usePresence → PresenceChannel), not from the Conversation object itself.
//
// Scalability notes:
//   Pure presentational row — no data fetching.
//   PresenceDot subscribes narrowly to its own user's status, avoiding full
//   re-renders when unrelated users change status.

import Link from "next/link";
import { cn } from "@/lib/utils";
import { PresenceDot } from "@/components/ui/PresenceDot";
import type { ConversationWithMembers } from "@/types";

interface ConversationItemProps {
  conversation: ConversationWithMembers;
  isActive: boolean;
  // The current user's id — used to identify the "other" member in a DM
  currentUserId: number;
}

export function ConversationItem({ conversation, isActive, currentUserId }: ConversationItemProps) {
  // For DMs: show the other member's display_name.
  // For groups: use the stored name or a fallback.
  const otherMember =
    conversation.conversation_type === "direct"
      ? conversation.members.find((m) => m.id !== currentUserId)
      : null;

  const label =
    otherMember?.display_name ??
    conversation.name ??
    (conversation.conversation_type === "direct" ? "Direct Message" : "Group Chat");

  return (
    <Link
      href={`/conversations/${conversation.id}`}
      className={cn(
        "flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 transition-colors",
        "hover:bg-surface-muted",
        isActive && "bg-accent-muted text-accent",
      )}
    >
      {/* ── Avatar / icon with presence dot ────────────────────────────────── */}
      <div className="relative flex-shrink-0">
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium",
            isActive ? "bg-accent text-accent-foreground" : "bg-surface-muted text-muted",
          )}
          aria-hidden="true"
        >
          {conversation.conversation_type === "direct" ? (
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

        {/* Presence dot — shown only for DMs where we know the other user's id */}
        {otherMember && (
          <PresenceDot
            userId={otherMember.id}
            size="sm"
            // Positioned at bottom-right of the avatar circle
            className="ring-surface absolute -right-0.5 -bottom-0.5 ring-2"
          />
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
