import { policyDigest } from "./policy.ts";
import { isGitRepo, remoteUrl, resolveSha, treeSha } from "./git.ts";
import { inspectSurface } from "./surface.ts";
import { materialize, removeWork, runDuty } from "./runner.ts";
import { buildFixPack } from "./fixpack.ts";
import {
  digestCommitted,
  digestWorkDir,
  freezeTree,
  surfacePaths,
} from "./workspace.ts";
import type { CompileInput, DutyEvidence, Finding, Report, Verdict } from "./types.ts";

export function compile(input: CompileInput): Report {
  const repo = input.repoName || remoteUrl(input.repoDir);
  const digest = policyDigest(input.policyRaw);

  const incomplete = (
    reasonCode: string,
    human: string,
    extra: Partial<Report> = {},
  ): Report => ({
    verdict: "INCOMPLETE",
    reasonCode,
    human,
    repo,
    baseSha: extra.baseSha || "",
    headSha: extra.headSha || "",
    treeSha: extra.treeSha || "",
    policyDigest: digest,
    findings: extra.findings || [],
    duties: extra.duties || [],
    fixPack: extra.fixPack || [],
    signedAttestation: false,
    productionSignerIsolated: false,
  });

  if (!isGitRepo(input.repoDir)) {
    return incomplete("UNSUPPORTED_REPO", "Not a git repository.");
  }

  let baseSha: string;
  let headSha: string;
  try {
    baseSha = resolveSha(input.repoDir, input.baseSha);
    headSha = resolveSha(input.repoDir, input.headSha);
  } catch (err) {
    return incomplete("UNSUPPORTED_REPO", `Cannot resolve SHA: ${(err as Error).message}`);
  }

  if (input.priorEvidence && input.priorEvidence.length) {
    const findings: Finding[] = [];
    for (const ev of input.priorEvidence) {
      if (ev.repo && ev.repo !== repo && ev.repo !== input.repoDir) {
        findings.push({
          code: "EVIDENCE_REPO_MISMATCH",
          detail: `evidence repo ${ev.repo} != ${repo}`,
          kind: "mismatch",
        });
      }
      if (ev.headSha !== headSha) {
        findings.push({
          code: "EVIDENCE_SUBJECT_MISMATCH",
          detail: `evidence head ${ev.headSha} != subject ${headSha}`,
          kind: "mismatch",
        });
      }
    }
    if (findings.length) {
      return {
        ...incomplete(
          findings[0].code,
          "Stale or foreign evidence cannot admit a different SHA.",
          { baseSha, headSha, findings, fixPack: buildFixPack(headSha, findings, []) },
        ),
      };
    }
  }

  if (!input.policy.duties.length) {
    return incomplete("NO_DUTIES", "Trusted policy contains no duties.", { baseSha, headSha });
  }

  let tree: string;
  try {
    tree = treeSha(input.repoDir, headSha);
  } catch (err) {
    return incomplete("UNSUPPORTED_REPO", `No tree for head: ${(err as Error).message}`, {
      baseSha,
      headSha,
    });
  }

  const findings = inspectSurface(input.repoDir, baseSha, headSha, input.policy);
  const approved = (input.approvals || []).some(
    (a) => a.headSha === headSha && a.policyDigest === digest,
  );
  const paths = surfacePaths(input.repoDir, headSha, input.policy);
  const committed = digestCommitted(input.repoDir, headSha, paths);

  const duties: DutyEvidence[] = [];
  try {
    for (const duty of input.policy.duties) {
      const workDir = materialize(input.repoDir, headSha);
      try {
        freezeTree(workDir);
        const before = digestWorkDir(workDir, paths);
        if (before !== committed) {
          findings.push({
            code: "MATERIALIZE_MISMATCH",
            detail: `extracted tree for ${duty.id} does not match committed surface`,
            kind: "mismatch",
          });
        }
        const ev = runDuty({
          repo,
          repoDir: input.repoDir,
          workDir,
          baseSha,
          headSha,
          treeSha: tree,
          policyDigest: digest,
          verifier: input.verifier,
          duty,
        });
        const after = digestWorkDir(workDir, paths);
        ev.committedDigest = committed;
        ev.workspaceBeforeDigest = before;
        ev.workspaceAfterDigest = after;
        if (after !== before || before !== committed) {
          findings.push({
            code: "CROSS_DUTY_TAMPER",
            detail: `duty ${duty.id} mutated the subject tree (before=${before.slice(0, 12)} after=${after.slice(0, 12)})`,
            kind: "weaken",
          });
        }
        duties.push(ev);
      } finally {
        removeWork(workDir);
      }
    }
  } catch (err) {
    return incomplete("VERIFIER_CRASH", `Verifier crash: ${(err as Error).message}`, {
      baseSha,
      headSha,
      treeSha: tree,
      findings,
      duties,
    });
  }

  const timed = duties.filter((d) => d.timedOut);
  const crashed = duties.filter((d) => d.crashed);
  const failed = duties.filter((d) => d.verdict === "fail");
  const incompleteDuties = duties.filter((d) => d.verdict === "incomplete");
  const tamper = findings.filter((f) => f.code === "CROSS_DUTY_TAMPER" || f.code === "MATERIALIZE_MISMATCH");
  const weaken = findings.filter((f) => f.kind === "weaken");
  const surface = findings.filter((f) => f.kind === "surface");
  const fixPack = buildFixPack(headSha, findings, duties);

  const finish = (verdict: Verdict, reasonCode: string, human: string): Report => ({
    verdict,
    reasonCode,
    human,
    repo,
    baseSha,
    headSha,
    treeSha: tree,
    policyDigest: digest,
    findings,
    duties,
    fixPack,
    signedAttestation: false,
    productionSignerIsolated: false,
  });

  if (timed.length) {
    return finish("INCOMPLETE", "TIMEOUT", `Duty timeout on ${timed.map((d) => d.dutyId).join(",")}.`);
  }
  if (crashed.length || incompleteDuties.length) {
    return finish(
      "INCOMPLETE",
      "DUTY_INCOMPLETE",
      "A required duty crashed or did not produce an exit code.",
    );
  }
  if (tamper.length) {
    return finish(
      "REJECT",
      tamper[0].code,
      `Subject tree was mutated during a duty on ${headSha}. Fresh copies do not save a poisoned workspace.`,
    );
  }
  if (weaken.length) {
    return finish(
      "REJECT",
      weaken[0].code,
      `Green-by-subtraction on ${headSha}: ${weaken.map((f) => f.code).join(", ")}`,
    );
  }
  if (failed.length) {
    return finish(
      "REJECT",
      "PROTECTED_COMMAND_FAILED",
      `Protected command failed on ${headSha}: ${failed.map((d) => d.dutyId).join(", ")}`,
    );
  }
  if (surface.length && !approved) {
    return finish(
      "INCOMPLETE",
      "POLICY_SURFACE_CHANGE_REQUIRES_APPROVAL",
      "Legal evidence-surface change requires trusted approval outside the PR.",
    );
  }
  if (!duties.length) {
    return finish("INCOMPLETE", "NO_DUTIES", "No duty evidence produced.");
  }
  if (duties.some((d) => d.verdict !== "pass")) {
    return finish("INCOMPLETE", "DUTY_INCOMPLETE", "Not every duty has a pass record.");
  }
  if (duties.some((d) => d.headSha !== headSha || d.treeSha !== tree)) {
    return finish("INCOMPLETE", "EVIDENCE_SUBJECT_MISMATCH", "Duty records are not bound to this SHA.");
  }

  return finish(
    "ADMIT",
    "ALL_DUTIES_PASSED",
    `All ${duties.length} duties exited 0 on ${headSha} (tree ${tree.slice(0, 12)}).`,
  );
}
