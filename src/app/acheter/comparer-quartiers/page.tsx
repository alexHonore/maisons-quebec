import { HonestFunnelPage, honestMetadata } from "@/components/honest-funnel-page";

export const dynamic = "force-dynamic";

export function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ resultat?: string; demande?: string }>;
}) {
  return honestMetadata("comparer_quartiers", searchParams);
}

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ resultat?: string; erreur?: string; demande?: string; doublon?: string }>;
}) {
  return <HonestFunnelPage funnel="comparer_quartiers" searchParams={searchParams} />;
}
