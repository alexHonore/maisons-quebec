import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type { AdminRole } from "./admin-access";
import { readStoredSettings, type SettingKey } from "./settings-db";

export const DEMO_JOB_NAME = "reglages.controle_champs_vides";

const REGULATORY_LABELS: Record<"broker_oaciq_permit" | "agency_name" | "agency_permit", string> = {
  broker_oaciq_permit: "permis du courtier",
  agency_name: "nom de l'agence",
  agency_permit: "permis de l'agence",
};

export type JobRun = {
  readonly id: string;
  readonly jobName: string;
  readonly status: "succeeded" | "failed";
  readonly actorRole: AdminRole;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly summary: string;
};

export function describeRegulatoryPresence(stored: Record<SettingKey, string>): string {
  const filled: string[] = [];
  const empty: string[] = [];
  for (const key of Object.keys(REGULATORY_LABELS) as Array<keyof typeof REGULATORY_LABELS>) {
    const label = REGULATORY_LABELS[key];
    if (stored[key].trim() === "") empty.push(label);
    else filled.push(label);
  }
  return [
    "Contrôle des réglages.",
    `Renseignés : ${filled.length > 0 ? filled.join(", ") : "aucun"}.`,
    `Vides : ${empty.length > 0 ? empty.join(", ") : "aucun"}.`,
    "Les valeurs ne sont pas recopiées.",
    "Aucune statistique produite.",
  ].join(" ");
}

export function runSettingsPresenceJob(db: DatabaseSync, actorRole: AdminRole, now = new Date()): JobRun {
  const startedAt = now.toISOString();
  const summary = describeRegulatoryPresence(readStoredSettings(db));
  const run: JobRun = {
    id: randomUUID(),
    jobName: DEMO_JOB_NAME,
    status: "succeeded",
    actorRole,
    startedAt,
    finishedAt: startedAt,
    summary,
  };
  db.prepare(
    `INSERT INTO job_runs (id, job_name, status, actor_role, started_at, finished_at, summary)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(run.id, run.jobName, run.status, run.actorRole, run.startedAt, run.finishedAt, run.summary);
  return run;
}

export function listJobRuns(db: DatabaseSync): JobRun[] {
  return db
    .prepare(
      `SELECT id, job_name, status, actor_role, started_at, finished_at, summary
       FROM job_runs ORDER BY started_at DESC, id DESC`,
    )
    .all()
    .map((row) => ({
      id: String(row.id),
      jobName: String(row.job_name),
      status: row.status === "failed" ? "failed" : "succeeded",
      actorRole: String(row.actor_role) as AdminRole,
      startedAt: String(row.started_at),
      finishedAt: String(row.finished_at),
      summary: String(row.summary),
    }));
}
