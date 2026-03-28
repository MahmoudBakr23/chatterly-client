// ─── Conversations service ────────────────────────────────────────────────────
// All API calls for the /conversations resource.
// Components never call axios directly — they go through this service.
//
// Backend connection:
//   Rails controller: app/controllers/api/v1/conversations_controller.rb
//   Blueprint:        app/blueprints/conversation_blueprint.rb
//   Routes:           GET  /api/v1/conversations          → index (:with_members view)
//                     GET  /api/v1/conversations/:id      → show (:with_members view)
//                     POST /api/v1/conversations          → create
//
// Scalability notes:
//   The index endpoint returns all conversations the current user is a member of.
//   For large conversation counts a cursor-based pagination query param would be
//   added here (?cursor=<id>&limit=20). Not needed until Phase 6.

import api from "@/lib/axios";
import type { ApiSuccess, ConversationWithMembers } from "@/types";

// ─── getConversations() ───────────────────────────────────────────────────────
// Fetches the list of conversations the current user belongs to.
// Returns the ":with_members" blueprint view so the sidebar can render presence
// dots for DMs without a second request per conversation.
// Backend: ConversationsController#index renders ConversationBlueprint
// with view: :with_members.
export async function getConversations(): Promise<ConversationWithMembers[]> {
  const response = await api.get<ApiSuccess<ConversationWithMembers[]>>("/api/v1/conversations");
  return response.data.data;
}

// ─── getConversation() ───────────────────────────────────────────────────────
// Fetches a single conversation with its full member list.
// Returns the ":with_members" blueprint view.
// Called when opening a conversation to render member avatars in the header.
export async function getConversation(id: number): Promise<ConversationWithMembers> {
  const response = await api.get<ApiSuccess<ConversationWithMembers>>(
    `/api/v1/conversations/${id}`,
  );
  return response.data.data;
}

// ─── createDirectConversation() ──────────────────────────────────────────────
// Creates a new 1-on-1 direct conversation with the given user.
// POST /api/v1/conversations — Rails returns existing DM if one already exists
// (deduplication happens at the DB level via the unique index on members).
// Rails wrap_parameters automatically wraps top-level keys into { conversation: {} }.
export async function createDirectConversation(userId: number): Promise<ConversationWithMembers> {
  const response = await api.post<ApiSuccess<ConversationWithMembers>>("/api/v1/conversations", {
    conversation_type: "direct",
    member_ids: [userId],
  });
  return response.data.data;
}

// ─── createGroupConversation() ───────────────────────────────────────────────
// Creates a named group conversation with multiple members.
// POST /api/v1/conversations — wrap_parameters handles the { conversation: {} } wrapping.
// The creator is always added as an admin member by the Rails controller.
export async function createGroupConversation(
  name: string,
  memberIds: number[],
): Promise<ConversationWithMembers> {
  const response = await api.post<ApiSuccess<ConversationWithMembers>>("/api/v1/conversations", {
    name,
    conversation_type: "group",
    member_ids: memberIds,
  });
  return response.data.data;
}
