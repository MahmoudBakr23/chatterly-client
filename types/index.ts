// ─── Shared TypeScript types ────────────────────────────────────────────────
// These interfaces mirror the JSON shapes produced by chatterly-api's Blueprinter
// serializers. Keeping them in one file means any backend blueprint change has a
// single place to update on the frontend — prevents type drift from spreading
// across many components.
//
// Naming convention: match the Rails model names exactly (PascalCase) so that
// grep-ing the model name finds both backend and frontend definitions instantly.

// ─── User ───────────────────────────────────────────────────────────────────
// Matches UserBlueprint default view (no email) — used when rendering other users.
// Source: app/blueprints/user_blueprint.rb
export interface User {
  id: number;
  username: string;
  display_name: string;
  avatar_url: string | null;
  // Presence flag — backend reads a Redis TTL key ("presence:<id>") to derive this.
  // True while the user's WebSocket connection is alive. Used for online indicators.
  online: boolean;
}

// Full user — only returned by /users/me, login, and register responses.
// Matches UserBlueprint :with_email view.
export interface CurrentUser extends User {
  email: string;
  last_seen_at: string | null;
}

// ─── Conversation ───────────────────────────────────────────────────────────
// Matches ConversationBlueprint default view — used in the sidebar list.
// Source: app/blueprints/conversation_blueprint.rb
export interface Conversation {
  id: number;
  name: string | null;
  description: string | null;
  // "direct" (1-on-1) or "group" — controls how we render the conversation header
  // and whether we show group management controls.
  conversation_type: "direct" | "group";
  created_by_id: number;
  created_at: string;
  // Scalar — derived from conversation.members.count on the backend.
  // No N+1 because the controller eager-loads members before serializing.
  member_count: number;
}

// Extended view — returned by GET /conversations/:id and POST /conversations.
// Includes the full member list so we can render avatars without a second request.
// Matches ConversationBlueprint :with_members view.
export interface ConversationWithMembers extends Conversation {
  members: User[];
}

// ─── Message ────────────────────────────────────────────────────────────────
// Matches MessageBlueprint default view.
// Source: app/blueprints/message_blueprint.rb
export interface Message {
  id: number;
  content: string;
  // "text" | "image" | "file" — controls render strategy (future phases)
  message_type: "text" | "image" | "file";
  edited_at: string | null; // null means never edited
  created_at: string;
  parent_message_id: number | null; // thread support (future phase)
  // Nested user — rendered via UserBlueprint :public (no email).
  // Bundled here to avoid an extra request per message row (N+1 at API level).
  user: User;
  // Reactions bundled inline for the same reason — rendering message + reactions
  // in one shot is more efficient than lazy-loading each reaction list separately.
  reactions: Reaction[];
}

// ─── Reaction ───────────────────────────────────────────────────────────────
// Matches ReactionBlueprint default view.
// Source: app/blueprints/reaction_blueprint.rb
export interface Reaction {
  id: number;
  emoji: string; // e.g. "👍", "❤️"
  message_id: number;
  user_id: number;
}

// ─── CallSession ─────────────────────────────────────────────────────────────
// Matches CallSessionBlueprint default view.
// Source: app/blueprints/call_session_blueprint.rb
export interface CallSession {
  id: number;
  conversation_id: number;
  initiator_id: number;
  call_type: "audio" | "video";
  // Full status lifecycle matching the Rails CallSession enum:
  // calling (0) → no answer yet, ringing (1) → online recipient notified,
  // active (2) → someone joined, ended (3) → host ended,
  // declined (4) → callee rejected, missed (5) → no answer in 30s
  status: "calling" | "ringing" | "active" | "ended" | "declined" | "missed";
  created_at: string;
}

// Extended view — returned by GET /calls/active.
// Matches CallSessionBlueprint :with_participants view.
export interface CallSessionWithParticipants extends CallSession {
  started_at: string | null;
  participants: User[];
}

// ─── Action Cable event payloads ─────────────────────────────────────────────
// These are the WebSocket message shapes broadcast by each channel.
// Unlike HTTP responses, these are NOT going through Blueprinter — they are raw
// ActionCable.server.broadcast(...) calls, so we define their shape here manually.

// ConversationChannel broadcasts (stream: "conversation_<id>")
// The backend broadcasts a full Message object (via MessageBlueprint.render_as_hash)
// for new_message and message_edited events.
export type ConversationChannelEvent =
  | { type: "new_message"; message: Message }
  | { type: "message_edited"; message: Message }
  | { type: "message_deleted"; message_id: number }
  | { type: "reaction_added"; reaction: Reaction }
  | { type: "reaction_removed"; reaction_id: number; message_id: number };

// PresenceChannel broadcasts (stream: "presence")
// Broadcast by PresenceChannel#broadcast_status on every subscribe/unsubscribe.
// Source: app/channels/presence_channel.rb
// All connected clients receive this — used to update the online dot globally.
export interface PresenceChannelEvent {
  user_id: number;
  username: string;
  status: "online" | "offline";
}

// CallChannel broadcasts (stream: "calls_user_<id>")
// Each user gets their own personal stream — signals arrive only for you.
// Source: app/channels/call_channel.rb
//
// WebRTC signal payloads (passed opaquely through send_signal):
//   - SDP offer/answer: RTCSessionDescriptionInit { type: "offer"|"answer", sdp: string }
//   - ICE candidate:   { type: "ice_candidate", candidate: RTCIceCandidateInit }
export type WebRTCSignal =
  | RTCSessionDescriptionInit
  | { type: "ice_candidate"; candidate: RTCIceCandidateInit };

export type CallChannelEvent =
  | {
      type: "incoming_call";
      call_session_id: number;
      // Caller identity sent inline — avoids a round-trip to /users/:id
      caller: { id: number; username: string; display_name: string };
      call_type: "audio" | "video";
      conversation_id: number;
    }
  | {
      type: "call_accepted";
      call_session_id: number;
      accepted_by: { id: number; username: string };
    }
  | {
      type: "call_declined";
      call_session_id: number;
      declined_by: { id: number; username: string };
    }
  // Generic WebRTC signal forwarded by send_signal — discriminate on signal.type
  | {
      type: "signal";
      call_session_id: number;
      from_user_id: number;
      signal: WebRTCSignal;
    }
  | { type: "call_ended"; call_session_id: number }
  | { type: "participant_muted"; call_session_id: number; user_id: number; muted: boolean }
  | {
      type: "participant_camera_toggled";
      call_session_id: number;
      user_id: number;
      camera_off: boolean;
    };

// ─── API response wrappers ────────────────────────────────────────────────────
// Rails API controllers render { data: <blueprint_output> } for success responses.
// Errors render { errors: string[] } or { error: string }.
// Typing these generically saves us from casting on every service call.
export interface ApiSuccess<T> {
  data: T;
}

export interface ApiError {
  error?: string;
  errors?: string[];
}
