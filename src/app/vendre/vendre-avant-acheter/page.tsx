import { HonestFunnelPage, honestMetadata } from "@/components/honest-funnel-page";

export const dynamic = "force-dynamic";

export function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ resultat?: string; demande?: string }>;
}) {
  return honestMetadata("vendre_avant_acheter", searchParams);
}

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ resultat?: string; erreur?: string; demande?: string; doublon?: string }>;
}) {
  return <HonestFunnelPage funnel="vendre_avant_acheter" searchParams={searchParams} />;
}
