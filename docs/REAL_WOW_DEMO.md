# Real green-by-subtraction demo (v0a)

Recorded 2026-08-26 against branch `prototype/autopilot-real-green-subtraction-v0a` at HEAD `9ba4306acf26ae0c133a251f738ad984a03262d9`.
CI (this PR, do not merge): https://github.com/kosza123/claim-gate-autopilot/actions/runs/32953615299
PR: https://github.com/kosza123/claim-gate-autopilot/pull/1
Fixture commits were created from scratch as real git objects (not hard-coded SHAs).
Re-running `npm test` creates **new** SHAs; the values below are from one captured run.

```
BASE_SHA=75ec1871fb1375dd77529a94f8de4d15794445c3
LYING_SHA=bd58a3c53465f01af95ae10435ae05a488e405f1
REPAIRED_SHA=9c89005fe29f0e276cb7b3ff39479f50e82d0018

candidate_ci_lying=GREEN
candidate_ci_exit=0
autopilot_lying=REJECT
autopilot_lying_reason=UNAUTHORIZED_SKIP
protected_test_exit_lying=0
stale_evidence_on_repaired=BLOCK (EVIDENCE_SUBJECT_MISMATCH)
protected_test_exit_repaired=0
e2e_exit_repaired=0
autopilot_repaired=ADMIT
```

Findings on L: `UNAUTHORIZED_SKIP`, `PROTECTED_PATH_DELETED`, `INCLUDE_NARROWED`, `E2E_REMOVED`.

Tree on L: `7339af3cba011bab61632edb5b339914234ac985`  
Tree on R: `a724e017f97655441e8dc8d2719f9061253f11f5`  
Policy digest: `398f8c8ae768a461ea885a8d63ea5e63face303cab465ef1439b5f2000784cfa`  
signedAttestation=false

Protected file on L still **exits 0** (`test.skip`). Ordinary execution of the remaining file is green. Autopilot still REJECTS because the protected surface was weakened.

## Reproduction

```
git clone https://github.com/kosza123/claim-gate-autopilot
git checkout prototype/autopilot-real-green-subtraction-v0a
npm ci
npm test
```

Lifecycle is `test/integration/lifecycle.test.ts`. Matrix is `test/attack-matrix.test.ts`.

## Allowed sentence

Ordinary CI was green because the PR weakened its own tests. Claim Gate independently rejected the exact SHA. After a real code repair and fresh protected execution, the new SHA was admitted.

## Not claimed

- agent self-repaired
- works overnight
- GitHub App
- non-bypassable
- production-ready

## A/B/C/D on the same fixture

| arm | lying L detected | false ADMIT on L | bound to exact SHA | candidate can weaken generator | machine fix-pack | install steps | decision |
|---|---|---|---|---|---|---|---|
| A candidate `npm test` | no | yes (exit 0) | no | yes | no | 1 | ~110ms |
| B trusted argv on candidate tree | no (skip exits 0) | yes | no | no (argv outside PR) | no | 2 | ~35ms |
| C Klasp `@klasp-dev/klasp@0.4.0` | n/a | n/a | n/a | n/a | n/a | n/a | `KLASP_BASELINE_UNAVAILABLE` (exit 127) |
| D Autopilot | yes, REJECT | no | yes, 40-char SHA + tree | no | yes | 2 (policy file + Action) | ~380ms |

## Product advantage

A is green on L. B runs the same protected argv Autopilot would run, but against L’s weakened file, which **exits 0** because of `test.skip`. Autopilot additionally inspects the evidence surface against base and REJECTS. That is the gap vs strong-but-execution-only central CI.

Klasp was pinned to `0.4.0` and did not run as a usable gate here (`KLASP_BASELINE_UNAVAILABLE`).

## Attack matrix (26 + 3 guards)

All passed locally: 01–26, zero false ADMIT on L, ADMIT on honest R. See `test/attack-matrix.test.ts`.

## What is still not real

```
realTestsExecuted=true
realAgentLoop=false
githubAppInstalled=false
requiredCheckEnforced=false
productionSignerIsolated=false
nonBypassable=false
signedAttestation=false
productAdvantageProven=true   # vs A and vs argv-only central CI on this fixture
wowProven=true                # technical phrase above, not an agent-overnight story
```

No GitHub App, no required check from an app, no human-out-of-loop repair adapter, no signed provenance.

## Gate

`GREEN_BY_SUBTRACTION_TECHNICAL_PASS + PRODUCT_ADVANTAGE_SIGNAL`

Next step (only): a GitHub App that owns the required check so the candidate workflow cannot skip the verifier. Do not merge this branch until that is separately approved.
