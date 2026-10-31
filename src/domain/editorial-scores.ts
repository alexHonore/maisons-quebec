import { hasNamedSource, hasUnsourcedMarketClaim, MIN_INDEXABLE_BODY_LENGTH } from "./content-page";

/** Barème de préparation. Ce n'est pas une mesure de classement, de citation ou de leads. */
export const RUBRIC_VERSION = "1.0.0";
export const SCORE_PUBLICATION_MINIMUM = 70;

export type ScoreCriterion = {
  readonly id: string;
  readonly label: string;
  readonly weight: number;
  readonly earned: number;
  readonly evidence: string;
};

export type EditorialScores = {
  readonly rubricVersion: typeof RUBRIC_VERSION;
  readonly seo: number;
  readonly citability: number;
  readonly conversion: number;
  readonly passed: boolean;
  readonly seoCriteria: readonly ScoreCriterion[];
  readonly citabilityCriteria: readonly ScoreCriterion[];
  readonly conversionCriteria: readonly ScoreCriterion[];
};

export type ScoreInput = {
  readonly title: string;
  readonly description: string;
  readonly body: string;
  readonly sourceNote: string;
  readonly example: boolean;
};

function mark(id: string, label: string, weight: number, ok: boolean, evidence: string): ScoreCriterion {
  return { id, label, weight, earned: ok ? weight : 0, evidence };
}

function total(criteria: readonly ScoreCriterion[]): number {
  return criteria.reduce((sum, criterion) => sum + criterion.earned, 0);
}

export function scoreContentPage(page: ScoreInput): EditorialScores {
  const title = page.title.trim();
  const description = page.description.trim();
  const body = page.body.trim();
  const text = `${page.title}\n${page.description}\n${page.body}`;
  const paragraphs = body.split(/\n{2,}/).filter((part) => part.trim() !== "");
  const first = paragraphs[0] ?? "";
  const sourced = hasNamedSource(page.sourceNote);
  const internalLink = /\/(?:vendre|acheter|guides|contact|methodologie)\b/.test(body);
  const place = /Québec|Lévis/.test(text);
  const limit = /vérifier|limite|ne constitue pas|n'est pas/i.test(body);
  const cta = /calculateur-produit-net|estimation-maison|\/contact|rendez-vous/.test(body);
  const intent = /vendre|acheter|vendeur|acheteur/i.test(body);
  const coercive = /courriel obligatoire|inscrivez-vous pour lire/i.test(body);

  const seoCriteria = [
    mark("seo_title", "Titre utilisable", 20, title.length >= 12 && title.length <= 70, `Titre de ${title.length} caractères.`),
    mark("seo_description", "Résumé utilisable", 15, description.length >= 40 && description.length <= 180, `Résumé de ${description.length} caractères.`),
    mark("seo_structure", "Au moins deux paragraphes", 20, paragraphs.length >= 2, `${paragraphs.length} paragraphe${paragraphs.length > 1 ? "s" : ""}.`),
    mark("seo_internal_link", "Lien interne vers un outil ou une page du site", 25, internalLink, internalLink ? "Lien interne présent." : "Aucun lien interne."),
    mark("seo_source", "Source nommée", 20, sourced, sourced ? "Source nommée." : "Source absente."),
  ];
  const citabilityCriteria = [
    mark("cite_answer", "Premier paragraphe assez développé", 25, first.length >= 80, `Premier paragraphe de ${first.length} caractères.`),
    mark("cite_source", "Source nommée", 25, sourced, sourced ? "Source nommée." : "Source absente."),
    mark("cite_place", "Québec ou Lévis est nommé", 20, place, place ? "Lieu nommé." : "Québec ou Lévis n'est pas nommé."),
    mark("cite_limit", "Une limite ou une vérification est dite", 15, limit, limit ? "Une limite est écrite." : "Aucune limite écrite."),
    mark(
      "cite_no_unsourced",
      "Pas de prix, taux ou décompte sans source",
      15,
      !hasUnsourcedMarketClaim(page),
      hasUnsourcedMarketClaim(page) ? "Affirmation chiffrée sans source." : "Pas d'affirmation chiffrée sans source.",
    ),
  ];
  const conversionCriteria = [
    mark("conv_cta", "Lien vers un outil ou un rendez-vous", 30, cta, cta ? "Appel à l'action présent." : "Aucun appel à l'action."),
    mark("conv_substance", "Texte assez long avant une demande", 25, body.length >= MIN_INDEXABLE_BODY_LENGTH, `Texte de ${body.length} caractères.`),
    mark("conv_no_gate", "La lecture n'est pas bloquée par un courriel", 20, !coercive, coercive ? "Le texte exige un courriel pour lire." : "Pas d'obligation de courriel pour lire."),
    mark("conv_intent", "Le texte parle de vendre ou d'acheter", 15, intent, intent ? "Intention nommée." : "Intention non nommée."),
    mark("conv_not_example", "La page n'est pas marquée comme exemple", 10, !page.example, page.example ? "Exemple." : "Pas un exemple."),
  ];
  const seo = total(seoCriteria);
  const citability = total(citabilityCriteria);
  const conversion = total(conversionCriteria);
  return {
    rubricVersion: RUBRIC_VERSION,
    seo,
    citability,
    conversion,
    passed: seo >= SCORE_PUBLICATION_MINIMUM && citability >= SCORE_PUBLICATION_MINIMUM && conversion >= SCORE_PUBLICATION_MINIMUM,
    seoCriteria,
    citabilityCriteria,
    conversionCriteria,
  };
}
