import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { REGULATORY_EMPTY_LABEL } from "./regulatory-identity";
import { detectStoredImage, mediaAssociationAllowed, parseMediaAsset, requestImageProvider } from "./media-asset";

describe("fiche média", () => {
  it("exige une licence, un auteur et une source, et refuse l'association sans licence", () => {
    const ready = parseMediaAsset({
      title: "Illustration saisie",
      license: "CC BY 4.0",
      author: "Auteur saisi",
      source: "Fiche fournie pour l'essai",
    });
    assert.equal(ready.ok, true);
    assert.equal(parseMediaAsset({ title: "Illustration", license: "", author: "Auteur saisi", source: "Source saisie" }).ok, false);
    assert.equal(parseMediaAsset({ title: "Illustration", license: REGULATORY_EMPTY_LABEL, author: "Auteur saisi", source: "Source saisie" }).ok, false);
    assert.equal(parseMediaAsset({ title: "Illustration", license: "CC BY 4.0", author: "", source: "Source saisie" }).ok, false);
    assert.equal(parseMediaAsset({ title: "Illustration", license: "CC BY 4.0", author: "Auteur saisi", source: "" }).ok, false);
    assert.equal(mediaAssociationAllowed(""), false);
    assert.equal(mediaAssociationAllowed(REGULATORY_EMPTY_LABEL), false);
    assert.equal(mediaAssociationAllowed("CC BY 4.0"), true);
  });

  it("n'appelle pas les fournisseurs quand les clés sont vides, et n'enregistre aucune image", async () => {
    let called = 0;
    const transport = async () => {
      called += 1;
      return { status: 200 };
    };
    for (const apiKey of ["", "  ", undefined]) {
      const result = requestImageProvider({ apiKey, transport });
      assert.deepEqual(result, { ok: false, message: "à connecter", recordedImage: false });
    }
    const present = requestImageProvider({ apiKey: "cle-presente-non-utilisee", transport });
    assert.deepEqual(present, { ok: false, message: "non branché", recordedImage: false });
    assert.equal(called, 0);
  });

  it("reconnaît un en-tête d'image et refuse un autre fichier", () => {
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]);
    assert.equal(detectStoredImage(png)?.contentType, "image/png");
    const html = Uint8Array.from([0x3c, 0x68, 0x74, 0x6d, 0x6c, 0, 0, 0, 0, 0, 0, 0]);
    assert.equal(detectStoredImage(html), null);
  });
});
