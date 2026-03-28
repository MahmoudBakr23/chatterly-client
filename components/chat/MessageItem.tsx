"use client";

// ─── MessageItem ──────────────────────────────────────────────────────────────
// Renders a single message bubble in the thread.
//
// Phase 5 additions:
//   - isGrouped prop: when the previous message is from the same sender within
//     5 minutes, we suppress the avatar and sender header to reduce visual noise.
//     The avatar area becomes a spacer so bubble alignment stays consistent.
//   - Relative timestamps via formatMessageTime() (lib/utils.ts).
//     Grouped messages show timestamp only as a title= tooltip to keep the
//     bubble compact; ungrouped messages show it in the header.
//   - animate-message-in CSS class: every bubble fades and slides up on mount.
//     0.18s is short enough to feel instant on initial list load.
//
// Backend connection:
//   Receives a Message (MessageBlueprint default view) which nests:
//     - user: UserBlueprint :public (no email)
//     - reactions: ReactionBlueprint[] bundled inline to avoid N+1 fetches
//
// Scalability notes:
//   - Avatar is rendered via UserAvatar (handles missing avatar_url with initials fallback).
//   - groupReactions() runs per render — acceptable for typical reaction counts (<20).
//     A useMemo would be premature here; add if profiling shows this as a bottleneck.

import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";
import { formatMessageTime } from "@/lib/utils";
import type { Message } from "@/types";

interface MessageItemProps {
  message: Message;
  // isOwn: true when the message belongs to the current user (right-aligned).
  isOwn: boolean;
  // isGrouped: true when the previous message in the list is from the same sender
  // within 5 minutes. Suppresses avatar + sender name for a cleaner thread.
  isGrouped?: boolean;
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

export function MessageItem({ message, isOwn, isGrouped = false }: MessageItemProps) {
  const grouped = groupReactions(message.reactions);
  const timeLabel = formatMessageTime(message.created_at);

  return (
    // animate-message-in: defined in globals.css — fade + slide-up on mount.
    // pt-0.5 on grouped messages tightens the gap between consecutive bubbles.
    <div
      className={cn(
        "animate-message-in flex items-end gap-2",
        isOwn ? "flex-row-reverse" : "flex-row",
        isGrouped ? "pt-0.5" : "pt-3",
      )}
    >
      {/* ── Avatar (or spacer to keep bubble alignment) ───────────────────────
          Grouped messages get a fixed-width spacer so their bubbles line up
          with the non-grouped message above. Own messages skip this area.    */}
      {!isOwn && (
        <div className="w-7 flex-shrink-0 self-end">
          {!isGrouped && <UserAvatar user={message.user} size="sm" />}
        </div>
      )}

      {/* ── Bubble + meta ─────────────────────────────────────────────────────── */}
      <div className={cn("flex max-w-[70%] flex-col gap-1", isOwn && "items-end")}>
        {/* Sender name + timestamp header — hidden for grouped messages */}
        {!isGrouped && (
          <div
            className={cn(
              "text-muted flex items-baseline gap-2 text-xs",
              isOwn ? "flex-row-reverse" : "flex-row",
            )}
          >
            {!isOwn && (
              <span className="text-foreground font-medium">{message.user.display_name}</span>
            )}
            <span>{timeLabel}</span>
            {message.edited_at && <span className="italic">(edited)</span>}
          </div>
        )}

        {/* Message bubble
            title= shows the full timestamp on hover for grouped messages where
            the header is suppressed.                                          */}
        <div
          title={isGrouped ? timeLabel : undefined}
          className={cn(
            "rounded-[var(--radius-md)] px-3 py-2 text-sm leading-relaxed",
            isOwn ? "bg-accent text-accent-foreground" : "bg-surface-muted text-foreground",
          )}
        >
          {message.content}
        </div>

        {/* Reaction pills — only rendered if there are reactions */}
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
