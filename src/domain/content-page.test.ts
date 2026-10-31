import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CONTENT_INDEX_RULE,
  MIN_INDEXABLE_BODY_LENGTH,
  assessContentPage,
  parseContentDraft,
} from "./content-page";

const sentence = "Cette page explique une méthode de lecture. Elle ne donne aucun prix et aucune statistique. ";

function longBody(extra = ""): string {
  let body = "";
  while (body.length < MIN_INDEXABLE_BODY_LENGTH) body += sentence;
  return `${body}${extra}`;
}

const source = "Note de méthode rédigée pour Maisons Québec.";

describe("pages de contenu", () => {
  it("documente le noindex des pages faibles et l'index des pages suffisantes", () => {
    assert.match(CONTENT_INDEX_RULE, /noindex|non index/);
    const fields = {
      title: "Lire une méthode",
      description: "Une méthode sans chiffre de marché.",
      body: longBody(),
      sourceNote: source,
      example: false,
    };
    const draft = assessContentPage({ ...fields, status: "draft" });
    assert.equal(draft.visible, false);
    assert.equal(draft.indexable, false);
    assert.equal(draft.robots, "noindex, nofollow");
    assert.equal(draft.reason, "draft");

    const thin = assessContentPage({ ...fields, status: "published", body: "Une note courte." });
    assert.equal(thin.visible, true);
    assert.equal(thin.indexable, false);
    assert.equal(thin.robots, "noindex, nofollow");
    assert.equal(thin.reason, "thin");

    const example = assessContentPage({ ...fields, status: "published", example: true });
    assert.equal(example.visible, true);
    assert.equal(example.indexable, false);
    assert.equal(example.reason, "example");

    const dated = assessContentPage({
      ...fields,
      status: "published",
      sourceNote: "",
      body: longBody(" La note date de 2024. Le repère civique est le 12 rue Principale. La longueur se décrit en caractères."),
    });
    assert.equal(dated.indexable, true);
    assert.equal(dated.reason, "indexable");

    const price = assessContentPage({
      ...fields,
      status: "published",
      sourceNote: "",
      body: longBody(" Le prix cité pour la règle est de 450 000 $."),
    });
    assert.equal(price.visible, true);
    assert.equal(price.indexable, false);
    assert.equal(price.robots, "noindex, nofollow");
    assert.equal(price.reason, "unsourced_market_claim");

    const percent = assessContentPage({
      ...fields,
      status: "published",
      sourceNote: "",
      body: longBody(" Le taux indiqué est de 5 %."),
    });
    assert.equal(percent.reason, "unsourced_market_claim");

    const sales = assessContentPage({
      ...fields,
      status: "published",
      sourceNote: "",
      body: longBody(" On avance 1200 ventes sans dire d'où vient le décompte."),
    });
    assert.equal(sales.reason, "unsourced_market_claim");

    const sourcedPrice = assessContentPage({
      ...fields,
      status: "published",
      sourceNote: "Source nommée par l'auteur de la page.",
      body: longBody(" Le prix cité pour la règle est de 450 000 $."),
    });
    assert.equal(sourcedPrice.indexable, true);

    const enough = assessContentPage({ ...fields, status: "published" });
    assert.equal(enough.visible, true);
    assert.equal(enough.indexable, true);
    assert.equal(enough.robots, "index, follow");
    assert.equal(enough.reason, "indexable");
    assert.equal(JSON.stringify(enough).includes("$"), false);
  });

  it("refuse un slug ou un titre inutilisable", () => {
    assert.equal(parseContentDraft({
      slug: "Limoilou prix",
      title: "Titre",
      description: "Description assez claire.",
      body: "",
      sourceNote: "",
      example: false,
    }).ok, false);
    const parsed = parseContentDraft({
      slug: "Lire-Une-Methode",
      title: "Lire une méthode",
      description: "Description assez claire.",
      body: "  texte  ",
      sourceNote: "  ",
      example: true,
    });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.value.slug, "lire-une-methode");
    assert.equal(parsed.value.example, true);
  });
});
