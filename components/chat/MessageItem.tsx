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
//   - Call messages: centered pill row (Messenger-style), no bubble, no alignment
//
// Backend connection:
//   Receives Message (MessageBlueprint default view):
//     user → UserBlueprint :public (no email)
//     reactions → ReactionBlueprint[] (bundled inline, no N+1)
//     call_session → CallSessionSummary (non-null only when message_type === "call")
//
// Scalability: groupReactions() runs per render — acceptable for <20 reactions.

import { Phone, Video } from "lucide-react";
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";
import { formatMessageTime } from "@/lib/utils";
import type { Message, CallSessionSummary } from "@/types";

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
  // Call messages render as a centered system row — no bubble, no alignment side.
  // This mirrors the Messenger/Instagram call log style.
  if (message.message_type === "call" && message.call_session) {
    return (
      <CallLogRow
        callSession={message.call_session}
        senderName={message.user.display_name || message.user.username}
        isOwn={isOwn}
        createdAt={message.created_at}
      />
    );
  }

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

// ─── CallLogRow ───────────────────────────────────────────────────────────────
// Messenger-style centered call log — replaces the normal bubble for call messages.
//
// Layout: a centered pill showing call type icon + text summary + timestamp,
// with a small direction label below ("You called" / "[Name] called").
//
// Status display logic:
//   ended + duration  → "Audio call · 2 min 30 sec"
//   ended (no answer) → "Audio call"
//   declined          → "Audio call · Declined"
//   missed            → "Audio call · No answer"
//
// Backend: call_session comes from MessageBlueprint's call_session field.
// initiator_id is not needed here — isOwn (derived from message.user.id) already
// tells us who called.

interface CallLogRowProps {
  callSession: CallSessionSummary;
  senderName: string;
  isOwn: boolean;
  createdAt: string;
}

function CallLogRow({ callSession, senderName, isOwn, createdAt }: CallLogRowProps) {
  const isVideo = callSession.call_type === "video";
  const Icon = isVideo ? Video : Phone;
  const typeLabel = isVideo ? "Video call" : "Audio call";

  let statusLabel = "";
  if (callSession.status === "declined") statusLabel = "Declined";
  else if (callSession.status === "missed") statusLabel = "No answer";
  else if (callSession.status === "ended" && callSession.duration != null) {
    statusLabel = formatDuration(callSession.duration);
  }

  const summaryText = statusLabel ? `${typeLabel} · ${statusLabel}` : typeLabel;
  const directionLabel = isOwn ? "You called" : `${senderName} called`;
  const timeLabel = formatMessageTime(createdAt);

  return (
    <div className="flex flex-col items-center gap-0.5 py-2">
      {/* Pill row: icon + summary + timestamp */}
      <div className="text-muted flex items-center gap-1.5 rounded-full bg-transparent px-3 py-1 text-xs">
        <Icon size={12} className="flex-shrink-0" />
        <span>{summaryText}</span>
        <span className="opacity-50">·</span>
        <span className="opacity-50">{timeLabel}</span>
      </div>
      {/* Direction label */}
      <p className="text-muted text-xs opacity-50">{directionLabel}</p>
    </div>
  );
}

// ─── formatDuration ───────────────────────────────────────────────────────────
// Converts seconds to a human-readable string for call duration display.
// e.g. 90 → "1 min 30 sec", 120 → "2 min", 45 → "45 sec"

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} sec`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m} min ${s} sec` : `${m} min`;
}
