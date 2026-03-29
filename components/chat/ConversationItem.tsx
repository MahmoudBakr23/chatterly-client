"use client";

// ─── ConversationItem ─────────────────────────────────────────────────────────
// A single row in the sidebar conversation list.
//
// DMs:    shows the other person's UserAvatar + display name + presence dot.
// Groups: shows a colored group icon + group name + member count.
//
// Backend connection:
//   Receives ConversationWithMembers — members array lets us find the other
//   user in a DM and render their avatar without a second request.
//   Presence status is read live from the presence store (PresenceChannel).
//
// Active state uses the sidebar-active background + accent text so selected
// conversations stand out clearly from the purple-tinted sidebar.

import Link from "next/link";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/ui/user-avatar";
import { PresenceDot } from "@/components/ui/PresenceDot";
import type { ConversationWithMembers } from "@/types";

interface ConversationItemProps {
  conversation: ConversationWithMembers;
  isActive: boolean;
  currentUserId: number;
}

export function ConversationItem({ conversation, isActive, currentUserId }: ConversationItemProps) {
  const isDirect = conversation.conversation_type === "direct";

  // For DMs: find the other member (not the current user)
  const otherMember = isDirect
    ? conversation.members.find((m) => m.id !== currentUserId)
    : null;

  const label =
    otherMember?.display_name ??
    otherMember?.username ??
    conversation.name ??
    (isDirect ? "Direct Message" : "Group Chat");

  return (
    <Link
      href={`/conversations/${conversation.id}`}
      className={cn(
        "flex items-center gap-3 rounded-md px-2.5 py-2 transition-colors",
        isActive
          ? "bg-sidebar-active text-accent"
          : "hover:bg-sidebar-hover text-foreground",
      )}
    >
      {/* ── Avatar ─────────────────────────────────────────────────────────── */}
      <div className="relative flex-shrink-0">
        {isDirect && otherMember ? (
          // DM: show the other person's actual avatar
          <UserAvatar user={otherMember} size="md" />
        ) : (
          // Group: colored circle with a group icon
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full",
              isActive
                ? "bg-accent text-accent-foreground"
                : "bg-accent-muted text-accent",
            )}
          >
            <Users size={15} />
          </div>
        )}

        {/* Presence dot — only for DMs */}
        {isDirect && otherMember && (
          <PresenceDot
            userId={otherMember.id}
            size="sm"
            className="absolute -right-0.5 -bottom-0.5"
          />
        )}
      </div>

      {/* ── Label + meta ─────────────────────────────────────────────────── */}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-sm font-medium",
            isActive ? "text-accent" : "text-foreground",
          )}
        >
          {label}
        </p>
        {!isDirect && (
          <p className={cn("text-xs", isActive ? "text-accent/70" : "text-muted")}>
            {conversation.member_count} members
          </p>
        )}
      </div>
    </Link>
  );
}
