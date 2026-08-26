import { execFileSync } from "node:child_process";

export function git(repoDir: string, args: string[]): string {
  return execFileSync("git", ["-C", repoDir, ...args], {
    encoding: "utf8",
    maxBuffer: 8_000_000,
    timeout: 30_000,
  }).trim();
}

export function isGitRepo(dir: string): boolean {
  try {
    git(dir, ["rev-parse", "--is-inside-work-tree"]);
    return true;
  } catch {
    return false;
  }
}

export function resolveSha(repoDir: string, rev: string): string {
  const sha = git(repoDir, ["rev-parse", "--verify", `${rev}^{commit}`]);
  if (!/^[0-9a-f]{40}$/i.test(sha)) throw new Error(`not a full commit SHA: ${rev}`);
  return sha;
}

export function treeSha(repoDir: string, sha: string): string {
  return git(repoDir, ["rev-parse", `${sha}^{tree}`]);
}

export function listFiles(repoDir: string, sha: string): string[] {
  const out = git(repoDir, ["ls-tree", "-r", "--name-only", sha]);
  return out ? out.split("\n").filter(Boolean) : [];
}

export function showFile(repoDir: string, sha: string, path: string): string | null {
  try {
    return execFileSync("git", ["-C", repoDir, "show", `${sha}:${path}`], {
      encoding: "utf8",
      maxBuffer: 4_000_000,
      timeout: 15_000,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    return null;
  }
}

export function remoteUrl(repoDir: string): string {
  try {
    return git(repoDir, ["config", "--get", "remote.origin.url"]) || repoDir;
  } catch {
    return repoDir;
  }
}
