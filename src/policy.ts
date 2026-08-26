import { readFileSync } from "node:fs";
import type { Policy } from "./types.ts";
import { sha256 } from "./digest.ts";

export const SCHEMA = "node-green-subtraction-v0";

export function loadPolicy(path: string): { policy: Policy; raw: string; digest: string } {
  const raw = readFileSync(path, "utf8");
  const policy = parsePolicy(raw);
  return { policy, raw, digest: sha256(raw) };
}

export function parsePolicy(raw: string): Policy {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    throw new Error(`policy parse failed: ${(err as Error).message}`);
  }
  if (!data || typeof data !== "object") throw new Error("policy is not an object");
  const p = data as Policy;
  if (p.schemaVersion !== SCHEMA) throw new Error(`unsupported policy schema ${p.schemaVersion}`);
  if (!Array.isArray(p.duties) || p.duties.length === 0) throw new Error("policy has no duties");
  for (const d of p.duties) {
    if (!d.id || !Array.isArray(d.argv) || d.argv.length === 0) {
      throw new Error(`duty ${d.id} missing argv array`);
    }
    if (d.argv.some((a) => typeof a !== "string")) throw new Error(`duty ${d.id} argv must be strings`);
    if (d.argv.some((a) => a.includes("\0"))) throw new Error(`duty ${d.id} argv contains NUL`);
    if (!Number.isFinite(d.timeoutMs) || d.timeoutMs <= 0) throw new Error(`duty ${d.id} bad timeout`);
  }
  if (!Array.isArray(p.protectedPaths) || p.protectedPaths.length === 0) {
    throw new Error("policy missing protectedPaths");
  }
  if (!Array.isArray(p.evidenceSurface)) throw new Error("policy missing evidenceSurface");
  return p;
}

export function policyDigest(raw: string): string {
  return sha256(raw);
}
