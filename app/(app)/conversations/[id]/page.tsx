// ─── Conversation thread page ─────────────────────────────────────────────────
// Dynamic route: /conversations/[id]
// This is a Server Component — the page shell is SSR'd; the actual data fetching
// and WebSocket subscription happen in the client-side MessageThread component.
//
// Why Server Component here?
//   The page just validates the route param and hands it to a Client Component.
//   Keeping the page file as a Server Component lets Next.js generate page metadata
//   server-side and avoids shipping unnecessary JS for the shell.
//
// Backend connection:
//   Indirectly, via MessageThread → getConversation() + getMessages() + ConversationChannel.
//   The id param maps to the conversation primary key in the Rails conversations table.

import { notFound } from "next/navigation";
import { MessageThread } from "@/components/chat/MessageThread";

interface ConversationPageProps {
  params: Promise<{ id: string }>;
}

export default async function ConversationPage({ params }: ConversationPageProps) {
  const { id } = await params;
  const conversationId = parseInt(id, 10);

  // If the route param is not a valid integer, render the 404 page.
  // This catches /conversations/abc or /conversations/undefined.
  if (isNaN(conversationId)) {
    notFound();
  }

  return <MessageThread conversationId={conversationId} />;
}
