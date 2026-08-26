import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { sha256 } from "./digest.ts";
import { listFiles, showFile } from "./git.ts";
import type { Policy } from "./types.ts";

export function surfacePaths(repoDir: string, sha: string, policy: Policy): string[] {
  const files = listFiles(repoDir, sha);
  const wanted = new Set<string>([...policy.protectedPaths]);
  for (const p of files) {
    if (
      policy.evidenceSurface.some((rule) =>
        rule.endsWith("/") ? p.startsWith(rule) : p === rule || p.startsWith(`${rule}/`),
      )
    ) {
      wanted.add(p);
    }
  }
  return [...wanted].sort();
}

export function digestCommitted(repoDir: string, sha: string, paths: string[]): string {
  const lines: string[] = [];
  for (const p of paths) {
    const body = showFile(repoDir, sha, p);
    lines.push(`${p}\t${sha256(body ?? "")}`);
  }
  return sha256(lines.join("\n"));
}

export function digestWorkDir(dir: string, paths: string[]): string {
  const lines: string[] = [];
  for (const p of paths) {
    const f = `${dir}/${p}`;
    let body = "";
    try {
      body = existsSync(f) ? readFileSync(f, "utf8") : "";
    } catch {
      body = "";
    }
    lines.push(`${p}\t${sha256(body)}`);
  }
  return sha256(lines.join("\n"));
}

/** Freeze files only. Directories stay writable so the verifier can delete the copy. */
export function freezeTree(dir: string): void {
  spawnSync("find", [dir, "-type", "f", "-exec", "chmod", "a-w", "{}", "+"], {
    timeout: 10_000,
  });
}

export function isInside(root: string, file: string): boolean {
  const rel = relative(resolve(root), resolve(file));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}
