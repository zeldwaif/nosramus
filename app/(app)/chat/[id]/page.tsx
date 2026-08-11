import { notFound } from "next/navigation";
import ChatView from "@/components/ChatView";
import { createClient } from "@/lib/supabase/server";
import type { Message } from "@/lib/types";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: conversation } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", id)
    .single();

  if (!conversation) notFound();

  const { data: messages } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  return (
    <ChatView
      conversationId={id}
      initialMessages={(messages ?? []) as Message[]}
      initialPaperIds={conversation.paper_ids ?? []}
    />
  );
}
