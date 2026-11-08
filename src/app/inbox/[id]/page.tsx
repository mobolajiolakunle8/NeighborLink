import type { Metadata } from "next";
import InboxView from "@/components/InboxView";
export const metadata: Metadata = { title: "Conversation | NeighbourLink", robots: { index: false } };
export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InboxView activeId={id} />;
}
