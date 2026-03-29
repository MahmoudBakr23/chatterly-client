"use client";

// ─── Conversations store ──────────────────────────────────────────────────────
// Manages all conversation and message state for the app.
// Split from auth.store.ts to keep each domain store focused and independently
// subscribable — components that only care about messages don't re-render on
// auth changes (and vice versa).
//
// What lives here:
//   - conversations: the sidebar list (fetched on app mount)
//   - messages: a map of conversationId → Message[] (loaded per conversation)
//   - activeConversationId: which thread is currently open
//   - loading flags for conversations list and per-conversation message pages
//   - mutation actions called by useConversationChannel when Action Cable events arrive
//
// Action Cable mutation flow:
//   WebSocket event → useConversationChannel hook → store action → re-render
//   This keeps the Action Cable logic in a hook (not a component), and the store
//   is the single source of truth — no local state in message components.

import { create } from "zustand";
import type { ConversationWithMembers, Message, Reaction } from "@/types";

interface ConversationsState {
  // ─── Conversation list ──────────────────────────────────────────────────────
  // ConversationWithMembers (not plain Conversation) so sidebar can derive
  // otherUserId for presence dots without a second fetch per conversation.
  conversations: ConversationWithMembers[];
  isLoadingConversations: boolean;

  // ─── Active conversation ────────────────────────────────────────────────────
  // The full conversation (with members) for the currently open thread.
  // null = no conversation selected (empty state).
  activeConversation: ConversationWithMembers | null;

  // ─── Messages ───────────────────────────────────────────────────────────────
  // Keyed by conversationId. Messages are stored oldest-first for rendering.
  // The service returns newest-first; the store's setMessages action reverses.
  messages: Record<number, Message[]>;
  // Tracks the pagination cursor per conversation — null means all pages loaded.
  nextCursors: Record<number, number | null>;
  isLoadingMessages: boolean;

  // ─── Actions ────────────────────────────────────────────────────────────────

  // Conversation list
  setConversations: (conversations: ConversationWithMembers[]) => void;
  setLoadingConversations: (value: boolean) => void;

  // Active conversation
  setActiveConversation: (conversation: ConversationWithMembers | null) => void;

  // Messages — initial load
  setMessages: (conversationId: number, messages: Message[], nextCursor: number | null) => void;
  // Messages — pagination (prepend older page above existing messages)
  prependMessages: (conversationId: number, messages: Message[], nextCursor: number | null) => void;
  setLoadingMessages: (value: boolean) => void;

  // Conversation list mutations
  // Called when a new conversation is created via the UI so it appears immediately.
  addConversation: (conversation: ConversationWithMembers) => void;

  // Action Cable mutation actions
  // Called by useConversationChannel when the backend broadcasts events.
  addMessage: (conversationId: number, message: Message) => void;
  updateMessage: (conversationId: number, message: Message) => void;
  removeMessage: (conversationId: number, messageId: number) => void;
  addReaction: (conversationId: number, reaction: Reaction) => void;
  removeReaction: (conversationId: number, reactionId: number, messageId: number) => void;

  // Typing indicators — keyed by conversationId → { userId: displayName }.
  // Set by useConversationChannel on typing_indicator events; auto-cleared after 3s.
  typingUsers: Record<number, Record<number, string>>;
  setTyping: (conversationId: number, userId: number, displayName: string) => void;
  clearTyping: (conversationId: number, userId: number) => void;
}

export const useConversationsStore = create<ConversationsState>()((set) => ({
  conversations: [],
  isLoadingConversations: false,
  activeConversation: null,
  messages: {},
  nextCursors: {},
  isLoadingMessages: false,
  typingUsers: {},

  // ─── Conversation list actions ──────────────────────────────────────────────

  setConversations: (conversations) => set({ conversations }),

  setLoadingConversations: (value) => set({ isLoadingConversations: value }),

  // ─── Active conversation actions ────────────────────────────────────────────

  setActiveConversation: (conversation) => set({ activeConversation: conversation }),

  // ─── Message actions ────────────────────────────────────────────────────────

  // Initial load: replace any existing messages for this conversation.
  // The controller returns messages oldest-first (page.reverse in messages_controller.rb),
  // so we store them as-is — no client-side reversal needed.
  setMessages: (conversationId, messages, nextCursor) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: messages,
      },
      nextCursors: {
        ...state.nextCursors,
        [conversationId]: nextCursor,
      },
    })),

  // Pagination: insert older messages BEFORE the existing list (top of thread).
  // The controller returns them oldest-first within the page; prepend as-is.
  prependMessages: (conversationId, messages, nextCursor) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: [...messages, ...(state.messages[conversationId] ?? [])],
      },
      nextCursors: {
        ...state.nextCursors,
        [conversationId]: nextCursor,
      },
    })),

  setLoadingMessages: (value) => set({ isLoadingMessages: value }),

  // ─── Conversation list mutations ───────────────────────────────────────────

  // Prepend a newly created conversation at the top of the sidebar list.
  // Dedup guard prevents double-adding if the list was already populated.
  addConversation: (conversation) =>
    set((state) => {
      if (state.conversations.some((c) => c.id === conversation.id)) return state;
      return { conversations: [conversation, ...state.conversations] };
    }),

  // ─── Action Cable mutation actions ─────────────────────────────────────────

  // New message broadcast: append to the end of the list (newest at bottom).
  // Also bumps the conversation to the top of the sidebar list (most-recent-first).
  // Dedup guard: in dev, React StrictMode double-invokes effects which can produce
  // two active WS subscriptions, both delivering the same broadcast. Skipping
  // already-present IDs prevents duplicate-key React errors.
  addMessage: (conversationId, message) =>
    set((state) => {
      const existing = state.messages[conversationId] ?? [];
      if (existing.some((m) => m.id === message.id)) return state;
      return {
        messages: {
          ...state.messages,
          [conversationId]: [...existing, message],
        },
        // Move the conversation with this id to the front of the sidebar list
        // so the most recently active conversation is always at the top.
        conversations: [
          ...state.conversations.filter((c) => c.id === conversationId),
          ...state.conversations.filter((c) => c.id !== conversationId),
        ],
      };
    }),

  // Edited message: replace the matching message object in-place.
  updateMessage: (conversationId, message) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: (state.messages[conversationId] ?? []).map((m) =>
          m.id === message.id ? message : m,
        ),
      },
    })),

  // Deleted message: remove from the list entirely.
  removeMessage: (conversationId, messageId) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: (state.messages[conversationId] ?? []).filter((m) => m.id !== messageId),
      },
    })),

  // Reaction added: append the reaction to the matching message.
  addReaction: (conversationId, reaction) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: (state.messages[conversationId] ?? []).map((m) =>
          m.id === reaction.message_id ? { ...m, reactions: [...m.reactions, reaction] } : m,
        ),
      },
    })),

  // Reaction removed: filter out the matching reaction by id.
  removeReaction: (conversationId, reactionId, messageId) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: (state.messages[conversationId] ?? []).map((m) =>
          m.id === messageId
            ? { ...m, reactions: m.reactions.filter((r) => r.id !== reactionId) }
            : m,
        ),
      },
    })),

  // Typing indicators — set/clear by useConversationChannel on typing_indicator events.
  setTyping: (conversationId, userId, displayName) =>
    set((state) => ({
      typingUsers: {
        ...state.typingUsers,
        [conversationId]: {
          ...(state.typingUsers[conversationId] ?? {}),
          [userId]: displayName,
        },
      },
    })),

  clearTyping: (conversationId, userId) =>
    set((state) => {
      const conv = { ...(state.typingUsers[conversationId] ?? {}) };
      delete conv[userId];
      return { typingUsers: { ...state.typingUsers, [conversationId]: conv } };
    }),
}));
