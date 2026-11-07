import type { Metadata } from "next";
import LegalView from "@/components/LegalView";

export const metadata: Metadata = {
  title: "Terms of Service | NeighbourLink",
  description: "The rules for using the NeighbourLink community platform in Ibadan.",
};

export default function TermsPage() {
  return <LegalView id="terms" />;
}
