import { ProofView } from "@/components/proof/proof-view";
import { PageTransition } from "@/components/ui/page-transition";

export const metadata = {
  title: "Proof — INSIDER",
  description: "Every claim on this site, with the devnet transactions that show it.",
};

export default function ProofPage() {
  return (
    <PageTransition>
      <ProofView />
    </PageTransition>
  );
}
