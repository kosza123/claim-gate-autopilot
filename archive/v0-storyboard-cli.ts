#!/usr/bin/env node
/**
 * GitHub Action entry. Policy and compiler come from this repo, not the PR.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { applyFixPack, BASE, compile, LYING, type Snapshot } from "./compiler.ts";

function git(args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function snapshot(sha: string): Snapshot {
  const names = git(["ls-tree", "-r", "--name-only", sha]).split("\n").filter(Boolean);
  const files: Record<string, string> = {};
  for (const name of names) {
    if (name.length > 200) continue;
    try {
      files[name] = git(["show", `${sha}:${name}`]);
    } catch {
      /* binary */
    }
  }
  return { sha: sha.slice(0, 7), files };
}

function main() {
  const outDir = process.env.RUNNER_TEMP ? `${process.env.RUNNER_TEMP}/autopilot` : "out";
  mkdirSync(outDir, { recursive: true });

  let report;
  if (process.env.AUTOPILOT_DEMO === "lying") {
    report = compile(LYING, BASE, 1);
  } else {
    const head = process.env.HEAD_SHA || git(["rev-parse", "HEAD"]);
    const base = process.env.BASE_SHA || git(["rev-parse", "HEAD^"]);
    report = compile(snapshot(head), snapshot(base), 1);
  }

  const md = [
    "## Claim Gate Autopilot",
    "",
    `**${report.verdict}** — SHA \`${report.sha}\`  ·  cycle ${report.cycle}/${report.maxCycles}`,
    "",
    report.human,
    "",
    ...report.duties.map(
      (d) => `- ${d.status === "pass" ? "pass" : d.status === "fail" ? "FAIL" : "missing"}  **${d.title}** — ${d.detail}`,
    ),
    "",
    report.fixPack.length
      ? "### Fix pack\n\n```json\n" + JSON.stringify(report.fixPack, null, 2) + "\n```"
      : "",
    "",
    report.verdict !== "ADMIT" ? "_Fail closed. Merge stays blocked._" : "",
  ]
    .filter(Boolean)
    .join("\n");

  writeFileSync(`${outDir}/comment.md`, md + "\n");
  writeFileSync(`${outDir}/verdict.txt`, report.verdict + "\n");
  writeFileSync(`${outDir}/fix-pack.json`, JSON.stringify(report.fixPack, null, 2));
  process.stdout.write(md + "\n");
  if (report.verdict === "REJECT" && process.env.AUTOPILOT_DEMO === "lying") {
    const next = applyFixPack(LYING, BASE, report.fixPack);
    const admitted = compile(next, BASE, 2);
    process.stdout.write(`\n(demo apply) ${admitted.verdict} ${admitted.sha}\n`);
  }
  process.exit(report.verdict === "ADMIT" ? 0 : 1);
}

main();
