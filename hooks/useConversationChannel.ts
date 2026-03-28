"use client";

// ─── useConversationChannel ───────────────────────────────────────────────────
// Subscribes to the Rails ConversationChannel for a specific conversation and
// pipes all broadcast events into the conversations store.
//
// Backend connection:
//   Channel:   app/channels/conversation_channel.rb
//   Stream:    "conversation_<conversationId>"
//   Events:    new_message | message_edited | message_deleted |
//              reaction_added | reaction_removed
//
// Lifecycle:
//   - Subscription is created on mount (when conversationId is set).
//   - Returns a cleanup function that unsubscribes on unmount or conversationId change.
//   - We subscribe only after the user is authenticated (token present in auth store).
//     Subscribing before auth would get rejected by ApplicationCable::Connection#connect.
//
// Scalability notes:
//   One subscription per open conversation tab. If the user opens multiple tabs,
//   each maintains its own WebSocket connection and subscription — Rails broadcasts
//   to all of them independently via Redis pub/sub.

import { useEffect } from "react";
import { getCableConsumer } from "@/lib/actioncable";
import { useAuthStore } from "@/store/auth.store";
import { useConversationsStore } from "@/store/conversations.store";
import type { ConversationChannelEvent } from "@/types";

export function useConversationChannel(conversationId: number | null): void {
  const token = useAuthStore((state) => state.token);
  const { addMessage, updateMessage, removeMessage, addReaction, removeReaction } =
    useConversationsStore();

  useEffect(() => {
    // Guard: don't subscribe without a conversation or without auth.
    // The token check prevents subscribing during the brief hydration window where
    // the store is empty — the channel would be rejected server-side anyway.
    if (!conversationId || !token) return;

    const consumer = getCableConsumer();
    if (!consumer) return; // SSR guard — consumer is null on the server

    const subscription = consumer.subscriptions.create(
      // Rails ConversationChannel expects { conversation_id: number } as channel params.
      // The channel uses this to authorize access (member check) and set up the stream.
      { channel: "ConversationChannel", conversation_id: conversationId },
      {
        // received() is called for every message broadcast on this stream.
        // We discriminate on `type` (a union tag) and call the matching store action.
        received(data: ConversationChannelEvent) {
          switch (data.type) {
            case "new_message":
              addMessage(conversationId, data.message);
              break;

            case "message_edited":
              updateMessage(conversationId, data.message);
              break;

            case "message_deleted":
              removeMessage(conversationId, data.message_id);
              break;

            case "reaction_added":
              addReaction(conversationId, data.reaction);
              break;

            case "reaction_removed":
              removeReaction(conversationId, data.reaction_id, data.message_id);
              break;
          }
        },
      },
    );

    // Cleanup: unsubscribe when the component unmounts or conversationId changes.
    // This stops the stream and allows Rails to clean up the subscription server-side.
    return () => {
      subscription.unsubscribe();
    };
  }, [conversationId, token]); // eslint-disable-line react-hooks/exhaustive-deps
}
