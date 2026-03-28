"use client";

// ─── MessageItem ──────────────────────────────────────────────────────────────
// Renders a single message bubble in the thread.
//
// Design:
//   - Own messages: right-aligned purple bubble (accent color)
//   - Others: left-aligned, light surface bubble; avatar top-left near sender name
//   - Grouped messages (same sender <5 min apart): suppress avatar + name header,
//     tighten vertical spacing for a compact back-and-forth look
//   - Bubbles use rounded-xl (20px) for a modern chat-app aesthetic
//
// Backend connection:
//   Receives Message (MessageBlueprint default view):
//     user → UserBlueprint :public (no email)
//     reactions → ReactionBlueprint[] (bundled inline, no N+1)
//
// Scalability: groupReactions() runs per render — acceptable for <20 reactions.

import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";
import { formatMessageTime } from "@/lib/utils";
import type { Message } from "@/types";

interface MessageItemProps {
  message: Message;
  isOwn: boolean;
  isGrouped?: boolean;
}

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
    <div
      className={cn(
        "animate-message-in flex items-start gap-2",
        isOwn ? "flex-row-reverse" : "flex-row",
        isGrouped ? "pt-0.5" : "pt-3",
      )}
    >
      {/* ── Avatar (or fixed-width spacer for grouped) ────────────────────────
          self-start keeps the avatar aligned to the top of the bubble column,
          next to the sender name — not bottom-aligned with the bubble content. */}
      {!isOwn && (
        <div className="w-7 flex-shrink-0 self-start pt-0.5">
          {!isGrouped && <UserAvatar user={message.user} size="sm" />}
        </div>
      )}

      {/* ── Bubble + meta ─────────────────────────────────────────────────────*/}
      <div className={cn("flex max-w-[72%] flex-col gap-1", isOwn && "items-end")}>
        {/* Sender name + timestamp — hidden for grouped messages */}
        {!isGrouped && (
          <div
            className={cn(
              "text-muted flex items-baseline gap-2 text-xs",
              isOwn ? "flex-row-reverse" : "flex-row",
            )}
          >
            {!isOwn && (
              <span className="text-foreground font-semibold">{message.user.display_name || message.user.username}</span>
            )}
            <span className="text-muted">{timeLabel}</span>
            {message.edited_at && <span className="italic opacity-70">(edited)</span>}
          </div>
        )}

        {/* Message bubble */}
        <div
          title={isGrouped ? timeLabel : undefined}
          className={cn(
            "rounded-xl px-3.5 py-2 text-sm leading-relaxed",
            isOwn
              ? "bg-accent text-accent-foreground rounded-tr-sm"
              : "bg-surface-muted text-foreground rounded-tl-sm",
          )}
        >
          {message.content}
        </div>

        {/* Reaction pills */}
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
