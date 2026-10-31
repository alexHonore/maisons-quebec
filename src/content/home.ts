import { FORMULA_STATEMENT } from "../domain/sale-proceeds";
import {
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

export function buildHomeContent(identity: RegulatoryIdentity): HomeContent {
  return {
    brand: "Maisons Québec",
    brandNote: "Marque provisoire",
    identityStatus: regulatoryStatusLabel(identity),
    nav: [
      { href: "#vendre", label: "Vendre" },
      { href: "#acheter", label: "Acheter" },
      { href: "#marche", label: "Marché et quartiers" },
      { href: "#outils", label: "Outils gratuits" },
      { href: "#guides", label: "Guides" },
      { href: "#contact", label: "Parler à un expert" },
    ],
    hero: {
      title: "Votre prochaine décision immobilière commence avec de vraies informations.",
      promise:
        "Maisons Québec prépare un média et des outils pour les personnes qui vendent ou achètent une propriété, d'abord à Québec et à Lévis. La promesse : des informations vérifiables, des calculs dont les hypothèses restent visibles, et un accompagnement humain seulement si vous le demandez.",
      subpromise:
        "Outils gratuits, analyses locales transparentes, conseils concrets. Rien de cela n'est simulé ici avec de faux chiffres.",
      actions: [
        { href: "#vendre", label: "Je veux vendre", description: "Estimation et produit net, sans prix inventé." },
        { href: "#acheter", label: "Je veux acheter", description: "Coûts et quartiers, seulement lorsque les sources existent." },
        { href: "#marche", label: "Explorer mon marché", description: "Québec et Lévis, sans statistique tant qu'aucune source n'est branchée." },
      ],
    },
    limits: [
      "Aucun prix de propriété",
      "Aucune statistique de marché",
      "Aucun témoignage",
      "Aucun formulaire de contact",
      "Aucun permis inventé",
    ],
    tool: {
      title: "Pas d'estimation par adresse pour le moment",
      body: "Le champ d'adresse n'est pas affiché. Aucune source de comparables n'est branchée, et une estimation chiffrée inventée serait trompeuse. Aucun courriel n'est demandé.",
    },
    sell: {
      title: "Vendre",
      paragraphs: [
        "Deux sujets sont prévus. L'estimation préparatoire ne propose aucun prix : aucune vente comparable licite n'est branchée. Une estimation automatisée ne sera jamais présentée comme une évaluation certifiée.",
        "Le produit net approximatif se calcule à partir des montants fournis. L'écran public du calculateur n'est pas ouvert.",
        FORMULA_STATEMENT.included,
        FORMULA_STATEMENT.excluded,
        FORMULA_STATEMENT.limit,
      ],
    },
    buy: {
      title: "Acheter",
      paragraphs: [
        "Le coût réel d'un achat et la comparaison de quartiers ne sont pas ouverts. Aucun taux hypothécaire, aucune taxe de bienvenue et aucune mensualité ne sont affichés, faute de barème vérifié branché au site.",
        "Aucune approbation de crédit ni recommandation hypothécaire n'est offerte.",
      ],
    },
    market: {
      title: "Marché de Québec et de Lévis",
      body: "Le premier territoire visé est la ville de Québec, Lévis et les environs : Sainte-Foy–Sillery–Cap-Rouge, Charlesbourg, Beauport, Limoilou, Saint-Roch, Val-Bélair, Ancienne-Lorette, Saint-Augustin, Saint-Nicolas et Desjardins. Le reste du Québec attend des contenus vérifiables et une capacité réelle de prise en charge. Aucun chiffre de marché n'est publié.",
      places: [
        { name: "Limoilou, Québec", status: "Page non publiée — aucun contenu local vérifié" },
        { name: "Charlesbourg, Québec", status: "Page non publiée — aucun contenu local vérifié" },
        { name: "Beauport, Québec", status: "Page non publiée — aucun contenu local vérifié" },
        { name: "Sainte-Foy, Québec", status: "Page non publiée — aucun contenu local vérifié" },
        { name: "Saint-Nicolas, Lévis", status: "Page non publiée — aucun contenu local vérifié" },
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
      intro: "Ces parcours ne sont pas encore des outils. Aucun scénario ne produit de calendrier chiffré ni de recommandation de crédit.",
      items: [
        "J'achète ma première propriété",
        "Je vends pour acheter",
        "J'hérite d'une propriété",
        "Je déménage dans une autre ville",
      ],
    },
    guides: {
      title: "Guides",
      body: "Aucun guide n'est publié. Une page ne sera mise en ligne que si son contenu est spécifique et vérifiable. Les adresses prévues pour plus tard ne sont pas créées vides.",
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
      body: "La prise de rendez-vous n'est pas ouverte. Aucun formulaire n'enregistre de demande. Les leads ne sont pas captés dans cette version.",
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
