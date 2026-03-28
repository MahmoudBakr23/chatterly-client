"use client";

// ─── MessageItem ──────────────────────────────────────────────────────────────
// Renders a single message row in the thread.
// Shows the sender's avatar, display name, timestamp, message body, and reactions.
//
// Backend connection:
//   Receives a Message (MessageBlueprint default view) which nests:
//     - user: UserBlueprint :public (no email)
//     - reactions: ReactionBlueprint[] bundled inline to avoid N+1 fetches
//
// Scalability notes:
//   - Avatar is rendered via UserAvatar (handles missing avatar_url with initials fallback).
//   - Timestamps use Intl.DateTimeFormat — no external date library needed.
//   - Reactions are displayed as emoji + count groups. Clicking a reaction
//     is a Phase 3 concern (requires sendReaction / removeReaction service calls).
//   - Message grouping (consecutive messages from same sender shown without
//     repeating the avatar/name) is a Phase 3 polish item.

import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";
import type { Message } from "@/types";

interface MessageItemProps {
  message: Message;
  // isOwn: true when the message was sent by the currently logged-in user.
  // Flips the layout to right-align the bubble (iMessage style).
  isOwn: boolean;
}

// Format an ISO timestamp into a human-readable time string.
// We use the user's local timezone automatically via Intl.
function formatTime(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

// Group reactions by emoji and count them.
// e.g. [{ emoji: "👍" }, { emoji: "👍" }, { emoji: "❤️" }] → [{ emoji: "👍", count: 2 }, ...]
function groupReactions(reactions: Message["reactions"]): { emoji: string; count: number }[] {
  const counts: Record<string, number> = {};
  for (const r of reactions) {
    counts[r.emoji] = (counts[r.emoji] ?? 0) + 1;
  }
  return Object.entries(counts).map(([emoji, count]) => ({ emoji, count }));
}

export function MessageItem({ message, isOwn }: MessageItemProps) {
  const grouped = groupReactions(message.reactions);

  return (
    <div className={cn("flex items-end gap-2", isOwn ? "flex-row-reverse" : "flex-row")}>
      {/* ── Avatar (hidden for own messages — saves horizontal space) ────────── */}
      {!isOwn && (
        <div className="flex-shrink-0 self-end">
          <UserAvatar user={message.user} size="sm" />
        </div>
      )}

      {/* ── Bubble + meta ─────────────────────────────────────────────────────── */}
      <div className={cn("flex max-w-[70%] flex-col gap-1", isOwn && "items-end")}>
        {/* Sender name + timestamp (shown above the bubble) */}
        <div
          className={cn(
            "text-muted flex items-baseline gap-2 text-xs",
            isOwn ? "flex-row-reverse" : "flex-row",
          )}
        >
          {!isOwn && (
            <span className="text-foreground font-medium">{message.user.display_name}</span>
          )}
          <span>{formatTime(message.created_at)}</span>
          {message.edited_at && <span className="italic">(edited)</span>}
        </div>

        {/* Message bubble */}
        <div
          className={cn(
            "rounded-[var(--radius-md)] px-3 py-2 text-sm leading-relaxed",
            isOwn ? "bg-accent text-accent-foreground" : "bg-surface-muted text-foreground",
          )}
        >
          {message.content}
        </div>

        {/* Reaction pills (only rendered if there are reactions) */}
        {grouped.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {grouped.map(({ emoji, count }) => (
              <span
                key={emoji}
                className="border-border bg-surface flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
              >
                {emoji}
                <span className="text-muted">{count}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
