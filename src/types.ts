export type Verdict = "ADMIT" | "REJECT" | "INCOMPLETE";

export type DutySpec = {
  id: string;
  argv: string[];
  timeoutMs: number;
  protected?: boolean;
  e2e?: boolean;
};

export type Policy = {
  schemaVersion: string;
  duties: DutySpec[];
  protectedPaths: string[];
  evidenceSurface: string[];
  coverageThresholdPath?: string;
  unapprovedSurfaceChange: string;
};

export type Finding = {
  code: string;
  path?: string;
  detail: string;
  kind: "weaken" | "surface" | "mismatch" | "missing";
};

export type DutyEvidence = {
  repo: string;
  baseSha: string;
  headSha: string;
  treeSha: string;
  policyDigest: string;
  verifier: string;
  dutyId: string;
  argv: string[];
  startedAt: string;
  endedAt: string;
  exitCode: number | null;
  stdoutDigest: string;
  stderrDigest: string;
  timedOut: boolean;
  crashed: boolean;
  verdict: "pass" | "fail" | "incomplete";
};

export type FixAction = {
  op:
    | "restore_protected_surface"
    | "remove_unauthorized_skip"
    | "request_policy_approval"
    | "run_required_check"
    | "investigate_failed_check"
    | "refresh_evidence_on_new_sha";
  reasonCode: string;
  subjectSha: string;
  path?: string;
  checkId?: string;
  expectedEvidence: string;
  requiresHuman: boolean;
  attemptLimit: number;
};

export type Approval = {
  headSha: string;
  policyDigest: string;
  note: string;
};

export type CompileInput = {
  repoDir: string;
  repoName?: string;
  baseSha: string;
  headSha: string;
  policy: Policy;
  policyRaw: string;
  verifier: string;
  approvals?: Approval[];
  priorEvidence?: DutyEvidence[];
};

export type Report = {
  verdict: Verdict;
  reasonCode: string;
  human: string;
  repo: string;
  baseSha: string;
  headSha: string;
  treeSha: string;
  policyDigest: string;
  findings: Finding[];
  duties: DutyEvidence[];
  fixPack: FixAction[];
  signedAttestation: false;
  productionSignerIsolated: false;
};
