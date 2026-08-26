import type { DutyEvidence, Finding, FixAction } from "./types.ts";

export function buildFixPack(
  headSha: string,
  findings: Finding[],
  duties: DutyEvidence[],
): FixAction[] {
  const pack: FixAction[] = [];
  const push = (action: FixAction) => {
    const key = JSON.stringify(action);
    if (pack.some((a) => JSON.stringify(a) === key)) return;
    pack.push(action);
  };

  for (const f of findings) {
    if (f.code === "UNAUTHORIZED_SKIP") {
      push({
        op: "remove_unauthorized_skip",
        reasonCode: f.code,
        subjectSha: headSha,
        path: f.path,
        expectedEvidence: "protected path without skip/only; fresh duty exit 0",
        requiresHuman: false,
        attemptLimit: 3,
      });
    } else if (f.kind === "weaken") {
      push({
        op: "restore_protected_surface",
        reasonCode: f.code,
        subjectSha: headSha,
        path: f.path,
        expectedEvidence: "protected surface restored; fresh duty exit 0",
        requiresHuman: false,
        attemptLimit: 3,
      });
    } else if (f.kind === "surface") {
      push({
        op: "request_policy_approval",
        reasonCode: f.code,
        subjectSha: headSha,
        path: f.path,
        expectedEvidence: "trusted approval of this headSha + policyDigest, then fresh run",
        requiresHuman: true,
        attemptLimit: 1,
      });
    } else if (f.kind === "mismatch") {
      push({
        op: "refresh_evidence_on_new_sha",
        reasonCode: f.code,
        subjectSha: headSha,
        expectedEvidence: "new execution records bound to this headSha",
        requiresHuman: false,
        attemptLimit: 3,
      });
    }
  }

  for (const d of duties) {
    if (d.verdict === "fail") {
      push({
        op: "investigate_failed_check",
        reasonCode: "PROTECTED_COMMAND_FAILED",
        subjectSha: headSha,
        checkId: d.dutyId,
        expectedEvidence: `duty ${d.dutyId} exit 0 on ${headSha}`,
        requiresHuman: false,
        attemptLimit: 3,
      });
      push({
        op: "run_required_check",
        reasonCode: "PROTECTED_COMMAND_FAILED",
        subjectSha: headSha,
        checkId: d.dutyId,
        expectedEvidence: `fresh argv ${d.argv.join(" ")} exit 0`,
        requiresHuman: false,
        attemptLimit: 3,
      });
    }
    if (d.verdict === "incomplete") {
      push({
        op: "run_required_check",
        reasonCode: d.timedOut ? "TIMEOUT" : "DUTY_INCOMPLETE",
        subjectSha: headSha,
        checkId: d.dutyId,
        expectedEvidence: `duty ${d.dutyId} completes with exit 0`,
        requiresHuman: false,
        attemptLimit: 3,
      });
    }
  }
  return pack;
}
