import type { Metadata } from "next";
import LegalView from "@/components/LegalView";

export const metadata: Metadata = {
  title: "Privacy Policy | NeighbourLink",
  description: "How NeighbourLink collects, uses and protects your personal information.",
};

export default function PrivacyPage() {
  return <LegalView id="privacy" />;
}
