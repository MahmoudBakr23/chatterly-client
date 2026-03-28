import { createConsumer, type Consumer } from "@rails/actioncable";

// ─── Action Cable consumer ───────────────────────────────────────────────────
// The consumer is the single persistent WebSocket connection to chatterly-api's
// Action Cable server. It is shared across all channel subscriptions —
// one connection per browser tab, not one per channel.
//
// Backend: config/cable.yml uses Redis as the pub/sub adapter in production,
// so messages broadcast from any Rails process (web or Sidekiq) fan out to all
// connected clients. In development, async adapter is used (in-process).
//
// Singleton pattern: we keep one consumer instance for the lifetime of the page.
// Creating multiple consumers would open multiple WebSocket connections, wasting
// server resources and causing duplicate message delivery.
//
// Auth: connection.rb reads the JWT from the ?token= query param in the WS URL.
// We pass the token from the auth store into getCableConsumer() and embed it in
// the URL. If the token changes (e.g., re-login), the consumer is recreated so
// the new connection is authenticated under the correct user.
//
// HMR survival (dev only): Next.js Fast Refresh re-evaluates modules, which
// would reset module-level variables to null and orphan the live WebSocket.
// We persist the consumer reference on `window` so it survives module reloads.
// React StrictMode double-invokes effects; without this the singleton is reset
// between the cleanup and re-run, leaving the component with no subscription.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const win = typeof window !== "undefined" ? (window as any) : null;

let consumer: Consumer | null = win?.__cableConsumer ?? null;
let consumerToken: string | null = win?.__cableConsumerToken ?? null;

// getCableConsumer() returns the shared consumer, creating it lazily on first call.
// Lazy creation is important because this module is imported server-side too
// (e.g. by the store during SSR), and WebSocket APIs don't exist in Node.js.
// The typeof window check ensures we only instantiate in the browser.
//
// token: the JWT from useAuthStore — appended as ?token=<jwt> so connection.rb
// can authenticate the WebSocket handshake. Without it every WS is rejected.
export function getCableConsumer(token?: string): Consumer | null {
  if (typeof window === "undefined") {
    // Server-side render: no WebSocket, return null.
    // Callers must guard against null before subscribing.
    return null;
  }

  // If a new token is provided and differs from what the current consumer used,
  // disconnect and recreate — otherwise the WS would be authenticated as the
  // wrong user (or rejected entirely if the old consumer had no token).
  if (consumer && token && token !== consumerToken) {
    consumer.disconnect();
    consumer = null;
    consumerToken = null;
  }

  if (!consumer) {
    // NEXT_PUBLIC_CABLE_URL is set per-environment:
    //   dev:  ws://localhost:3001/cable
    //   prod: wss://api.chatterly.app/cable
    const base = process.env.NEXT_PUBLIC_CABLE_URL ?? "ws://localhost:3001/cable";
    const url = token ? `${base}?token=${encodeURIComponent(token)}` : base;
    consumer = createConsumer(url);
    consumerToken = token ?? null;
    // Persist on window so Fast Refresh module reloads pick up the live instance.
    if (win) {
      win.__cableConsumer = consumer;
      win.__cableConsumerToken = consumerToken;
    }
  }

  return consumer;
}

// disconnectCableConsumer() cleanly closes the WebSocket on logout.
// Calling consumer.disconnect() sends a close frame to the server, which
// triggers ApplicationCable::Connection#disconnect, cleans up presence keys in
// Redis, and stops streaming all channels for this connection.
export function disconnectCableConsumer(): void {
  if (consumer) {
    consumer.disconnect();
    consumer = null;
    consumerToken = null;
    if (win) {
      win.__cableConsumer = null;
      win.__cableConsumerToken = null;
    }
  }
}
