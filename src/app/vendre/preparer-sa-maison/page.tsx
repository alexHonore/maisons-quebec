import { HonestFunnelPage, honestMetadata } from "@/components/honest-funnel-page";

export const dynamic = "force-dynamic";

export function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ resultat?: string; demande?: string }>;
}) {
  return honestMetadata("preparer_sa_maison", searchParams);
}

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ resultat?: string; erreur?: string; demande?: string; doublon?: string }>;
}) {
  return <HonestFunnelPage funnel="preparer_sa_maison" searchParams={searchParams} />;
}
