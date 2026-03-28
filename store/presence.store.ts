"use client";

// ─── Presence store ───────────────────────────────────────────────────────────
// Tracks which user IDs are currently online.
// Kept separate from conversations.store.ts so components that only render
// a presence dot can subscribe narrowly without re-rendering on every message.
//
// Backend connection:
//   Populated by usePresence hook → PresenceChannel broadcasts on stream "presence".
//   Event shape: { user_id, username, status: "online" | "offline" }
//   Source: app/channels/presence_channel.rb
//
// Scalability notes:
//   Uses a plain object as a set (Record<number, true>) rather than a JS Set
//   because Zustand's shallow equality check works correctly with plain objects —
//   Set mutations are not detected by reference equality.

import { create } from "zustand";

interface PresenceState {
  // Keys are user IDs; presence means the key exists (value is always true).
  onlineUserIds: Record<number, true>;

  // Called by usePresence when "online" event arrives
  setOnline: (userId: number) => void;

  // Called by usePresence when "offline" event arrives
  setOffline: (userId: number) => void;

  // Helper: returns true if the given userId is in the online map
  isOnline: (userId: number) => boolean;
}

export const usePresenceStore = create<PresenceState>()((set, get) => ({
  onlineUserIds: {},

  setOnline: (userId) =>
    set((state) => ({
      onlineUserIds: { ...state.onlineUserIds, [userId]: true },
    })),

  setOffline: (userId) =>
    set((state) => {
      // Spread into a new object then delete the key — avoids an unused-var
      // lint error from destructuring while still producing a new reference.
      const next = { ...state.onlineUserIds };
      delete next[userId];
      return { onlineUserIds: next };
    }),

  // isOnline reads directly from the current state without subscribing.
  // Components should subscribe via usePresenceStore(state => state.isOnline(id))
  // so they re-render automatically when the user's status changes.
  isOnline: (userId) => userId in get().onlineUserIds,
}));
