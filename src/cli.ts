#!/usr/bin/env node
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "./compiler.ts";
import { loadPolicy } from "./policy.ts";
import { git } from "./git.ts";
import { isInside } from "./workspace.ts";
import type { Approval, DutyEvidence, Report } from "./types.ts";

const here = dirname(fileURLToPath(import.meta.url));

function arg(flag: string, argv: string[]): string | undefined {
  const i = argv.indexOf(flag);
  if (i === -1) return undefined;
  return argv[i + 1];
}

function verifier(): string {
  try {
    return `claim-gate-autopilot@${git(resolve(here, ".."), ["rev-parse", "HEAD"])}`;
  } catch {
    return "claim-gate-autopilot@unknown";
  }
}

export function render(report: Report): string {
  const lines = [
    "## Claim Gate Autopilot",
    "",
    `**${report.verdict}** \`${report.reasonCode}\``,
    "",
    report.human,
    "",
    `- repo: \`${report.repo}\``,
    `- baseSha: \`${report.baseSha}\``,
    `- headSha: \`${report.headSha}\``,
    `- treeSha: \`${report.treeSha}\``,
    `- policyDigest: \`${report.policyDigest}\``,
    `- signedAttestation: false`,
    "",
    "### Findings",
    ...((report.findings.length ? report.findings : [{ code: "(none)", detail: "", kind: "missing" as const }]).map(
      (f) => `- ${f.code}${f.path ? ` (${f.path})` : ""} ${f.detail}`.trim(),
    )),
    "",
    "### Duties",
    ...report.duties.map(
      (d) =>
        `- ${d.dutyId}: ${d.verdict} exit=${d.exitCode} argv=\`${d.argv.join(" ")}\` stdout=${d.stdoutDigest.slice(0, 12)}`,
    ),
    "",
    "### Fix pack",
    "```json",
    JSON.stringify(report.fixPack, null, 2),
    "```",
  ];
  return lines.join("\n") + "\n";
}

export function main(argv = process.argv.slice(2)): number {
  const outDir = arg("--out", argv);
  if (!outDir) {
    process.stderr.write("INCOMPLETE: --out is required. Refusing to write repository out/.\n");
    return 1;
  }
  mkdirSync(outDir, { recursive: true });

  const write = (report: Report, code: number) => {
    writeFileSync(join(outDir, "verdict.txt"), report.verdict + "\n");
    writeFileSync(join(outDir, "reason.txt"), report.reasonCode + "\n");
    writeFileSync(join(outDir, "comment.md"), render(report));
    writeFileSync(join(outDir, "report.json"), JSON.stringify(report, null, 2));
    writeFileSync(join(outDir, "fix-pack.json"), JSON.stringify(report.fixPack, null, 2));
    process.stdout.write(render(report));
    return code;
  };

  try {
    const repoDir = resolve(arg("--repo", argv) || process.cwd());
    const policyFlag = arg("--policy", argv);
    const policyPath = resolve(
      policyFlag || join(here, "..", "policies", "node-green-subtraction-v0.json"),
    );
    if (policyFlag && isInside(repoDir, policyPath)) {
      return write(
        {
          verdict: "INCOMPLETE",
          reasonCode: "UNTRUSTED_POLICY_SOURCE",
          human: "Policy path is inside the candidate repo. Trusted policy must live outside it.",
          repo: repoDir,
          baseSha: "",
          headSha: "",
          treeSha: "",
          policyDigest: "",
          findings: [],
          duties: [],
          fixPack: [],
          signedAttestation: false,
          productionSignerIsolated: false,
        },
        1,
      );
    }
    const loaded = loadPolicy(policyPath);
    const baseSha = arg("--base", argv);
    const headSha = arg("--head", argv);
    if (!baseSha || !headSha) {
      return write(
        {
          verdict: "INCOMPLETE",
          reasonCode: "MISSING_SHA",
          human: "--base and --head are required full git subjects.",
          repo: repoDir,
          baseSha: baseSha || "",
          headSha: headSha || "",
          treeSha: "",
          policyDigest: loaded.digest,
          findings: [],
          duties: [],
          fixPack: [],
          signedAttestation: false,
          productionSignerIsolated: false,
        },
        1,
      );
    }
    const approvals: Approval[] = [];
    if (arg("--approval-head", argv) || arg("--approval-digest", argv)) {
      return write(
        {
          verdict: "INCOMPLETE",
          reasonCode: "UNTRUSTED_APPROVAL_SOURCE",
          human: "CLI approval flags are ignored. Use --approvals-file outside the candidate repo.",
          repo: repoDir,
          baseSha,
          headSha,
          treeSha: "",
          policyDigest: loaded.digest,
          findings: [],
          duties: [],
          fixPack: [],
          signedAttestation: false,
          productionSignerIsolated: false,
        },
        1,
      );
    }
    const approvalsFile = arg("--approvals-file", argv);
    if (approvalsFile) {
      const resolved = resolve(approvalsFile);
      if (isInside(repoDir, resolved)) {
        return write(
          {
            verdict: "INCOMPLETE",
            reasonCode: "UNTRUSTED_APPROVAL_SOURCE",
            human: "Approvals file is inside the candidate repo.",
            repo: repoDir,
            baseSha,
            headSha,
            treeSha: "",
            policyDigest: loaded.digest,
            findings: [],
            duties: [],
            fixPack: [],
            signedAttestation: false,
            productionSignerIsolated: false,
          },
          1,
        );
      }
      const parsed = JSON.parse(readFileSync(resolved, "utf8")) as Approval[];
      approvals.push(...parsed);
    }

    let priorEvidence: DutyEvidence[] | undefined;
    const priorPath = arg("--prior-evidence", argv);
    if (priorPath) {
      const resolved = resolve(priorPath);
      if (isInside(repoDir, resolved)) {
        return write(
          {
            verdict: "INCOMPLETE",
            reasonCode: "UNTRUSTED_EVIDENCE_SOURCE",
            human: "Prior evidence file is inside the candidate repo.",
            repo: repoDir,
            baseSha,
            headSha,
            treeSha: "",
            policyDigest: loaded.digest,
            findings: [],
            duties: [],
            fixPack: [],
            signedAttestation: false,
            productionSignerIsolated: false,
          },
          1,
        );
      }
      priorEvidence = JSON.parse(readFileSync(resolved, "utf8")) as DutyEvidence[];
    }

    const report = compile({
      repoDir,
      baseSha,
      headSha,
      policy: loaded.policy,
      policyRaw: loaded.raw,
      verifier: verifier(),
      approvals,
      priorEvidence,
    });
    return write(report, report.verdict === "ADMIT" ? 0 : 1);
  } catch (err) {
    const report: Report = {
      verdict: "INCOMPLETE",
      reasonCode: "VERIFIER_CRASH",
      human: `Verifier crash: ${(err as Error).message}`,
      repo: "",
      baseSha: "",
      headSha: "",
      treeSha: "",
      policyDigest: "",
      findings: [],
      duties: [],
      fixPack: [],
      signedAttestation: false,
      productionSignerIsolated: false,
    };
    return write(report, 1);
  }
}

if (resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

export function freshOut(): string {
  return mkdtempSync(join(tmpdir(), "cg-out-"));
}
