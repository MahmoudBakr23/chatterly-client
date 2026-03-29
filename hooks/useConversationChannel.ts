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

import { useEffect, useRef, useCallback } from "react";
import { getCableConsumer } from "@/lib/actioncable";
import { useAuthStore } from "@/store/auth.store";
import { useConversationsStore } from "@/store/conversations.store";
import { getMessages } from "@/services/messages.service";
import type { ConversationChannelEvent } from "@/types";
import type { Subscription } from "@rails/actioncable";

export function useConversationChannel(conversationId: number | null): {
  sendTyping: () => void;
  sendStopTyping: () => void;
} {
  const token = useAuthStore((state) => state.token);
  const currentUserId = useAuthStore((state) => state.user?.id);
  const { addMessage, updateMessage, removeMessage, addReaction, removeReaction, setTyping, clearTyping } =
    useConversationsStore();

  // Stable ref to the active subscription — lets sendTyping work without
  // being re-created on every render or re-added to effect deps.
  const subscriptionRef = useRef<Subscription | null>(null);

  // Per-user safety timeouts — if a typing_stop never arrives (e.g. browser crash,
  // tab closed mid-type), auto-clear the indicator after 10s. This is a fallback only;
  // the normal path is: receiver clears immediately on the typing_stop event.
  const typingTimeoutsRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  // Tracks whether we've connected at least once so we can distinguish the
  // initial connect from a reconnect in the connected() lifecycle callback.
  const hasConnectedRef = useRef(false);

  useEffect(() => {
    // Guard: don't subscribe without a conversation or without auth.
    // The token check prevents subscribing during the brief hydration window where
    // the store is empty — the channel would be rejected server-side anyway.
    if (!conversationId || !token) return;

    // Pass the token so the consumer URL includes ?token=<jwt>.
    // connection.rb reads this param during the WebSocket handshake.
    const consumer = getCableConsumer(token);
    if (!consumer) return; // SSR guard — consumer is null on the server

    const subscription = consumer.subscriptions.create(
      // Rails ConversationChannel expects { conversation_id: number } as channel params.
      // The channel uses this to authorize access (member check) and set up the stream.
      { channel: "ConversationChannel", conversation_id: conversationId },
      {
        // connected() fires on initial connect AND every reconnect after a drop.
        // On reconnect we re-fetch the latest message page to catch any broadcasts
        // that fired while the WebSocket was down (Action Cable is fire-and-forget —
        // messages sent during disconnection are permanently lost otherwise).
        // The addMessage dedup guard silently skips messages already in the store.
        connected() {
          if (hasConnectedRef.current) {
            getMessages(conversationId)
              .then((page) => {
                page.messages.forEach((msg) => addMessage(conversationId, msg));
              })
              .catch(() => {}); // non-critical — user can manually refresh
          }
          hasConnectedRef.current = true;
        },

        // received() is called for every message broadcast on this stream.
        // We discriminate on `type` (a union tag) and call the matching store action.
        received(data: ConversationChannelEvent) {
          switch (data.type) {
            case "new_message": {
              addMessage(conversationId, data.message);
              // Clear the sender's typing indicator the moment their message arrives —
              // don't wait for the 1.5s auto-clear timer to fire. This is the correct
              // UX: "X is typing…" vanishes as soon as the message appears.
              const senderId = data.message.user.id;
              if (typingTimeoutsRef.current[senderId]) {
                clearTimeout(typingTimeoutsRef.current[senderId]);
                delete typingTimeoutsRef.current[senderId];
              }
              clearTyping(conversationId, senderId);
              break;
            }

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

            case "typing_start":
              // Skip our own events — backend broadcasts to all members including sender.
              if (data.user_id === currentUserId) break;

              setTyping(conversationId, data.user_id, data.display_name);

              // Safety net: if typing_stop never arrives (crash, closed tab), clear after 10s.
              // Normal path clears immediately on typing_stop below.
              if (typingTimeoutsRef.current[data.user_id]) {
                clearTimeout(typingTimeoutsRef.current[data.user_id]);
              }
              typingTimeoutsRef.current[data.user_id] = setTimeout(() => {
                clearTyping(conversationId, data.user_id);
                delete typingTimeoutsRef.current[data.user_id];
              }, 10000);
              break;

            case "typing_stop":
              // User explicitly stopped typing — clear indicator immediately.
              if (data.user_id === currentUserId) break;
              if (typingTimeoutsRef.current[data.user_id]) {
                clearTimeout(typingTimeoutsRef.current[data.user_id]);
                delete typingTimeoutsRef.current[data.user_id];
              }
              clearTyping(conversationId, data.user_id);
              break;
          }
        },
      },
    );

    subscriptionRef.current = subscription;

    // Cleanup: unsubscribe when the component unmounts or conversationId changes.
    // Also clear all pending typing timeouts so stale indicators don't linger.
    return () => {
      Object.values(typingTimeoutsRef.current).forEach(clearTimeout);
      typingTimeoutsRef.current = {};
      subscriptionRef.current = null;
      hasConnectedRef.current = false;
      subscription.unsubscribe();
    };
  }, [conversationId, token]); // eslint-disable-line react-hooks/exhaustive-deps

  // sendTyping — fires once when the user transitions from idle to typing.
  // Performs the "typing" action → backend broadcasts typing_start to others.
  const sendTyping = useCallback(() => {
    subscriptionRef.current?.perform("typing", {});
  }, []);

  // sendStopTyping — fires when the user stops: submits, clears input, or blurs.
  // Performs "stop_typing" → backend broadcasts typing_stop; receivers clear immediately.
  const sendStopTyping = useCallback(() => {
    subscriptionRef.current?.perform("stop_typing", {});
  }, []);

  return { sendTyping, sendStopTyping };
}
