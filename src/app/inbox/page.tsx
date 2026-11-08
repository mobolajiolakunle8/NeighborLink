import type { Metadata } from "next";
import InboxView from "@/components/InboxView";
export const metadata: Metadata = { title: "Inbox | NeighbourLink", robots: { index: false } };
export default function InboxPage() { return <InboxView />; }
