import type { Metadata } from "next";
import { PublicFrame } from "@/components/public-frame";
import { HonestFunnelScreen } from "@/components/honest-funnel";
import { FUNNEL_PATHS, FUNNEL_TITLES, buildHonestResult, type HonestFunnelName } from "@/domain/honest-funnels";
import { readFunnelDraft } from "@/server/acquisition";
import { loadPublicSite, settingsDatabase } from "@/server/public-site";

const DESCRIPTIONS: Record<HonestFunnelName, string> = {
  estimation_maison: "Rapport préparatoire sans prix. Les comparables ne sont pas branchés.",
  vendre_avant_acheter: "Ligne du temps qualitative pour vendre et acheter, sans financement calculé.",
  comparer_quartiers: "Préférences de quartier, sans recommandation et sans inventaire.",
  cout_total_achat: "Séparation des frais uniques et récurrents, sans taux ni total calculé.",
  preparer_sa_maison: "Liste de préparation à la vente. Le décompte n'est pas une note certifiée.",
};

export async function honestMetadata(
  funnel: HonestFunnelName,
  searchParams: Promise<{ resultat?: string; demande?: string }>,
): Promise<Metadata> {
  const params = await searchParams;
  const privateView = Boolean(params.resultat || params.demande);
  return {
    title: FUNNEL_TITLES[funnel],
    description: DESCRIPTIONS[funnel],
    alternates: { canonical: FUNNEL_PATHS[funnel] },
    robots: privateView ? { index: false, follow: false } : { index: true, follow: true },
  };
}

export async function HonestFunnelPage({
  funnel,
  searchParams,
}: {
  funnel: HonestFunnelName;
  searchParams: Promise<{ resultat?: string; erreur?: string; demande?: string; doublon?: string }>;
}) {
  const params = await searchParams;
  const stored = params.resultat ? readFunnelDraft(settingsDatabase(process.env), funnel, params.resultat) : null;
  const result = stored ? buildHonestResult(stored) : null;
  const { content } = loadPublicSite(process.env);
  return (
    <PublicFrame content={content}>
      <main id="contenu">
        <HonestFunnelScreen
          funnel={funnel}
          result={result}
          draftId={result ? params.resultat ?? null : null}
          error={params.erreur ?? null}
          received={params.demande === "recue"}
          duplicate={params.doublon === "1"}
          missingResult={Boolean(params.resultat) && !result}
        />
      </main>
    </PublicFrame>
  );
}
