import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { REGULATORY_EMPTY_LABEL } from "./regulatory-identity";
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

    const missingSource = assessContentPage({ ...fields, status: "published", sourceNote: REGULATORY_EMPTY_LABEL });
    assert.equal(missingSource.indexable, false);
    assert.equal(missingSource.reason, "source_missing");

    const example = assessContentPage({ ...fields, status: "published", example: true });
    assert.equal(example.visible, true);
    assert.equal(example.indexable, false);
    assert.equal(example.reason, "example");

    const figure = assessContentPage({ ...fields, status: "published", body: longBody("Un montant de 450000 est écrit ici.") });
    assert.equal(figure.visible, true);
    assert.equal(figure.indexable, false);
    assert.equal(figure.reason, "unverified_figure");

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
