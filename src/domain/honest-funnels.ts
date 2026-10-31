import { REGULATORY_EMPTY_LABEL } from "./regulatory-identity";

/** Clé de dédoublonnage. Ce n'est pas un score de similarité. */
export const DEDUP_KEY = "contact_email_normalise+funnel_name" as const;

export const DEDUP_KEY_RULE =
  "La clé est le courriel normalisé (espaces retirés, minuscules) plus le nom du funnel. La même clé renvoie la demande existante sans modifier le nom, le consentement ni le rendez-vous. Un autre funnel, ou un autre courriel, reste une autre demande. Deux noms identiques avec deux courriels ne sont jamais fusionnés.";

export const HONEST_FUNNELS = [
  "estimation_maison",
  "vendre_avant_acheter",
  "comparer_quartiers",
  "cout_total_achat",
  "preparer_sa_maison",
] as const;

export type HonestFunnelName = (typeof HONEST_FUNNELS)[number];

export const FUNNEL_PATHS: Record<HonestFunnelName, string> = {
  estimation_maison: "/vendre/estimation-maison",
  vendre_avant_acheter: "/vendre/vendre-avant-acheter",
  comparer_quartiers: "/acheter/comparer-quartiers",
  cout_total_achat: "/acheter/cout-total-achat",
  preparer_sa_maison: "/vendre/preparer-sa-maison",
};

export const FUNNEL_LEAD_TYPE: Record<HonestFunnelName, "vendeur" | "acheteur"> = {
  estimation_maison: "vendeur",
  vendre_avant_acheter: "vendeur",
  comparer_quartiers: "acheteur",
  cout_total_achat: "acheteur",
  preparer_sa_maison: "vendeur",
};

export const FUNNEL_CONSENT_VERSION: Record<HonestFunnelName, string> = {
  estimation_maison: "estimation-reponse-v1",
  vendre_avant_acheter: "scenario-reponse-v1",
  comparer_quartiers: "quartiers-reponse-v1",
  cout_total_achat: "cout-achat-reponse-v1",
  preparer_sa_maison: "preparation-reponse-v1",
};

export const FUNNEL_TITLES: Record<HonestFunnelName, string> = {
  estimation_maison: "Estimation préparatoire",
  vendre_avant_acheter: "Vendre avant d'acheter",
  comparer_quartiers: "Préférences de quartier",
  cout_total_achat: "Coût d'un achat, sans total",
  preparer_sa_maison: "Préparer sa maison",
};

type Option = readonly [value: string, label: string];

export const PROPERTY_TYPES = [
  ["maison", "Maison unifamiliale"],
  ["jumele", "Jumelé"],
  ["condo", "Condo"],
  ["plex", "Plex"],
  ["terrain", "Terrain"],
  ["autre", "Autre"],
] as const satisfies readonly Option[];

export const YEAR_BANDS = [
  ["ancienne", "Construction ancienne"],
  ["courante", "Construction courante"],
  ["recente", "Construction récente"],
  ["inconnue", "Période inconnue"],
] as const satisfies readonly Option[];

export const SURFACE_BANDS = [
  ["petite", "Surface que vous jugez petite"],
  ["moyenne", "Surface que vous jugez moyenne"],
  ["grande", "Surface que vous jugez grande"],
  ["non_indiquee", "Surface non indiquée"],
] as const satisfies readonly Option[];

export const BEDROOM_BANDS = [
  ["une", "Une chambre"],
  ["deux", "Deux chambres"],
  ["trois", "Trois chambres"],
  ["quatre_ou_plus", "Quatre chambres ou plus"],
  ["non_indique", "Nombre non indiqué"],
] as const satisfies readonly Option[];

export const CONDITION_BANDS = [
  ["entretien_courant", "Entretien courant"],
  ["renovations_recentes", "Rénovations récentes"],
  ["travaux_a_prevoir", "Travaux à prévoir"],
  ["non_indique", "Entretien non indiqué"],
] as const satisfies readonly Option[];

export const SCENARIOS = [
  ["vendre_puis_acheter", "Vendre, puis acheter"],
  ["acheter_puis_vendre", "Acheter, puis vendre"],
  ["conditionnel", "Vente et achat conditionnels"],
] as const satisfies readonly Option[];

export const HORIZONS = [
  ["moins_de_trois_mois", "Moins de trois mois"],
  ["trois_a_six_mois", "De trois à six mois"],
  ["six_a_douze_mois", "De six à douze mois"],
  ["plus_de_douze_mois", "Plus de douze mois"],
  ["indecis", "Horizon non fixé"],
] as const satisfies readonly Option[];

export const SETTINGS = [
  ["urbain", "Vie urbaine"],
  ["tranquille", "Milieu tranquille"],
  ["mixte", "Entre les deux"],
] as const satisfies readonly Option[];

export const PLACE_TYPES = [
  ["maison", "Maison"],
  ["condo", "Condo"],
  ["indifferent", "Maison ou condo"],
] as const satisfies readonly Option[];

export const PROXIMITIES = [
  ["proche", "À proximité"],
  ["indifferent", "Pas un critère"],
] as const satisfies readonly Option[];

export const COST_FOCI = [
  ["frais_uniques", "Clarifier d'abord les frais uniques"],
  ["frais_recurrents", "Clarifier d'abord les frais récurrents"],
  ["les_deux", "Clarifier les deux"],
] as const satisfies readonly Option[];

export const PREP_TASKS = [
  ["titre", "Rassembler le titre et les documents de propriété"],
  ["mesures", "Noter les mesures que vous connaissez déjà"],
  ["reparations", "Lister les réparations visibles"],
  ["desencombrement", "Prévoir le désencombrement"],
  ["factures", "Retrouver les factures de travaux connus"],
  ["inspection", "Préparer des questions pour une inspection"],
  ["photos", "Préparer des photos, sans les publier ici"],
] as const satisfies readonly Option[];

export type FunnelDraft = {
  readonly funnelName: HonestFunnelName;
  readonly answers: { readonly [key: string]: string };
};

type ResultBase = {
  readonly title: string;
  readonly summary: string;
  readonly lines: readonly { readonly label: string; readonly value: string }[];
  readonly missing: readonly string[];
  readonly caveat: string;
};

export type EstimationResult = ResultBase & {
  readonly funnelName: "estimation_maison";
  readonly certifiedAppraisal: false;
  readonly guaranteedMarketValue: false;
  readonly priceCents: null;
  readonly comparables: typeof REGULATORY_EMPTY_LABEL;
};

export type ScenarioResult = ResultBase & {
  readonly funnelName: "vendre_avant_acheter";
  readonly creditApproval: false;
  readonly financingCents: null;
};

export type NeighborhoodResult = ResultBase & {
  readonly funnelName: "comparer_quartiers";
  readonly recommendedAreas: readonly [];
  readonly inventoryCount: null;
};

export type PurchaseCostResult = ResultBase & {
  readonly funnelName: "cout_total_achat";
  readonly mortgageRate: null;
  readonly monthlyPaymentCents: null;
  readonly welcomeTaxCents: null;
  readonly totalCents: null;
  readonly preapproval: false;
};

export type PrepResult = ResultBase & {
  readonly funnelName: "preparer_sa_maison";
  readonly checkedCount: number;
  readonly taskCount: number;
  readonly certifiedQualityScore: false;
};

export type HonestResult = EstimationResult | ScenarioResult | NeighborhoodResult | PurchaseCostResult | PrepResult;

export function isHonestFunnelName(value: string): value is HonestFunnelName {
  return (HONEST_FUNNELS as readonly string[]).includes(value);
}

export function funnelLabel(name: string): string {
  if (name === "produit_net") return "Produit net";
  if (isHonestFunnelName(name)) return FUNNEL_TITLES[name];
  return "Outil";
}

export function appointmentWindow(raw: string): string | null {
  const value = raw.trim().replace(/\s+/g, " ");
  if (value.length < 2 || value.length > 160) return null;
  if (value.includes("@")) return null;
  return value;
}

export function confirmableSlot(raw: string): string | null {
  const value = raw.trim().replace(/\s+/g, " ");
  if (value.length < 3 || value.length > 160) return null;
  if (value.toLowerCase().includes(REGULATORY_EMPTY_LABEL.toLowerCase())) return null;
  if (!/[\p{L}\p{N}]/u.test(value)) return null;
  return value;
}

function pick(list: readonly Option[], value: string | undefined): string | null {
  const candidate = value ?? "";
  return list.some((item) => item[0] === candidate) ? candidate : null;
}

function labelOf(list: readonly Option[], value: string): string {
  return list.find((item) => item[0] === value)?.[1] ?? value;
}

function municipality(raw: string | undefined): string | null {
  const value = (raw ?? "").trim().replace(/\s+/g, " ");
  if (value.length < 2 || value.length > 80) return null;
  if (/[@$\d]/.test(value)) return null;
  return value;
}

function taskList(raw: string | undefined): string | null {
  const tokens = (raw ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item !== "");
  const unique: string[] = [];
  for (const token of tokens) {
    if (!PREP_TASKS.some((item) => item[0] === token)) return null;
    if (!unique.includes(token)) unique.push(token);
  }
  return PREP_TASKS.map((item) => item[0])
    .filter((id) => unique.includes(id))
    .join(",");
}

export function parseFunnelFields(
  funnelName: string,
  fields: { readonly [key: string]: string | undefined },
): { ok: true; draft: FunnelDraft } | { ok: false } {
  if (!isHonestFunnelName(funnelName)) return { ok: false };
  if (funnelName === "estimation_maison") {
    const place = municipality(fields.municipality);
    const propertyType = pick(PROPERTY_TYPES, fields.property_type);
    const yearBand = pick(YEAR_BANDS, fields.year_band);
    const surfaceBand = pick(SURFACE_BANDS, fields.surface_band);
    const bedrooms = pick(BEDROOM_BANDS, fields.bedrooms);
    const condition = pick(CONDITION_BANDS, fields.condition);
    if (!place || !propertyType || !yearBand || !surfaceBand || !bedrooms || !condition) return { ok: false };
    return {
      ok: true,
      draft: {
        funnelName,
        answers: {
          municipality: place,
          property_type: propertyType,
          year_band: yearBand,
          surface_band: surfaceBand,
          bedrooms,
          condition,
        },
      },
    };
  }
  if (funnelName === "vendre_avant_acheter") {
    const scenario = pick(SCENARIOS, fields.scenario);
    const horizon = pick(HORIZONS, fields.horizon);
    if (!scenario || !horizon) return { ok: false };
    return { ok: true, draft: { funnelName, answers: { scenario, horizon } } };
  }
  if (funnelName === "comparer_quartiers") {
    const setting = pick(SETTINGS, fields.setting);
    const propertyType = pick(PLACE_TYPES, fields.property_type);
    const transport = pick(PROXIMITIES, fields.transport);
    const schools = pick(PROXIMITIES, fields.schools);
    const shops = pick(PROXIMITIES, fields.shops);
    const parks = pick(PROXIMITIES, fields.parks);
    if (!setting || !propertyType || !transport || !schools || !shops || !parks) return { ok: false };
    return {
      ok: true,
      draft: {
        funnelName,
        answers: { setting, property_type: propertyType, transport, schools, shops, parks },
      },
    };
  }
  if (funnelName === "cout_total_achat") {
    const focus = pick(COST_FOCI, fields.focus);
    if (!focus) return { ok: false };
    return { ok: true, draft: { funnelName, answers: { focus } } };
  }
  const tasks = taskList(fields.tasks);
  if (tasks === null) return { ok: false };
  return { ok: true, draft: { funnelName, answers: { tasks } } };
}

function estimationResult(answers: FunnelDraft["answers"]): EstimationResult {
  return {
    funnelName: "estimation_maison",
    title: "Rapport préparatoire, sans prix",
    summary: "Voici ce qui peut influencer une relecture humaine, et ce qui manque pour aller plus loin.",
    lines: [
      { label: "Municipalité déclarée", value: answers.municipality ?? "" },
      { label: "Type de bien", value: labelOf(PROPERTY_TYPES, answers.property_type ?? "") },
      { label: "Période de construction", value: `${labelOf(YEAR_BANDS, answers.year_band ?? "")}. Aucune décote chiffrée.` },
      { label: "Surface déclarée", value: labelOf(SURFACE_BANDS, answers.surface_band ?? "") },
      { label: "Chambres", value: labelOf(BEDROOM_BANDS, answers.bedrooms ?? "") },
      { label: "Entretien déclaré", value: `${labelOf(CONDITION_BANDS, answers.condition ?? "")}. Ce n'est pas une note de qualité.` },
      { label: "Prochaine étape", value: "Une relecture humaine peut être demandée. Elle ne confirme pas un créneau." },
    ],
    missing: [
      `Ventes comparables : ${REGULATORY_EMPTY_LABEL}`,
      `Fourchette de prix : ${REGULATORY_EMPTY_LABEL}`,
    ],
    caveat: "Ce n'est pas une évaluation certifiée et ce n'est pas une valeur marchande garantie.",
    certifiedAppraisal: false,
    guaranteedMarketValue: false,
    priceCents: null,
    comparables: REGULATORY_EMPTY_LABEL,
  };
}

function scenarioResult(answers: FunnelDraft["answers"]): ScenarioResult {
  const scenario = answers.scenario ?? "";
  const steps: Record<string, readonly { readonly label: string; readonly value: string }[]> = {
    vendre_puis_acheter: [
      { label: "Ordre", value: "D'abord préparer et conclure la vente, ensuite seulement s'engager sur l'achat." },
      { label: "Risque", value: "Le logement suivant peut partir pendant la vente." },
    ],
    acheter_puis_vendre: [
      { label: "Ordre", value: "L'engagement d'achat vient avant la vente." },
      { label: "Liquidité", value: "Deux propriétés en même temps. Le montant n'est pas calculé." },
    ],
    conditionnel: [
      { label: "Ordre", value: "L'achat et la vente sont liés par une condition, si le contrat le prévoit." },
      { label: "Dates", value: "Les dates clés restent à écrire avec les professionnels. Aucun calendrier chiffré n'est calculé." },
    ],
  };
  return {
    funnelName: "vendre_avant_acheter",
    title: "Ligne du temps qualitative",
    summary: `Scénario : ${labelOf(SCENARIOS, scenario)}. Horizon déclaré : ${labelOf(HORIZONS, answers.horizon ?? "")}.`,
    lines: [
      ...(steps[scenario] ?? []),
      { label: "Double financement", value: REGULATORY_EMPTY_LABEL },
      { label: "Questions à poser", value: "Notaire, prêteur et courtier. Aucune approbation de crédit n'est donnée ici." },
    ],
    missing: [
      `Montant du double financement : ${REGULATORY_EMPTY_LABEL}`,
      `Calendrier chiffré : ${REGULATORY_EMPTY_LABEL}`,
    ],
    caveat: "Ce n'est pas une approbation de crédit et ce n'est pas une recommandation hypothécaire.",
    creditApproval: false,
    financingCents: null,
  };
}

function neighborhoodResult(answers: FunnelDraft["answers"]): NeighborhoodResult {
  return {
    funnelName: "comparer_quartiers",
    title: "Préférences notées, sans recommandation",
    summary: "Vos critères sont enregistrés dans ce résultat. Aucun quartier n'est recommandé.",
    lines: [
      { label: "Milieu", value: labelOf(SETTINGS, answers.setting ?? "") },
      { label: "Type de bien", value: labelOf(PLACE_TYPES, answers.property_type ?? "") },
      { label: "Transport", value: labelOf(PROXIMITIES, answers.transport ?? "") },
      { label: "Écoles, comme caractéristique du lieu", value: labelOf(PROXIMITIES, answers.schools ?? "") },
      { label: "Commerces", value: labelOf(PROXIMITIES, answers.shops ?? "") },
      { label: "Parcs", value: labelOf(PROXIMITIES, answers.parks ?? "") },
    ],
    missing: [
      `Quartiers compatibles : ${REGULATORY_EMPTY_LABEL}`,
      `Inventaire : ${REGULATORY_EMPTY_LABEL}`,
    ],
    caveat: "Aucun inventaire immobilier n'est affiché. Les critères ne servent pas à classer des personnes.",
    recommendedAreas: [],
    inventoryCount: null,
  };
}

function purchaseCostResult(answers: FunnelDraft["answers"]): PurchaseCostResult {
  return {
    funnelName: "cout_total_achat",
    title: "Frais uniques et frais récurrents",
    summary: `${labelOf(COST_FOCI, answers.focus ?? "")}. Aucun total n'est calculé.`,
    lines: [
      { label: "Frais uniques", value: "Prix, mise de fonds, notaire, taxe de bienvenue, inspection." },
      { label: "Frais récurrents", value: "Versement, taxes municipales, taxes scolaires, assurance, chauffage, entretien, copropriété." },
      { label: "Taux hypothécaire daté", value: REGULATORY_EMPTY_LABEL },
      { label: "Taxe de bienvenue", value: REGULATORY_EMPTY_LABEL },
      { label: "Mensualité", value: "Non calculée." },
      { label: "Total", value: "Non calculé." },
    ],
    missing: [
      `Taux hypothécaire daté : ${REGULATORY_EMPTY_LABEL}`,
      `Barème de taxe de bienvenue : ${REGULATORY_EMPTY_LABEL}`,
      `Taxes municipales et scolaires : ${REGULATORY_EMPTY_LABEL}`,
    ],
    caveat: "Ce n'est pas une préapprobation et ce n'est pas un conseil financier. Aucun taux n'est codé.",
    mortgageRate: null,
    monthlyPaymentCents: null,
    welcomeTaxCents: null,
    totalCents: null,
    preapproval: false,
  };
}

function prepResult(answers: FunnelDraft["answers"]): PrepResult {
  const selected = new Set((answers.tasks ?? "").split(",").filter((item) => item !== ""));
  const checkedCount = PREP_TASKS.filter((item) => selected.has(item[0])).length;
  const summary =
    checkedCount === 0
      ? `Aucune tâche cochée sur ${PREP_TASKS.length}.`
      : checkedCount === 1
        ? `1 tâche cochée sur ${PREP_TASKS.length}.`
        : `${checkedCount} tâches cochées sur ${PREP_TASKS.length}.`;
  return {
    funnelName: "preparer_sa_maison",
    title: "Liste de préparation",
    summary,
    lines: PREP_TASKS.map((item) => ({
      label: item[1],
      value: selected.has(item[0]) ? "Cochée" : "Non cochée",
    })),
    missing: [`Note de qualité certifiée : ${REGULATORY_EMPTY_LABEL}`],
    caveat: "Ce décompte n'est pas une note de qualité certifiée du bien.",
    checkedCount,
    taskCount: PREP_TASKS.length,
    certifiedQualityScore: false,
  };
}

export function buildHonestResult(draft: { funnelName: string; answers: { readonly [key: string]: string } }): HonestResult | null {
  const parsed = parseFunnelFields(draft.funnelName, draft.answers);
  if (!parsed.ok) return null;
  if (parsed.draft.funnelName === "estimation_maison") return estimationResult(parsed.draft.answers);
  if (parsed.draft.funnelName === "vendre_avant_acheter") return scenarioResult(parsed.draft.answers);
  if (parsed.draft.funnelName === "comparer_quartiers") return neighborhoodResult(parsed.draft.answers);
  if (parsed.draft.funnelName === "cout_total_achat") return purchaseCostResult(parsed.draft.answers);
  return prepResult(parsed.draft.answers);
}
