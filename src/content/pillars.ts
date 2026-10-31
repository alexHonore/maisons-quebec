import { REGULATORY_EMPTY_LABEL } from "../domain/regulatory-identity";
import { FORMULA_STATEMENT } from "../domain/sale-proceeds";

export type PillarSection = {
  readonly heading: string;
  readonly paragraphs: readonly string[];
};

export type PillarPage = {
  readonly slug: "vendre" | "acheter" | "marche" | "outils" | "guides" | "methodologie" | "contact";
  readonly path: string;
  readonly title: string;
  readonly description: string;
  readonly lead: string;
  readonly sections: readonly PillarSection[];
  readonly missing: readonly string[];
  readonly links: readonly { readonly href: string; readonly label: string }[];
};

const missing = REGULATORY_EMPTY_LABEL;

export const PILLAR_PAGES: readonly PillarPage[] = [
  {
    slug: "vendre",
    path: "/vendre",
    title: "Vendre une propriété au Québec",
    description: "Ce qu'une décision de vente demande, sans prix inventé et sans évaluation certifiée.",
    lead: "Vendre commence par comprendre ce qui manque, pas par afficher un prix. Aucune vente comparable n'est branchée sur ce site.",
    sections: [
      {
        heading: "Estimation préparatoire",
        paragraphs: [
          "Une estimation utile demanderait des ventes comparables licites, une description du bien et une relecture humaine. Rien de cela n'est disponible ici.",
          "Un résultat automatisé ne sera jamais présenté comme une évaluation certifiée ni comme une valeur marchande garantie.",
        ],
      },
      {
        heading: "Produit net approximatif",
        paragraphs: [
          "L'écran de calcul n'est pas ouvert. La formule, elle, est déjà fixée et testée.",
          FORMULA_STATEMENT.included,
          FORMULA_STATEMENT.excluded,
          FORMULA_STATEMENT.limit,
        ],
      },
    ],
    missing: [
      `Ventes comparables : ${missing}`,
      `Prix de marché : ${missing}`,
      `Identité du courtier annonceur : ${missing}`,
    ],
    links: [
      { href: "/methodologie", label: "Lire la méthode de calcul" },
      { href: "/acheter", label: "Voir le versant achat" },
      { href: "/contact", label: "La prise de rendez-vous n'est pas ouverte" },
    ],
  },
  {
    slug: "acheter",
    path: "/acheter",
    title: "Acheter une propriété au Québec",
    description: "Coûts d'achat et choix de quartier, sans taux ni mensualité inventés.",
    lead: "Acheter demande de séparer les frais uniques et les frais récurrents. Aucun barème n'est branché, donc aucun montant n'est affiché.",
    sections: [
      {
        heading: "Ce que le calcul devra distinguer",
        paragraphs: [
          "Plus tard, un outil pourra séparer le prix, la mise de fonds, les frais de notaire, la taxe de bienvenue selon un barème vérifié, les taxes municipales et scolaires si elles sont fournies, et les coûts de possession.",
          "Aucun taux hypothécaire n'est codé ici. Aucune approbation de crédit n'est offerte. Ce n'est pas un conseil financier.",
        ],
      },
      {
        heading: "Quartier",
        paragraphs: [
          "Le choix d'un quartier devra s'appuyer sur des critères de lieu vérifiables : transport, services, type de milieu. Aucun classement n'est publié.",
        ],
      },
    ],
    missing: [
      `Taux hypothécaire daté : ${missing}`,
      `Barème de taxe de bienvenue : ${missing}`,
      `Taxes municipales et scolaires : ${missing}`,
    ],
    links: [
      { href: "/marche", label: "Voir le marché de Québec et de Lévis" },
      { href: "/vendre", label: "Voir le versant vente" },
      { href: "/methodologie", label: "Lire les limites de méthode" },
    ],
  },
  {
    slug: "marche",
    path: "/marche",
    title: "Marché de Québec et de Lévis",
    description: "Territoire visé, sans statistique et sans page de quartier publiée.",
    lead: "Le premier territoire visé est la ville de Québec, Lévis et les environs. Aucun chiffre de marché n'est publié.",
    sections: [
      {
        heading: "Territoire nommé, pas mesuré",
        paragraphs: [
          "Les noms de lieux qui suivent indiquent où le site veut être utile. Ils ne décrivent ni les prix, ni la demande, ni la qualité de vie.",
          "Une page de quartier ne sera publiée que lorsqu'elle aura un contenu spécifique et vérifiable. Remplacer un nom de ville dans un texte générique ne suffit pas.",
        ],
      },
    ],
    missing: [
      `Limoilou : ${missing}`,
      `Charlesbourg : ${missing}`,
      `Beauport : ${missing}`,
      `Sainte-Foy : ${missing}`,
      `Saint-Nicolas : ${missing}`,
      `Séries de ventes : ${missing}`,
    ],
    links: [
      { href: "/acheter", label: "Revenir à l'achat" },
      { href: "/guides", label: "Voir pourquoi les guides ne sont pas publiés" },
    ],
  },
  {
    slug: "outils",
    path: "/outils",
    title: "Outils gratuits",
    description: "Les outils prévus, et ceux qui ne sont pas encore ouverts.",
    lead: "Les outils doivent donner un résultat honnête avant de demander un contact. Aucun n'est ouvert dans cette version, sauf la formule du produit net, qui n'a pas encore d'écran.",
    sections: [
      {
        heading: "Pas encore ouverts",
        paragraphs: [
          "Estimation préparatoire, produit net à l'écran, vendre avant d'acheter, comparaison de quartiers et coût d'achat restent à construire. Ils ne seront pas livrés avec des chiffres de remplacement.",
          "Un formulaire de lead n'est pas affiché. Enregistrer une demande appartient à une étape ultérieure.",
        ],
      },
    ],
    missing: [`Sources de calcul branchées : ${missing}`, `Écran du produit net : ${missing}`],
    links: [
      { href: "/vendre", label: "Lire ce que le produit net inclut" },
      { href: "/methodologie", label: "Lire la méthode" },
    ],
  },
  {
    slug: "guides",
    path: "/guides",
    title: "Guides",
    description: "Aucun guide n'est publié. La règle de publication est expliquée.",
    lead: "Aucun guide n'est en ligne. Une page ne sera publiée que si son contenu est spécifique, sourcé et vérifiable.",
    sections: [
      {
        heading: "Règle avant publication",
        paragraphs: [
          "Un guide doit répondre à une question réelle, dire ce qu'il ne sait pas, et citer une source quand il avance un fait, un taux ou une règle.",
          "Les textes produits par un modèle restent des brouillons. Aucun article n'est généré ni publié ici.",
        ],
      },
    ],
    missing: [`Guides rédigés : ${missing}`, `Sources reliées : ${missing}`],
    links: [
      { href: "/methodologie", label: "Lire la méthode" },
      { href: "/marche", label: "Voir les pages locales non publiées" },
    ],
  },
  {
    slug: "methodologie",
    path: "/methodologie",
    title: "Méthode",
    description: "Comment les calculs sont bornés, et quelles sources manquent.",
    lead: "La méthode tient en trois règles : même saisie, même résultat ; aucun barème officiel embarqué ; un manque se voit, il ne se devine pas.",
    sections: [
      {
        heading: "Calculs",
        paragraphs: [
          FORMULA_STATEMENT.limit,
          "Les taxes sur les honoraires de courtage se calculent sur le montant hors taxes, sans taxe sur taxe. Les taux viennent de la saisie, pas du code.",
          "La pénalité hypothécaire inconnue est exclue. Elle n'est pas estimée. La fiscalité personnelle est toujours exclue.",
        ],
      },
      {
        heading: "Rôle du courtage",
        paragraphs: [
          "Les outils gratuits ne remplacent pas un courtier, un notaire, un fiscaliste ou un prêteur.",
          "Quand un accompagnement sera offert, ce sera un service de courtage, présenté comme tel.",
        ],
      },
    ],
    missing: [`Sources officielles branchées : ${missing}`, `Permis et agence : ${missing}`],
    links: [
      { href: "/vendre", label: "Revenir à la vente" },
      { href: "/outils", label: "Voir les outils non ouverts" },
    ],
  },
  {
    slug: "contact",
    path: "/contact",
    title: "Parler à un courtier",
    description: "La prise de rendez-vous n'est pas ouverte. Aucun lead n'est enregistré.",
    lead: "La prise de rendez-vous n'est pas ouverte. Cette page n'enregistre aucune demande et n'envoie aucun message.",
    sections: [
      {
        heading: "Pas de formulaire",
        paragraphs: [
          "Un formulaire qui ferait semblant d'envoyer une demande serait trompeur. Il n'y en a pas.",
          "Quand la capture existera, le lead devra être enregistré localement avant tout envoi, avec un consentement distinct pour la réponse et pour les messages promotionnels.",
        ],
      },
    ],
    missing: [
      `Courriel public : ${missing}`,
      `Téléphone : ${missing}`,
      `Nom du courtier publié : ${missing}`,
    ],
    links: [
      { href: "/vendre", label: "Lire la page Vendre" },
      { href: "/", label: "Retour à l'accueil" },
    ],
  },
];

export function pillarBySlug(slug: string): PillarPage | undefined {
  return PILLAR_PAGES.find((page) => page.slug === slug);
}

export function pillarPlainText(page: PillarPage): string {
  return [
    page.title,
    page.description,
    page.lead,
    ...page.sections.flatMap((section) => [section.heading, ...section.paragraphs]),
    ...page.missing,
    ...page.links.flatMap((link) => [link.href, link.label]),
  ].join("\n");
}
