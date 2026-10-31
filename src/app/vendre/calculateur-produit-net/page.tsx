import type { Metadata } from "next";
import { PublicFrame } from "@/components/public-frame";
import { NetProceedsCalculator } from "@/components/net-proceeds-calculator";
import { readNetProceedsDraft } from "@/server/acquisition";
import { loadPublicSite, settingsDatabase } from "@/server/public-site";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ resultat?: string; demande?: string }>;
}): Promise<Metadata> {
  const params = await searchParams;
  const privateView = Boolean(params.resultat || params.demande);
  return {
    title: "Produit net approximatif",
    description: "Calcul hypothétique du produit net à partir des montants saisis, sans barème officiel.",
    alternates: { canonical: "/vendre/calculateur-produit-net" },
    robots: privateView ? { index: false, follow: false } : { index: true, follow: true },
  };
}

export default async function NetProceedsPage({
  searchParams,
}: {
  searchParams: Promise<{ resultat?: string; erreur?: string; demande?: string }>;
}) {
  const params = await searchParams;
  const draft = params.resultat ? readNetProceedsDraft(settingsDatabase(process.env), params.resultat) : null;
  const { content } = loadPublicSite(process.env);
  return (
    <PublicFrame content={content}>
      <main id="contenu">
        <NetProceedsCalculator
          result={draft?.result ?? null}
          draftId={draft ? params.resultat ?? null : null}
          error={params.erreur ?? null}
          received={params.demande === "recue"}
        />
      </main>
    </PublicFrame>
  );
}
