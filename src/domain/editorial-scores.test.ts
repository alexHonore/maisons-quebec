import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MIN_INDEXABLE_BODY_LENGTH } from "./content-page";
import { RUBRIC_VERSION, SCORE_PUBLICATION_MINIMUM, scoreContentPage } from "./editorial-scores";

const filler = "Cette note decrit une facon de lire. Elle reste generale. ";
const method = "Cette page explique une méthode de lecture. Elle ne donne aucun prix et aucune statistique. ";

function repeat(sentence: string): string {
  let body = "";
  while (body.length < MIN_INDEXABLE_BODY_LENGTH) body += sentence;
  return body.trim();
}

const readyTail = "\n\nCette méthode ne constitue pas un prix de marché. Elle concerne une personne qui veut vendre à Québec. Voir /vendre/calculateur-produit-net.";

describe("scores éditoriaux", () => {
  it("calcule trois notes reproductibles et refuse un seuil manquant", () => {
    const weak = scoreContentPage({
      title: "Note",
      description: "Resume court.",
      body: repeat(filler),
      sourceNote: "Note de méthode rédigée pour Maisons Québec.",
      example: false,
    });
    const strong = scoreContentPage({
      title: "Lire une méthode",
      description: "Cette description présente une méthode de lecture, sans chiffre de marché.",
      body: `${repeat(method)}${readyTail}`,
      sourceNote: "Note de méthode rédigée pour Maisons Québec.",
      example: false,
    });
    const again = scoreContentPage({
      title: "Lire une méthode",
      description: "Cette description présente une méthode de lecture, sans chiffre de marché.",
      body: `${repeat(method)}${readyTail}`,
      sourceNote: "Note de méthode rédigée pour Maisons Québec.",
      example: false,
    });
    assert.equal(weak.rubricVersion, RUBRIC_VERSION);
    assert.equal(weak.seo, weak.seoCriteria.reduce((sum, item) => sum + item.earned, 0));
    assert.equal(weak.passed, false);
    assert.equal(weak.seo < SCORE_PUBLICATION_MINIMUM, true);
    assert.equal(weak.citability < SCORE_PUBLICATION_MINIMUM, true);
    assert.equal(weak.conversion < SCORE_PUBLICATION_MINIMUM, true);
    assert.deepEqual(strong, again);
    assert.equal(strong.passed, true);
    assert.equal(strong.seo >= SCORE_PUBLICATION_MINIMUM, true);
    assert.equal(strong.citability >= SCORE_PUBLICATION_MINIMUM, true);
    assert.equal(strong.conversion >= SCORE_PUBLICATION_MINIMUM, true);
    assert.equal(strong.seo, 100);
    assert.equal(strong.citability, 100);
    assert.equal(strong.conversion, 100);
  });
});
