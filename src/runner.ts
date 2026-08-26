import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sha256 } from "./digest.ts";
import type { DutyEvidence, DutySpec } from "./types.ts";

const ALLOW = ["PATH", "HOME", "TMPDIR", "TMP", "TEMP", "LANG", "LC_ALL", "USER", "LOGNAME"];

function childEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { NODE_ENV: "test", TERM: "dumb" };
  for (const k of ALLOW) {
    if (process.env[k]) env[k] = process.env[k];
  }
  return env;
}

export function materialize(repoDir: string, sha: string): string {
  const dest = mkdtempSync(join(tmpdir(), "cg-subject-"));
  const archived = spawnSync("git", ["-C", repoDir, "archive", sha], {
    encoding: "buffer",
    maxBuffer: 20_000_000,
    timeout: 30_000,
  });
  if (archived.status !== 0) {
    rmSync(dest, { recursive: true, force: true });
    throw new Error(`git archive failed: ${archived.stderr?.toString() || "unknown"}`);
  }
  const tar = spawnSync("tar", ["-x", "-C", dest], {
    input: archived.stdout,
    timeout: 30_000,
  });
  if (tar.status !== 0) {
    rmSync(dest, { recursive: true, force: true });
    throw new Error("tar extract failed");
  }
  return dest;
}

function resolveArgv(argv: string[]): string[] {
  const out = [...argv];
  if (out[0] === "node") out[0] = process.execPath;
  return out;
}

export function runDuty(opts: {
  repo: string;
  repoDir: string;
  workDir: string;
  baseSha: string;
  headSha: string;
  treeSha: string;
  policyDigest: string;
  verifier: string;
  duty: DutySpec;
}): DutyEvidence {
  const argv = resolveArgv(opts.duty.argv);
  const startedAt = new Date().toISOString();
  const ran = spawnSync(argv[0], argv.slice(1), {
    cwd: opts.workDir,
    env: childEnv(),
    encoding: "utf8",
    timeout: opts.duty.timeoutMs,
    maxBuffer: 1_000_000,
    shell: false,
  });
  const endedAt = new Date().toISOString();
  const timedOut =
    Boolean(ran.error) &&
    ((ran.error as NodeJS.ErrnoException).code === "ETIMEDOUT" ||
      /TIMEDOUT/i.test(String(ran.error)));
  const crashed = Boolean(ran.error) && !timedOut;
  let exitCode: number | null = typeof ran.status === "number" ? ran.status : null;
  if (timedOut) exitCode = null;
  const stdout = ran.stdout || "";
  const stderr = ran.stderr || String(ran.error || "");
  let verdict: DutyEvidence["verdict"] = "fail";
  if (timedOut || crashed) verdict = "incomplete";
  else if (exitCode === 0) verdict = "pass";
  else verdict = "fail";
  return {
    repo: opts.repo,
    baseSha: opts.baseSha,
    headSha: opts.headSha,
    treeSha: opts.treeSha,
    policyDigest: opts.policyDigest,
    verifier: opts.verifier,
    dutyId: opts.duty.id,
    argv: opts.duty.argv,
    startedAt,
    endedAt,
    exitCode,
    stdoutDigest: sha256(stdout),
    stderrDigest: sha256(stderr),
    timedOut,
    crashed,
    verdict,
    committedDigest: "",
    workspaceBeforeDigest: "",
    workspaceAfterDigest: "",
  };
}

export function writeFreshOutput(dir: string, name: string, body: string): string {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, name);
  writeFileSync(path, body, "utf8");
  return path;
}

export function removeWork(dir: string): void {
  spawnSync("chmod", ["-R", "u+w", dir], { timeout: 10_000 });
  rmSync(dir, { recursive: true, force: true });
}
