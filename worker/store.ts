import { mkdirSync, readFileSync, existsSync, statSync, chmodSync, lstatSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { resolve, join } from "node:path";
import { z } from "zod";
import { Proposal, type Job } from "./contracts.js";

const short = z.string().max(2000);
const id = z.string().min(1).max(160);
const date = z.string().datetime();
const control = z
  .object({ id, label: short, tag: short, type: short, safe: z.boolean(), expected: short })
  .strict();
const evidence = z
  .object({ observationId: id, actionResultId: id, controlId: z.string().max(160) })
  .strict();
const step = z
  .object({ instruction: short, targetControl: short, expectedResult: short, evidence })
  .strict();
const tutorial = z
  .object({
    schemaVersion: z.literal(1),
    id,
    title: short,
    goal: short,
    website: short,
    startingPage: short,
    prerequisites: z.array(short).max(20),
    steps: z.array(step).max(12),
    beginnerInstructions: z.string().max(30000),
    refresherInstructions: short,
    verificationStatus: z.enum(["Verified read-only", "Verified in sandbox"]),
    lastVerifiedAt: date,
    sourceRunId: id,
    generator: z.enum(["Template-generated", "AI evidence-grounded"]),
  })
  .strict();
export const persistedJobSchema = z
  .object({
    id: z.string().uuid(),
    url: z.string().url().max(2048),
    mode: z.enum(["read-only", "sandbox"]),
    planner: z.enum(["ai", "deterministic"]),
    status: z.enum(["queued", "running", "completed", "partial", "failed", "cancelled"]),
    startedAt: date,
    completedAt: date.optional(),
    events: z.array(short).max(100),
    observations: z
      .array(
        z
          .object({
            id,
            url: short,
            title: short,
            observedAt: date,
            controls: z.array(control).max(60),
            state: short,
          })
          .strict(),
      )
      .max(24),
    traces: z
      .array(
        z
          .object({
            id,
            observationId: id,
            action: Proposal,
            label: short,
            status: z.enum(["verified", "failed", "blocked"]),
            before: short,
            after: short,
            reason: short,
          })
          .strict(),
      )
      .max(12),
    tutorials: z.array(tutorial).max(10),
    error: short.optional(),
  })
  .strict();
const snapshot = z
  .object({ schemaVersion: z.literal(1), jobs: z.array(persistedJobSchema).max(50) })
  .strict();
const maxBytes = 16_000_000;
/** Real SQLite evidence repository. Raw audio, provider keys and browser profiles are never stored. */
export class JobStore {
  private db: DatabaseSync;
  readonly persistent: boolean;
  constructor(directory?: string) {
    this.persistent = Boolean(directory);
    let file = ":memory:";
    let legacy: string | undefined;
    if (directory) {
      const folder = resolve(directory);
      mkdirSync(folder, { recursive: true, mode: 0o700 });
      file = join(folder, "webguide.sqlite");
      legacy = join(folder, "jobs.json");
      if (
        existsSync(file) &&
        (lstatSync(file).isSymbolicLink() || statSync(file).size > 64_000_000)
      )
        throw new Error("Evidence database is not a bounded regular file");
    }
    this.db = new DatabaseSync(file, { enableForeignKeyConstraints: true, allowExtension: false });
    try {
      if (directory && process.platform !== "win32") chmodSync(file, 0o600);
      this.db.exec(`
        PRAGMA busy_timeout=5000;
        PRAGMA journal_mode=DELETE;
        PRAGMA secure_delete=ON;
        PRAGMA trusted_schema=OFF;
        PRAGMA max_page_count=16000;
        CREATE TABLE IF NOT EXISTS store_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;
        CREATE TABLE IF NOT EXISTS task_sessions (
          id TEXT PRIMARY KEY, status TEXT NOT NULL, started_at TEXT NOT NULL,
          completed_at TEXT, payload_json TEXT NOT NULL CHECK(json_valid(payload_json))
        ) STRICT;
        CREATE TABLE IF NOT EXISTS task_steps (
          session_id TEXT NOT NULL REFERENCES task_sessions(id) ON DELETE CASCADE,
          position INTEGER NOT NULL CHECK(position>=0), payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
          PRIMARY KEY(session_id, position)
        ) STRICT;
        CREATE TABLE IF NOT EXISTS interactions (
          session_id TEXT NOT NULL REFERENCES task_sessions(id) ON DELETE CASCADE,
          position INTEGER NOT NULL CHECK(position>=0), message TEXT NOT NULL,
          PRIMARY KEY(session_id, position)
        ) STRICT;
        PRAGMA user_version=1;
      `);
      // The unchanged legacy file is a recovery copy. A transaction marker prevents resurrection after deletion.
      if (
        !this.db.prepare("SELECT value FROM store_metadata WHERE key=?").get("legacy_import_v1")
      ) {
        let imported: Job[] = [];
        if (legacy && existsSync(legacy)) {
          if (lstatSync(legacy).isSymbolicLink() || statSync(legacy).size > maxBytes)
            throw new Error("Legacy evidence must be a bounded regular file");
          imported = snapshot.parse(JSON.parse(readFileSync(legacy, "utf8"))).jobs as Job[];
        }
        this.db.exec("BEGIN IMMEDIATE");
        try {
          if (
            imported.length &&
            Number(this.db.prepare("SELECT count(*) AS count FROM task_sessions").get()!.count) !==
              0
          )
            throw new Error("Cannot import legacy evidence over existing SQLite sessions");
          this.insert(imported);
          this.db
            .prepare("INSERT INTO store_metadata(key,value) VALUES(?,?)")
            .run("legacy_import_v1", "complete");
          this.db.exec("COMMIT");
        } catch (error) {
          this.db.exec("ROLLBACK");
          throw error;
        }
      }
    } catch (error) {
      this.db.close();
      throw error;
    }
  }
  private insert(jobs: Job[]) {
    const session = this.db.prepare(
      "INSERT INTO task_sessions(id,status,started_at,completed_at,payload_json) VALUES(?,?,?,?,?)",
    );
    const step = this.db.prepare(
      "INSERT INTO task_steps(session_id,position,payload_json) VALUES(?,?,?)",
    );
    const event = this.db.prepare(
      "INSERT INTO interactions(session_id,position,message) VALUES(?,?,?)",
    );
    for (const job of jobs) {
      const { traces, events, ...payload } = job;
      session.run(
        job.id,
        job.status,
        job.startedAt,
        job.completedAt ?? null,
        JSON.stringify(payload),
      );
      traces.forEach((trace, position) => step.run(job.id, position, JSON.stringify(trace)));
      events.forEach((message, position) => event.run(job.id, position, message));
    }
  }
  load(retention: number): Map<string, Job> {
    const rows = this.db
      .prepare("SELECT id,payload_json FROM task_sessions ORDER BY started_at,id LIMIT 51")
      .all();
    const steps = this.db.prepare(
      "SELECT payload_json FROM task_steps WHERE session_id=? ORDER BY position LIMIT 13",
    );
    const events = this.db.prepare(
      "SELECT message FROM interactions WHERE session_id=? ORDER BY position LIMIT 101",
    );
    const raw = rows.map((row) => ({
      ...JSON.parse(String(row.payload_json)),
      traces: steps.all(String(row.id)).map((step) => JSON.parse(String(step.payload_json))),
      events: events.all(String(row.id)).map((event) => String(event.message)),
    }));
    const encoded = JSON.stringify(raw);
    if (Buffer.byteLength(encoded) > maxBytes)
      throw new Error("Worker evidence store exceeds limit");
    const parsed = snapshot.parse({ schemaVersion: 1, jobs: raw });
    const jobs = new Map<string, Job>();
    for (const entry of parsed.jobs) {
      const job = entry as Job;
      if (["queued", "running"].includes(job.status)) {
        job.status = "cancelled";
        job.completedAt = new Date().toISOString();
        job.error = "Worker restarted before this job completed. Start a new exploration.";
      }
      if (job.completedAt && Date.now() - Date.parse(job.completedAt) > retention) continue;
      jobs.set(job.id, job);
    }
    // Retention and restart cancellation must themselves survive another restart.
    this.save(jobs);
    return jobs;
  }
  save(jobs: Map<string, Job>): void {
    const value = snapshot.parse({ schemaVersion: 1, jobs: [...jobs.values()] });
    if (new Set(value.jobs.map((job) => job.id)).size !== value.jobs.length)
      throw new Error("Duplicate evidence session");
    if (Buffer.byteLength(JSON.stringify(value)) > maxBytes)
      throw new Error("Worker evidence store exceeds limit");
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db.exec("DELETE FROM task_sessions");
      this.insert(value.jobs as Job[]);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  close() {
    this.db.close();
  }
}
