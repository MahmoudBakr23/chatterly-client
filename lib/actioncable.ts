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

let consumer: Consumer | null = null;

// getCableConsumer() returns the shared consumer, creating it lazily on first call.
// Lazy creation is important because this module is imported server-side too
// (e.g. by the store during SSR), and WebSocket APIs don't exist in Node.js.
// The typeof window check ensures we only instantiate in the browser.
export function getCableConsumer(): Consumer | null {
  if (typeof window === "undefined") {
    // Server-side render: no WebSocket, return null.
    // Callers must guard against null before subscribing.
    return null;
  }

  if (!consumer) {
    // NEXT_PUBLIC_CABLE_URL is set per-environment:
    //   dev:  ws://localhost:3001/cable
    //   prod: wss://api.chatterly.app/cable
    //
    // The Action Cable protocol authenticates via the connection.rb file on the
    // backend, which reads current_user from the JWT sent in the WebSocket
    // handshake query param or cookie. We rely on the browser automatically
    // sending the auth cookie on the WebSocket upgrade request.
    const url = process.env.NEXT_PUBLIC_CABLE_URL ?? "ws://localhost:3001/cable";
    consumer = createConsumer(url);
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
  }
}
