import { FORMULA_STATEMENT } from "../domain/sale-proceeds";
import {
  REGULATORY_EMPTY_LABEL,
  regulatoryFields,
  regulatoryStatusLabel,
  type RegulatoryField,
  type RegulatoryIdentity,
} from "../domain/regulatory-identity";

export const HOME_TITLE = "Maisons Québec — décisions immobilières avec de vraies informations";

export const HOME_DESCRIPTION =
  "Maisons Québec prépare des outils et des explications pour vendre ou acheter au Québec. Aucun prix, aucune statistique et aucun permis ne sont inventés.";

export type HomeLink = {
  readonly href: string;
  readonly label: string;
  readonly description?: string;
};

export type HomeContent = {
  readonly brand: string;
  readonly brandNote: string;
  readonly identityStatus: string;
  readonly nav: readonly HomeLink[];
  readonly hero: {
    readonly title: string;
    readonly promise: string;
    readonly subpromise: string;
    readonly actions: readonly HomeLink[];
  };
  readonly limits: readonly string[];
  readonly tool: { readonly title: string; readonly body: string };
  readonly sell: { readonly title: string; readonly paragraphs: readonly string[] };
  readonly buy: { readonly title: string; readonly paragraphs: readonly string[] };
  readonly market: {
    readonly title: string;
    readonly body: string;
    readonly places: readonly { readonly name: string; readonly status: string }[];
  };
  readonly questions: {
    readonly title: string;
    readonly items: readonly { readonly question: string; readonly answer: string }[];
  };
  readonly scenarios: { readonly title: string; readonly intro: string; readonly items: readonly string[] };
  readonly guides: { readonly title: string; readonly body: string };
  readonly method: { readonly title: string; readonly items: readonly string[] };
  readonly proof: { readonly title: string; readonly body: string };
  readonly contact: { readonly title: string; readonly body: string };
  readonly identity: {
    readonly title: string;
    readonly intro: string;
    readonly caveat: string;
    readonly fields: readonly RegulatoryField[];
  };
  readonly footer: readonly string[];
};

export type PublicCopy = {
  readonly brandName?: string;
  readonly heroTitle?: string;
  readonly heroPromise?: string;
  readonly heroSubpromise?: string;
};

const DEFAULT_BRAND = "Maisons Québec";
const DEFAULT_HERO_TITLE = "Votre prochaine décision immobilière commence avec de vraies informations.";
const DEFAULT_HERO_PROMISE =
  "Maisons Québec prépare un média et des outils pour les personnes qui vendent ou achètent une propriété, d'abord à Québec et à Lévis. La promesse : des informations vérifiables, des calculs dont les hypothèses restent visibles, et un accompagnement humain seulement si vous le demandez.";
const DEFAULT_HERO_SUBPROMISE =
  "Outils gratuits, analyses locales transparentes, conseils concrets. Rien de cela n'est simulé ici avec de faux chiffres.";

function publishedCopy(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim() ?? "";
  if (trimmed === "" || trimmed === REGULATORY_EMPTY_LABEL) return fallback;
  return trimmed;
}

export function buildHomeContent(identity: RegulatoryIdentity, copy: PublicCopy = {}): HomeContent {
  return {
    brand: publishedCopy(copy.brandName, DEFAULT_BRAND),
    brandNote: "Marque provisoire",
    identityStatus: regulatoryStatusLabel(identity),
    nav: [
      { href: "/vendre", label: "Vendre" },
      { href: "/acheter", label: "Acheter" },
      { href: "/marche", label: "Marché et quartiers" },
      { href: "/outils", label: "Outils gratuits" },
      { href: "/guides", label: "Guides" },
      { href: "/methodologie", label: "Méthode" },
      { href: "/contact", label: "Parler à un expert" },
    ],
    hero: {
      title: publishedCopy(copy.heroTitle, DEFAULT_HERO_TITLE),
      promise: publishedCopy(copy.heroPromise, DEFAULT_HERO_PROMISE),
      subpromise: publishedCopy(copy.heroSubpromise, DEFAULT_HERO_SUBPROMISE),
      actions: [
        { href: "/vendre", label: "Je veux vendre", description: "Estimation et produit net, sans prix inventé." },
        { href: "/acheter", label: "Je veux acheter", description: "Coûts et quartiers, sans taux ni classement inventé." },
        { href: "/marche", label: "Explorer mon marché", description: "Québec et Lévis, sans statistique tant qu'aucune source n'est branchée." },
      ],
    },
    limits: [
      "Aucun prix de propriété",
      "Aucune statistique de marché",
      "Aucun témoignage",
      "Aucun formulaire sur cette page",
      "Aucun permis inventé",
      "Aucun rendez-vous confirmé automatiquement",
    ],
    tool: {
      title: "Estimation préparatoire, sans prix",
      body: "L'estimation préparatoire décrit ce qui manque. Elle ne donne pas de prix : aucune vente comparable n'est branchée. Le produit net se calcule seulement avec vos montants.",
    },
    sell: {
      title: "Vendre",
      paragraphs: [
        "L'estimation préparatoire est ouverte. Elle ne propose aucun prix : aucune vente comparable licite n'est branchée. Une estimation automatisée ne sera jamais présentée comme une évaluation certifiée.",
        "Le produit net approximatif se calcule à partir des montants que vous fournissez. Aucun barème officiel n'est appliqué à votre place.",
        FORMULA_STATEMENT.included,
        FORMULA_STATEMENT.excluded,
        FORMULA_STATEMENT.limit,
      ],
    },
    buy: {
      title: "Acheter",
      paragraphs: [
        "La comparaison de quartiers note des préférences. Elle ne nomme aucun quartier. Le coût d'achat sépare les frais uniques et les frais récurrents. Aucun taux, aucune taxe de bienvenue et aucune mensualité ne sont calculés.",
        "Aucune approbation de crédit ni recommandation hypothécaire n'est offerte.",
      ],
    },
    market: {
      title: "Marché de Québec et de Lévis",
      body: "Le premier territoire visé est la ville de Québec, Lévis et les environs : Sainte-Foy–Sillery–Cap-Rouge, Charlesbourg, Beauport, Limoilou, Saint-Roch, Val-Bélair, Ancienne-Lorette, Saint-Augustin, Saint-Nicolas et Desjardins. Le reste du Québec attend des contenus vérifiables et une capacité réelle de prise en charge. Aucun chiffre de marché n'est publié.",
      places: [
        { name: "Limoilou, Québec", status: REGULATORY_EMPTY_LABEL },
        { name: "Charlesbourg, Québec", status: REGULATORY_EMPTY_LABEL },
        { name: "Beauport, Québec", status: REGULATORY_EMPTY_LABEL },
        { name: "Sainte-Foy, Québec", status: REGULATORY_EMPTY_LABEL },
        { name: "Saint-Nicolas, Lévis", status: REGULATORY_EMPTY_LABEL },
      ],
    },
    questions: {
      title: "Question populaire, réponse directe",
      items: [
        {
          question: "Peut-on connaître la valeur de ma maison sur ce site ?",
          answer:
            "Non. Aucun comparable n'est branché. Le site ne publie ni fourchette de prix ni valeur marchande.",
        },
        {
          question: "Combien me restera-t-il après la vente ?",
          answer: `${FORMULA_STATEMENT.included} ${FORMULA_STATEMENT.excluded} ${FORMULA_STATEMENT.limit}`,
        },
        {
          question: "Les pages de quartiers sont-elles en ligne ?",
          answer: "Non. Une page locale ne sera publiée que lorsqu'elle aura un contenu spécifique et vérifiable.",
        },
      ],
    },
    scenarios: {
      title: "Situations que le site veut éclairer",
      intro: "Vendre avant d'acheter a une ligne du temps qualitative. Aucun scénario ne calcule un financement ni une approbation de crédit.",
      items: [
        "J'achète ma première propriété",
        "Je vends pour acheter",
        "J'hérite d'une propriété",
        "Je déménage dans une autre ville",
      ],
    },
    guides: {
      title: "Guides",
      body: "Les pages de guide ajoutées dans l'administration ne s'affichent qu'une fois publiées. Un brouillon n'est pas public. Un exemple n'est pas un fait de marché.",
    },
    method: {
      title: "Méthode et limites",
      items: [
        "Les calculs retenus sont déterministes : la même saisie produit le même résultat.",
        "Les outils gratuits ne remplacent pas un courtier, un notaire, un fiscaliste ou un prêteur.",
        "Lorsque l'accompagnement sera offert, ce sera un service de courtage, présenté comme tel, et non un conseil indépendant déguisé.",
        "Les textes en anglais ne sont pas publiés. La langue de cette page est le français du Québec.",
      ],
    },
    proof: {
      title: "Preuve sociale",
      body: "Aucun avis, aucune note et aucun nombre de clients ne sont affichés. Il n'y a pas de donnée vérifiée à montrer.",
    },
    contact: {
      title: "Parler à un courtier",
      body: "Une demande de rendez-vous peut suivre un outil, avec un consentement explicite. Elle n'est pas une confirmation. Un créneau n'est confirmé que si une personne autorisée le saisit vraiment.",
    },
    identity: {
      title: "Identification professionnelle",
      intro:
        "Les mentions utiles à la publicité immobilière ne sont pas inventées. Les champs restent vides tant que les données vérifiées ne sont pas fournies. Cette page ne constitue pas une publicité d'inscription.",
      caveat:
        "Une valeur affichée ne vaut ni approbation de l'OACIQ ni vérification juridique. Elle n'apparaît que si elle a été fournie dans la configuration.",
      fields: regulatoryFields(identity),
    },
    footer: [
      "Domaine canonique : https://maisonsquebec.ca",
      "Politique de confidentialité : non publiée",
      "Conditions d'utilisation : non publiées",
      "Logo temporaire. Ce n'est pas la marque définitive.",
    ],
  };
}

export function homePlainText(content: HomeContent): string {
  const chunks: string[] = [];
  const visit = (value: unknown): void => {
    if (typeof value === "string") chunks.push(value);
    else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object") Object.values(value).forEach(visit);
  };
  visit(content);
  return chunks.join("\n");
}
