import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

export const L0_VERSION = "1.0.0";
export const L0_RELATIVE_PATH = "prompts/editorial/L0-core.fr-CA.md";
export const L0_SHA256 = "9d4902eb6dec6db001d18b9d35373619d254adcda243942ea114b1688332b4d2";

export function readL0Prompt(root = process.cwd()): { version: typeof L0_VERSION; text: string; sha256: string } {
  const text = readFileSync(path.join(root, L0_RELATIVE_PATH), "utf8");
  return {
    version: L0_VERSION,
    text,
    sha256: createHash("sha256").update(text).digest("hex"),
  };
}
