import type { Metadata } from "next";
import { PublicFrame } from "@/components/public-frame";
import { NetProceedsCalculator } from "@/components/net-proceeds-calculator";
import { queryDropsPrivate, readNetProceedsLink, type NetProceedsQuery } from "@/domain/net-proceeds-link";
import { readNetProceedsDraft } from "@/server/acquisition";
import { loadPublicSite, settingsDatabase } from "@/server/public-site";

export const dynamic = "force-dynamic";

function privateView(params: NetProceedsQuery & { resultat?: string; demande?: string }): boolean {
  return Boolean(params.resultat || params.demande || readNetProceedsLink(params).present || queryDropsPrivate(params));
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<NetProceedsQuery & { resultat?: string; demande?: string }>;
}): Promise<Metadata> {
  const params = await searchParams;
  return {
    title: "Produit net approximatif",
    description: "Calcul hypothétique du produit net à partir des montants saisis, sans barème officiel.",
    alternates: { canonical: "/vendre/calculateur-produit-net" },
    robots: privateView(params) ? { index: false, follow: false } : { index: true, follow: true },
  };
}

export default async function NetProceedsPage({
  searchParams,
}: {
  searchParams: Promise<NetProceedsQuery & { resultat?: string; erreur?: string; demande?: string }>;
}) {
  const params = await searchParams;
  const link = readNetProceedsLink(params);
  const draftId = typeof params.resultat === "string" ? params.resultat : "";
  const draft = draftId ? readNetProceedsDraft(settingsDatabase(process.env), draftId) : null;
  const fromLink = link.present && link.ok ? link : null;
  const { content } = loadPublicSite(process.env);
  return (
    <PublicFrame content={content}>
      <main id="contenu">
        <NetProceedsCalculator
          result={draft?.result ?? fromLink?.result ?? null}
          draftId={draft ? draftId : null}
          fields={draft || !link.present ? null : link.fields}
          href={fromLink && !draft ? fromLink.href : null}
          error={params.erreur ?? (link.present && !link.ok ? "saisie" : null)}
          received={params.demande === "recue"}
        />
      </main>
    </PublicFrame>
  );
}
