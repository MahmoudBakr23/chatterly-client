// ─── Messages service ─────────────────────────────────────────────────────────
// All API calls for the /messages resource, scoped under /conversations/:id.
// Components never call axios directly — they go through this service.
//
// Backend connection:
//   Rails controller: app/controllers/api/v1/messages_controller.rb
//   Blueprint:        app/blueprints/message_blueprint.rb
//   Routes:           GET  /api/v1/conversations/:conversation_id/messages → index
//                     POST /api/v1/conversations/:conversation_id/messages → create
//
// Scalability notes:
//   Messages use cursor-based pagination (page param) to avoid loading the entire
//   history upfront. The store's prependMessages() action handles inserting older
//   pages at the top of the list. Initial page size matches the backend default (30).
//   On scroll-to-top, the MessageThread component fetches the next page.

import api from "@/lib/axios";
import type { ApiSuccess, Message } from "@/types";

// Shape returned by the messages index endpoint.
// The backend wraps the array plus pagination metadata.
export interface MessagesPage {
  messages: Message[];
  // null means there are no more pages to load.
  next_cursor: number | null;
}

// ─── getMessages() ────────────────────────────────────────────────────────────
// Fetches a page of messages for the given conversation, newest-first.
// The UI reverses the order for display (oldest at top, newest at bottom).
//
// cursor: the id of the oldest message currently loaded — pass to get the next
//         (older) page. Omit for the first (most-recent) page.
export async function getMessages(conversationId: number, cursor?: number): Promise<MessagesPage> {
  const params: Record<string, number> = {};
  if (cursor !== undefined) params.cursor = cursor;

  const response = await api.get<ApiSuccess<MessagesPage>>(
    `/api/v1/conversations/${conversationId}/messages`,
    { params },
  );
  return response.data.data;
}

// ─── sendMessage() ────────────────────────────────────────────────────────────
// Creates a new text message in the given conversation.
// POST /api/v1/conversations/:id/messages → Rails broadcasts it via ConversationChannel,
// so all subscribers receive the message via WebSocket in addition to this HTTP response.
// We add the message to the store from the Action Cable broadcast (not the HTTP response)
// to avoid duplicates — the broadcast arrives for all clients, including the sender.
export async function sendMessage(conversationId: number, content: string): Promise<Message> {
  const response = await api.post<ApiSuccess<Message>>(
    `/api/v1/conversations/${conversationId}/messages`,
    { content, message_type: "text" },
  );
  return response.data.data;
}
