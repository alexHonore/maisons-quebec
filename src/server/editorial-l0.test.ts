import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { L0_SHA256, L0_VERSION, readL0Prompt } from "./editorial-l0";
import { requestEditorialGeneration } from "./editorial-generation";
import { migrateUp } from "./settings-db";

describe("prompt L0", () => {
  it("garde le texte 1.0.0 et un hash déterministe", () => {
    const file = readFileSync("prompts/editorial/L0-core.fr-CA.md", "utf8");
    assert.equal(file.startsWith("L0 — MAISONS QUÉBEC | POLITIQUE ÉDITORIALE FONDAMENTALE\n"), true);
    assert.match(file, /^Version initiale : 1\.0\.0$/m);
    assert.match(file, /Distinge explicitement les sources consultées maintenant/);
    assert.match(file, /pas pour remplir des pages ou manipuler un classement\.\n$/);
    const hash = createHash("sha256").update(file).digest("hex");
    assert.equal(hash, L0_SHA256);
    const loaded = readL0Prompt();
    assert.equal(loaded.version, L0_VERSION);
    assert.equal(loaded.sha256, hash);
    assert.equal(loaded.text, file);
  });

  it("ne génère rien et n'appelle personne sans clé", () => {
    const db = new DatabaseSync(":memory:");
    migrateUp(db);
    let called = false;
    const result = requestEditorialGeneration({
      apiKey: "  ",
      transport: async () => {
        called = true;
        return { text: "Article inventé qui ne doit pas exister." };
      },
    });
    assert.deepEqual(result, { ok: false, message: "à connecter", wroteArticle: false });
    assert.equal(called, false);
    assert.equal(db.prepare("SELECT COUNT(*) AS total FROM content_pages").get()?.total, 0);
    const withKey = requestEditorialGeneration({
      apiKey: "cle-présente-mais-non-utilisée",
      transport: async () => {
        called = true;
        return { text: "Article inventé" };
      },
    });
    assert.equal(withKey.message, "non branchée");
    assert.equal(withKey.wroteArticle, false);
    assert.equal(called, false);
    db.close();
  });
});
