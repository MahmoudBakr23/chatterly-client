"use client";

// ─── UserAvatar ───────────────────────────────────────────────────────────────
// Renders a user's avatar image, falling back to initials when avatar_url is null.
// Used in conversation lists and message headers (Phase 2+).
//
// Backend connection: avatar_url comes from UserBlueprint default view.
// If null, the backend has no avatar for this user yet.
//
// Perf note: images are lazy-loaded by default (browser default for img).

import type { User } from "@/types";

interface UserAvatarProps {
  user: User;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "h-7 w-7 text-xs",
  md: "h-9 w-9 text-sm",
  lg: "h-12 w-12 text-base",
};

export function UserAvatar({ user, size = "md" }: UserAvatarProps) {
  const sizeClass = sizeClasses[size];

  if (user.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt={user.display_name}
        className={`${sizeClass} rounded-full object-cover`}
      />
    );
  }

  // Fallback: first letter of display_name
  return (
    <div
      className={`${sizeClass} bg-surface-muted text-muted flex items-center justify-center rounded-full font-medium`}
    >
      {(user.display_name ?? user.username ?? "?").charAt(0).toUpperCase()}
    </div>
  );
}
