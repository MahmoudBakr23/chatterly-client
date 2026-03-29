"use client";

// ─── usePresence ──────────────────────────────────────────────────────────────
// Subscribes to the Rails PresenceChannel and keeps the presence store in sync.
// Also fires a ping every 30 seconds to renew the Redis TTL key that marks the
// current user as online.
//
// Backend connection:
//   Channel:  app/channels/presence_channel.rb
//   Stream:   "presence" (global — all users broadcast to the same stream)
//   Events:   { user_id, username, status: "online" | "offline" }
//   Actions:  ping() → renews Redis TTL "presence:<user_id>" (35s)
//
// Lifecycle:
//   - Subscribe on mount (after auth — guarded by token check).
//   - Ping every 30s to stay online (backend TTL is 35s; 30s gives 5s grace).
//   - Unsubscribe + clear interval on unmount (logout, hard refresh).
//
// Mount location: app/(app)/layout.tsx — once for the entire authenticated session.
// Do NOT mount per-conversation or per-component — one connection per tab.
//
// Scalability notes:
//   The ping interval is cleared on unmount so no ghost intervals accumulate
//   across React hot-reloads in development. Strict Mode double-invocation is
//   handled: the cleanup runs after the first effect, the second effect reconnects.

import { useEffect } from "react";
import { getCableConsumer } from "@/lib/actioncable";
import { useAuthStore } from "@/store/auth.store";
import { usePresenceStore } from "@/store/presence.store";
import type { PresenceChannelEvent } from "@/types";

// Ping interval in ms — must be shorter than the Redis TTL (35 000ms)
const PING_INTERVAL_MS = 30_000;

export function usePresence(): void {
  const token = useAuthStore((state) => state.token);
  const { setOnline, setOffline } = usePresenceStore();

  useEffect(() => {
    // Guard: only subscribe once authenticated.
    if (!token) return;

    const consumer = getCableConsumer(token);
    if (!consumer) return; // SSR guard

    const subscription = consumer.subscriptions.create(
      { channel: "PresenceChannel" },
      {
        // received() fires for every event on the "presence" stream (or direct transmit).
        received(data: PresenceChannelEvent) {
          // initial_presence: backend transmit()s the current Redis roster directly
          // to this new subscriber so the store is populated immediately on page load,
          // without waiting up to 30s for other users' next ping broadcast.
          if ("type" in data && data.type === "initial_presence") {
            data.online_user_ids.forEach((id) => setOnline(id));
            return;
          }
          // Normal status broadcast: single user went online or offline.
          if ("status" in data) {
            if (data.status === "online") {
              setOnline(data.user_id);
            } else {
              setOffline(data.user_id);
            }
          }
        },
      },
    );

    // Ping every 30s to renew the backend Redis TTL.
    // subscription.perform() sends a WebSocket action to the channel method.
    const pingInterval = setInterval(() => {
      subscription.perform("ping");
    }, PING_INTERVAL_MS);

    return () => {
      clearInterval(pingInterval);
      subscription.unsubscribe();
    };
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
}
