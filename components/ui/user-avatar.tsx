"use client";

// ─── UserAvatar ───────────────────────────────────────────────────────────────
// Renders a user's avatar image with a deterministic color+initials fallback.
// The fallback is shown when avatar_url is null OR when the image fails to load
// (broken URL, 404, network error, etc.).
//
// Backend connection: avatar_url comes from UserBlueprint default view.
//
// Color assignment: deterministic hash of username → one of 6 palette colors.
// This means the same user always gets the same color across sessions, which
// helps users quickly identify familiar contacts in the conversation list.

import { useState } from "react";
import type { User } from "@/types";

interface UserAvatarProps {
  user: Pick<User, "username" | "display_name" | "avatar_url">;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeClasses = {
  sm: "h-7 w-7 text-xs",
  md: "h-9 w-9 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-16 w-16 text-xl",
};

// Six purple-adjacent colors that complement the app's accent palette.
// Indices are chosen via a simple string hash to be deterministic per username.
const AVATAR_BG_COLORS = [
  "oklch(0.50 0.22 293)", // primary purple
  "oklch(0.52 0.18 258)", // violet
  "oklch(0.52 0.15 195)", // teal
  "oklch(0.52 0.18 145)", // green
  "oklch(0.52 0.20 60)",  // amber
  "oklch(0.52 0.20 15)",  // coral
];

function getAvatarColor(username: string): string {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = (hash << 5) - hash + username.charCodeAt(i);
    hash |= 0; // convert to 32-bit int
  }
  return AVATAR_BG_COLORS[Math.abs(hash) % AVATAR_BG_COLORS.length];
}

export function UserAvatar({ user, size = "md" }: UserAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const sizeClass = sizeClasses[size];

  const initials = (user.display_name ?? user.username ?? "?").charAt(0).toUpperCase();
  const bgColor = getAvatarColor(user.username ?? user.display_name ?? "?");

  if (user.avatar_url && !imgError) {
    return (
      <img
        src={user.avatar_url}
        alt={user.display_name ?? user.username}
        onError={() => setImgError(true)}
        className={`${sizeClass} rounded-full object-cover`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} flex items-center justify-center rounded-full font-semibold text-white`}
      style={{ backgroundColor: bgColor }}
      aria-label={user.display_name ?? user.username}
    >
      {initials}
    </div>
  );
}
