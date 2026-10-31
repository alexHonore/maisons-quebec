import { CANONICAL_ORIGIN } from "./site-url";
import { NET_PROCEEDS_LINK_KEYS, NET_PROCEEDS_PAGE_PATH, type NetProceedsLinkKey } from "./net-proceeds-link";

export const NET_PROCEEDS_OPENAPI_PATH = "/openapi/produit-net";

const PARAMETER_TEXT: Record<NetProceedsLinkKey, string> = {
  vente: "Prix de vente hypothétique, en dollars. Ce n'est pas un prix de marché observé.",
  hypotheque: "Solde hypothécaire saisi, en dollars.",
  courtage: "fixe pour un montant, taux pour un pourcentage saisi.",
  valeur: "Montant du courtage en dollars, ou pourcentage si courtage=taux.",
  taxe_a: "Pourcentage saisi pour la taxe A sur les honoraires. Vide : aucune taxe ajoutée.",
  taxe_b: "Pourcentage saisi pour la taxe B sur les honoraires. Vide : aucune taxe ajoutée.",
  penalite: "Pénalité hypothécaire connue, en dollars. Vide : elle n'est pas estimée.",
  legal: "Frais légaux saisis, en dollars.",
  autres: "Autres dépenses saisies, en dollars.",
};

export type OpenApiOperation = {
  readonly operationId?: string;
  readonly security?: readonly unknown[];
  readonly responses?: { readonly [status: string]: { readonly description: string } };
};

export type OpenApiParameter = {
  readonly name: string;
  readonly in: "query";
  readonly description: string;
  readonly schema: { readonly type: "string"; readonly enum?: readonly string[] };
};

export type OpenApiDocument = {
  readonly openapi: "3.1.0";
  readonly info: { readonly title: string; readonly version: string; readonly description: string };
  readonly servers: readonly { readonly url: string }[];
  readonly paths: {
    readonly [path: string]: {
      readonly get?: OpenApiOperation;
      readonly post?: OpenApiOperation;
      readonly parameters?: readonly OpenApiParameter[];
    };
  };
};

/** Spécification de lecture. Elle ne décrit aucune création de demande. */
export function buildNetProceedsOpenApi(): OpenApiDocument {
  return {
    openapi: "3.1.0",
    info: {
      title: "Maisons Québec — produit net hypothétique",
      version: "1.0.0",
      description:
        "Lecture seule. Le GET calcule un produit net hypothétique avec le même module que la page. Aucune création de demande n'est décrite.",
    },
    servers: [{ url: CANONICAL_ORIGIN }],
    paths: {
      [NET_PROCEEDS_PAGE_PATH]: {
        get: {
          operationId: "calculateSaleProceeds",
          responses: {
            "200": {
              description: "HTML qui contient le produit net calculé par le module du formulaire. Aucune demande n'est créée.",
            },
          },
        },
        parameters: NET_PROCEEDS_LINK_KEYS.map((name) => ({
          name,
          in: "query" as const,
          description: PARAMETER_TEXT[name],
          schema: name === "courtage" ? { type: "string", enum: ["fixe", "taux"] } : { type: "string" },
        })),
      },
    },
  };
}

export function publicUnauthenticatedLeadPosts(document: OpenApiDocument): string[] {
  const found: string[] = [];
  for (const [path, item] of Object.entries(document.paths)) {
    const post = item.post;
    if (!post) continue;
    const aboutLead = /lead|demande|contact/i.test(`${path} ${post.operationId ?? ""}`);
    const secured = Array.isArray(post.security) && post.security.length > 0;
    if (aboutLead && !secured) found.push(path);
  }
  return found;
}
