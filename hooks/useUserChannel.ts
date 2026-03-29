"use client";

// ─── useUserChannel ────────────────────────────────────────────────────────────
// Subscribes to the Rails UserChannel (personal stream: "user_<currentUserId>")
// and handles cross-conversation notifications that don't fit into a specific
// conversation or call stream.
//
// Backend connection:
//   Channel:  app/channels/user_channel.rb
//   Stream:   "user_<currentUserId>" — each user has their own personal stream
//
// Events handled:
//   new_conversation — another user created a DM or group and added this user.
//     Without this hook, User B's sidebar would only update after a hard refresh
//     because they have no ConversationChannel subscription for a conversation
//     they don't know about yet.
//
// Mount location: app/(app)/layout.tsx — once per authenticated session.
// Same pattern as useCallChannel and usePresence.

import { useEffect } from "react";
import { getCableConsumer } from "@/lib/actioncable";
import { useAuthStore } from "@/store/auth.store";
import { useConversationsStore } from "@/store/conversations.store";
import type { ConversationWithMembers } from "@/types";

type UserChannelEvent = {
  type: "new_conversation";
  conversation: ConversationWithMembers;
};

export function useUserChannel(): void {
  const token = useAuthStore((state) => state.token);
  const currentUserId = useAuthStore((state) => state.user?.id);
  const addConversation = useConversationsStore((state) => state.addConversation);

  useEffect(() => {
    if (!token || !currentUserId) return;

    const consumer = getCableConsumer(token);
    if (!consumer) return; // SSR guard

    const subscription = consumer.subscriptions.create(
      { channel: "UserChannel" },
      {
        received(data: UserChannelEvent) {
          if (data.type === "new_conversation") {
            // addConversation deduplicates by id — safe to call even if the
            // conversation is already in the store (e.g. if the creator also
            // receives this event).
            addConversation(data.conversation);
          }
        },
      },
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [token, currentUserId]); // eslint-disable-line react-hooks/exhaustive-deps
}
