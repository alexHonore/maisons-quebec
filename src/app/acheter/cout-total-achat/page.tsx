import { HonestFunnelPage, honestMetadata } from "@/components/honest-funnel-page";

export const dynamic = "force-dynamic";

export function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ resultat?: string; demande?: string }>;
}) {
  return honestMetadata("cout_total_achat", searchParams);
}

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ resultat?: string; erreur?: string; demande?: string; doublon?: string }>;
}) {
  return <HonestFunnelPage funnel="cout_total_achat" searchParams={searchParams} />;
}
