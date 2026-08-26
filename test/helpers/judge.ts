import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "../../src/compiler.ts";
import { parsePolicy } from "../../src/policy.ts";
import type { Approval, DutyEvidence, Report } from "../../src/types.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const POLICY_PATH = join(root, "policies", "node-green-subtraction-v0.json");
export const POLICY_RAW = readFileSync(POLICY_PATH, "utf8");
export const POLICY = parsePolicy(POLICY_RAW);

export function judge(
  dir: string,
  baseSha: string,
  headSha: string,
  extra: { approvals?: Approval[]; priorEvidence?: DutyEvidence[] } = {},
): Report {
  return compile({
    repoDir: dir,
    baseSha,
    headSha,
    policy: POLICY,
    policyRaw: POLICY_RAW,
    verifier: "test-verifier",
    approvals: extra.approvals,
    priorEvidence: extra.priorEvidence,
  });
}
