// ─── Users service ────────────────────────────────────────────────────────────
// API calls for the /users resource.
//
// Backend connection:
//   Rails controller: app/controllers/api/v1/users_controller.rb
//   Blueprint:        app/blueprints/user_blueprint.rb
//   Routes:           GET  /api/v1/users?search=<query>  → index (ILIKE search)
//                     GET  /api/v1/users/me              → me (current user with email)
//                     GET  /api/v1/users/:id             → show (public profile)
//                     PATCH /api/v1/users/:id            → update (self only)
//
// Response format:
//   UsersController renders UserBlueprint.render() directly — no { data: } wrapper.
//   This is different from ConversationsController which wraps in { data: }.

import api from "@/lib/axios";
import type { User, CurrentUser } from "@/types";

// ─── searchUsers() ────────────────────────────────────────────────────────────
// Searches users by username or display_name (case-insensitive ILIKE).
// Used in the NewConversationModal to find people to start chats with.
// Returns an empty array for blank queries to avoid unnecessary requests.
export async function searchUsers(query: string): Promise<User[]> {
  if (!query.trim()) return [];
  const { data } = await api.get<User[]>("/api/v1/users", {
    params: { search: query },
  });
  return data;
}

// ─── updateCurrentUser() ─────────────────────────────────────────────────────
// Updates the current user's display_name or avatar_url.
// PATCH /api/v1/users/:id — Pundit blocks editing other users.
// wrap_parameters automatically wraps in { user: { ... } } for UsersController.
export async function updateCurrentUser(
  userId: number,
  params: { display_name?: string; avatar_url?: string },
): Promise<CurrentUser> {
  const { data } = await api.patch<CurrentUser>(`/api/v1/users/${userId}`, params);
  return data;
}
