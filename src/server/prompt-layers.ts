import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type { AdminRole } from "./admin-access";
import { recordAdminAudit } from "./admin-audit";
import { roleCan } from "./admin-permissions";

export type PromptLayerName = "L1" | "L2";

export type PromptLayerVersion = {
  readonly id: string;
  readonly layer: PromptLayerName;
  readonly versionNumber: number;
  readonly body: string;
  readonly createdAt: string;
};

function isLayer(value: string): value is PromptLayerName {
  return value === "L1" || value === "L2";
}

export function savePromptLayer(
  db: DatabaseSync,
  input: { actorId: string; actorRole: AdminRole; layer: string; body: string; now: Date },
): { ok: true; id: string; versionNumber: number } | { ok: false; reason: "forbidden" | "invalid_layer" | "invalid" } {
  if (!roleCan(input.actorRole, "prompts.write")) return { ok: false, reason: "forbidden" };
  if (!isLayer(input.layer)) return { ok: false, reason: "invalid_layer" };
  const body = input.body.replace(/\r\n/g, "\n").trim();
  if (body.length < 2 || body.length > 20000) return { ok: false, reason: "invalid" };
  const current = db.prepare("SELECT COALESCE(MAX(version_number), 0) AS total FROM prompt_layers WHERE layer = ?").get(input.layer);
  const versionNumber = Number(current?.total ?? 0) + 1;
  const id = randomUUID();
  const now = input.now.toISOString();
  db.prepare(
    `INSERT INTO prompt_layers (id, layer, version_number, body, created_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, input.layer, versionNumber, body, now, input.actorId);
  recordAdminAudit(db, {
    actorId: input.actorId,
    actorRole: input.actorRole,
    action: "prompt.layer_saved",
    subjectId: id,
    at: input.now,
  });
  return { ok: true, id, versionNumber };
}

export function listPromptLayers(db: DatabaseSync, layer: PromptLayerName): PromptLayerVersion[] {
  return db
    .prepare(
      `SELECT id, layer, version_number, body, created_at FROM prompt_layers
       WHERE layer = ? ORDER BY version_number ASC`,
    )
    .all(layer)
    .map((row) => ({
      id: String(row.id),
      layer: row.layer === "L2" ? "L2" : "L1",
      versionNumber: Number(row.version_number),
      body: String(row.body),
      createdAt: String(row.created_at),
    }));
}

export function currentPromptLayer(db: DatabaseSync, layer: PromptLayerName): PromptLayerVersion | null {
  const versions = listPromptLayers(db, layer);
  return versions.at(-1) ?? null;
}
