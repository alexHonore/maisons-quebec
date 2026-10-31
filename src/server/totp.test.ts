import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decodeBase32, generateTotp, verifyTotp } from "./totp";

const RFC_SECRET = new TextEncoder().encode("12345678901234567890");

describe("TOTP", () => {
  it("reproduit les vecteurs SHA-1 du RFC 6238", () => {
    const vectors: Array<[number, string]> = [
      [59, "287082"],
      [1111111109, "081804"],
      [1111111111, "050471"],
      [1234567890, "005924"],
      [2000000000, "279037"],
      [20000000000, "353130"],
    ];
    for (const [seconds, code] of vectors) {
      assert.equal(generateTotp(RFC_SECRET, seconds * 1000), code);
    }
  });

  it("accepte le code courant et refuse un code arbitraire", () => {
    const now = 1_700_000_000_000;
    const code = generateTotp(RFC_SECRET, now);
    assert.equal(verifyTotp(RFC_SECRET, code, now), true);
    assert.equal(verifyTotp(RFC_SECRET, "000000", now), false);
    assert.equal(verifyTotp(RFC_SECRET, "12345", now), false);
  });

  it("décode un secret base32", () => {
    const decoded = decodeBase32("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    assert.ok(decoded);
    assert.equal(new TextDecoder().decode(decoded), "12345678901234567890");
    assert.equal(decodeBase32("!!!"), null);
  });
});
