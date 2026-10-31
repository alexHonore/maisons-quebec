import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { AUTOMATION_TASK_NAME } from "../domain/automation";
import type { AdminRole } from "./admin-access";
import { recordAdminAudit } from "./admin-audit";
import { DEMO_JOB_NAME, runSettingsPresenceJob } from "./job-journal";

export class JobError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

export type QueueJob = {
  readonly id: string;
  readonly jobName: string;
  readonly status: "queued" | "running" | "succeeded" | "failed";
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly actorRole: AdminRole;
  readonly lastError: string | null;
};

type QueueRow = {
  id: string;
  job_name: string;
  status: string;
  attempts: number;
  max_attempts: number;
  actor_role: string;
  last_error: string | null;
};

function toJob(row: QueueRow): QueueJob {
  const status = row.status === "running" || row.status === "succeeded" || row.status === "failed" ? row.status : "queued";
  return {
    id: row.id,
    jobName: row.job_name,
    status,
    attempts: Number(row.attempts),
    maxAttempts: Number(row.max_attempts),
    actorRole: row.actor_role as AdminRole,
    lastError: row.last_error,
  };
}

function safeErrorCode(error: unknown): string {
  if (error instanceof JobError && /^[a-z0-9_]{1,40}$/.test(error.code)) return error.code;
  return "erreur_interne";
}

export function enqueueJob(
  db: DatabaseSync,
  input: { jobName: string; actorId: string; actorRole: AdminRole; now: Date; maxAttempts?: number },
): { id: string } {
  const id = randomUUID();
  const stamp = input.now.toISOString();
  db.prepare(
    `INSERT INTO job_queue (id, job_name, status, attempts, max_attempts, actor_role, available_at, last_error, created_at, updated_at)
     VALUES (?, ?, 'queued', 0, ?, ?, ?, NULL, ?, ?)`,
  ).run(id, input.jobName, input.maxAttempts ?? 3, input.actorRole, stamp, stamp, stamp);
  recordAdminAudit(db, {
    actorId: input.actorId,
    actorRole: input.actorRole,
    action: "job.enqueued",
    subjectId: id,
    at: input.now,
  });
  return { id };
}

export function listQueueJobs(db: DatabaseSync): QueueJob[] {
  return db
    .prepare(
      `SELECT id, job_name, status, attempts, max_attempts, actor_role, last_error
       FROM job_queue ORDER BY created_at ASC, id ASC`,
    )
    .all()
    .map((row) => toJob(row as QueueRow));
}

export type JobHandler = (db: DatabaseSync, job: QueueJob) => void;

export function demoJobHandler(db: DatabaseSync, job: QueueJob, now = new Date()): void {
  if (job.jobName !== DEMO_JOB_NAME) throw new JobError("job_inconnu");
  runSettingsPresenceJob(db, job.actorRole, now);
}

function runAutomationAdminTask(job: QueueJob): void {
  if (job.jobName !== AUTOMATION_TASK_NAME) throw new JobError("job_inconnu");
}

export function executeNextJob(
  db: DatabaseSync,
  input: { actorId: string; now: Date; handlers?: Record<string, JobHandler> },
): { outcome: "idle" } | { outcome: "succeeded"; id: string } | { outcome: "failed"; id: string; errorCode: string } {
  const row = db
    .prepare(
      `SELECT id, job_name, status, attempts, max_attempts, actor_role, last_error
       FROM job_queue WHERE status = 'queued' AND available_at <= ?
       ORDER BY created_at ASC, id ASC LIMIT 1`,
    )
    .get(input.now.toISOString()) as QueueRow | undefined;
  if (!row) return { outcome: "idle" };
  const nextAttempts = Number(row.attempts) + 1;
  db.prepare("UPDATE job_queue SET status = 'running', attempts = ?, updated_at = ? WHERE id = ?").run(
    nextAttempts,
    input.now.toISOString(),
    row.id,
  );
  const job = toJob({ ...row, status: "running", attempts: nextAttempts });
  const handlers = input.handlers ?? {
    [DEMO_JOB_NAME]: (database, current) => demoJobHandler(database, current, input.now),
    [AUTOMATION_TASK_NAME]: (_database, current) => runAutomationAdminTask(current),
  };
  try {
    const handler = handlers[job.jobName];
    if (!handler) throw new JobError("job_inconnu");
    handler(db, job);
    db.prepare("UPDATE job_queue SET status = 'succeeded', last_error = NULL, updated_at = ? WHERE id = ?").run(
      input.now.toISOString(),
      job.id,
    );
    recordAdminAudit(db, {
      actorId: input.actorId,
      actorRole: job.actorRole,
      action: "job.executed",
      subjectId: job.id,
      at: input.now,
    });
    return { outcome: "succeeded", id: job.id };
  } catch (error) {
    const errorCode = safeErrorCode(error);
    db.prepare("UPDATE job_queue SET status = 'failed', last_error = ?, updated_at = ? WHERE id = ?").run(
      errorCode,
      input.now.toISOString(),
      job.id,
    );
    recordAdminAudit(db, {
      actorId: input.actorId,
      actorRole: job.actorRole,
      action: "job.failed",
      subjectId: job.id,
      at: input.now,
    });
    return { outcome: "failed", id: job.id, errorCode };
  }
}

export function retryFailedJob(
  db: DatabaseSync,
  input: { id: string; actorId: string; actorRole: AdminRole; now: Date },
): { ok: true } | { ok: false; reason: "missing" | "not_failed" | "attempts_exhausted" } {
  const row = db
    .prepare("SELECT id, job_name, status, attempts, max_attempts, actor_role, last_error FROM job_queue WHERE id = ?")
    .get(input.id) as QueueRow | undefined;
  if (!row) return { ok: false, reason: "missing" };
  if (row.status !== "failed") return { ok: false, reason: "not_failed" };
  if (Number(row.attempts) >= Number(row.max_attempts)) return { ok: false, reason: "attempts_exhausted" };
  db.prepare("UPDATE job_queue SET status = 'queued', available_at = ?, updated_at = ? WHERE id = ?").run(
    input.now.toISOString(),
    input.now.toISOString(),
    input.id,
  );
  recordAdminAudit(db, {
    actorId: input.actorId,
    actorRole: input.actorRole,
    action: "job.retried",
    subjectId: input.id,
    at: input.now,
  });
  return { ok: true };
}
