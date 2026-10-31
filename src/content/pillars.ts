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
          "Une page préparatoire reprend la description du bien et ce qui manque. Aucune vente comparable n'est branchée, donc aucun prix n'est affiché.",
          "Un résultat automatisé ne sera jamais présenté comme une évaluation certifiée ni comme une valeur marchande garantie.",
        ],
      },
      {
        heading: "Produit net approximatif",
        paragraphs: [
          "Le calcul public utilise les montants que vous fournissez. Il n'applique pas de barème officiel.",
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
      { href: "/vendre/estimation-maison", label: "Préparer une estimation sans prix" },
      { href: "/vendre/calculateur-produit-net", label: "Calculer un produit net hypothétique" },
      { href: "/vendre/vendre-avant-acheter", label: "Voir vendre avant d'acheter" },
      { href: "/vendre/preparer-sa-maison", label: "Cocher la préparation à la vente" },
      { href: "/methodologie", label: "Lire la méthode de calcul" },
      { href: "/acheter", label: "Voir le versant achat" },
      { href: "/contact", label: "Un rendez-vous se demande depuis un outil" },
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
          "Une page sépare les frais uniques et les frais récurrents. Elle ne calcule ni le prix, ni la mise de fonds, ni la taxe de bienvenue, ni les taxes, ni une mensualité.",
          "Aucun taux hypothécaire n'est codé ici. Aucune approbation de crédit n'est offerte. Ce n'est pas un conseil financier.",
        ],
      },
      {
        heading: "Quartier",
        paragraphs: [
          "Une page note des préférences de lieu : transport, services, type de milieu. Elle ne recommande aucun quartier et ne publie aucun classement.",
        ],
      },
    ],
    missing: [
      `Taux hypothécaire daté : ${missing}`,
      `Barème de taxe de bienvenue : ${missing}`,
      `Taxes municipales et scolaires : ${missing}`,
    ],
    links: [
      { href: "/acheter/comparer-quartiers", label: "Noter des préférences de quartier" },
      { href: "/acheter/cout-total-achat", label: "Séparer les coûts d'achat" },
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
    lead: "Les outils doivent donner un résultat honnête avant de demander un contact. Le produit net et les parcours sans barème sont ouverts. Le radar de prix et le rendement locatif restent fermés.",
    sections: [
      {
        heading: "Encore fermés",
        paragraphs: [
          "L'estimation préparatoire, vendre avant d'acheter, la comparaison de quartiers, le coût d'achat et la préparation à la vente donnent un résultat sans prix inventé. Une demande de réponse n'est enregistrée qu'après ce résultat, avec un consentement explicite.",
          "Le radar des prix, la comparaison acheter ou louer, le budget de rénovation chiffré et le rendement locatif restent fermés. Ils ne seront pas livrés avec des chiffres de remplacement.",
        ],
      },
    ],
    missing: [`Barèmes officiels de courtage et de taxes : ${missing}`],
    links: [
      { href: "/vendre/estimation-maison", label: "Ouvrir l'estimation préparatoire" },
      { href: "/vendre/calculateur-produit-net", label: "Ouvrir le calcul du produit net" },
      { href: "/vendre/vendre-avant-acheter", label: "Ouvrir vendre avant d'acheter" },
      { href: "/vendre/preparer-sa-maison", label: "Ouvrir la préparation à la vente" },
      { href: "/acheter/comparer-quartiers", label: "Ouvrir les préférences de quartier" },
      { href: "/acheter/cout-total-achat", label: "Ouvrir le coût d'achat" },
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
      { href: "/outils", label: "Voir les outils" },
    ],
  },
  {
    slug: "contact",
    path: "/contact",
    title: "Parler à un courtier",
    description: "Cette page n'enregistre aucune demande. Un rendez-vous se demande depuis un outil.",
    lead: "Cette page n'enregistre aucune demande et n'envoie aucun message. Un rendez-vous se demande depuis un outil, après un résultat.",
    sections: [
      {
        heading: "Pas de formulaire",
        paragraphs: [
          "Un formulaire ici ferait semblant d'envoyer une demande. Il n'y en a pas. Les demandes passent par un outil, après un résultat, avec un consentement distinct pour la réponse et pour les messages promotionnels.",
          "Un rendez-vous demandé n'est pas un créneau confirmé. La confirmation exige une personne autorisée et un créneau réellement saisi.",
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
