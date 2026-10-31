import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CANONICAL_ORIGIN, readSiteUrl } from "./site-url";

describe("readSiteUrl", () => {
  it("utilise l'origine canonique quand SITE_URL est absente", () => {
    assert.equal(readSiteUrl({}).origin, CANONICAL_ORIGIN);
    assert.equal(readSiteUrl({ SITE_URL: "   " }).href, `${CANONICAL_ORIGIN}/`);
  });

  it("accepte l'origine canonique avec ou sans barre finale", () => {
    assert.equal(readSiteUrl({ SITE_URL: "https://maisonsquebec.ca" }).origin, CANONICAL_ORIGIN);
    assert.equal(readSiteUrl({ SITE_URL: "https://maisonsquebec.ca/" }).origin, CANONICAL_ORIGIN);
  });

  it("refuse le domaine au singulier", () => {
    assert.throws(() => readSiteUrl({ SITE_URL: "https://maisonquebec.ca" }), /maisonquebec\.ca/);
    assert.throws(() => readSiteUrl({ SITE_URL: "https://www.maisonquebec.ca" }), /maisonquebec\.ca/);
  });

  it("refuse un autre hôte, http, un chemin et des identifiants", () => {
    assert.throws(() => readSiteUrl({ SITE_URL: "https://www.maisonsquebec.ca" }), /hôte/);
    assert.throws(() => readSiteUrl({ SITE_URL: "http://maisonsquebec.ca" }), /https/);
    assert.throws(() => readSiteUrl({ SITE_URL: "https://maisonsquebec.ca/admin" }), /chemin/);
    assert.throws(() => readSiteUrl({ SITE_URL: "https://user:secret@maisonsquebec.ca" }), /identifiants/);
    assert.throws(() => readSiteUrl({ SITE_URL: "https://maisonsquebec.ca?q=1" }), /requête/);
    assert.throws(() => readSiteUrl({ SITE_URL: "pas une url" }), /invalide/);
  });
});
