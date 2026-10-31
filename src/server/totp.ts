import { createHmac } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function encodeBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      output += ALPHABET[(value >> bits) & 31];
    }
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function decodeBase32(value: string): Uint8Array | null {
  const cleaned = value.replace(/[\s=]/g, "").toUpperCase();
  if (cleaned.length === 0 || !/^[A-Z2-7]+$/.test(cleaned)) return null;
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of cleaned) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) return null;
    buffer = (buffer << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return Uint8Array.from(bytes);
}

/** TOTP SHA-1, 6 chiffres, pas de 30 secondes. `unixMs` est l'horloge injectée. */
export function generateTotp(secret: Uint8Array, unixMs: number, stepSeconds = 30): string {
  if (!Number.isFinite(unixMs) || secret.byteLength === 0) {
    throw new RangeError("secret ou horloge TOTP invalide");
  }
  const counter = Math.floor(unixMs / 1000 / stepSeconds);
  const counterBytes = Buffer.alloc(8);
  counterBytes.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", Buffer.from(secret)).update(counterBytes).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}

export function verifyTotp(secret: Uint8Array, code: string, unixMs: number, window = 1): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  for (let drift = -window; drift <= window; drift += 1) {
    const at = unixMs + drift * 30_000;
    if (generateTotp(secret, at) === code) return true;
  }
  return false;
}
