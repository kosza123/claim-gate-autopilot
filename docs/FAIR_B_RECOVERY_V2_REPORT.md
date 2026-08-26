# Fair B recovery v2 — report

**Verdict: `USEFUL_PACKAGING_ONLY`**

`COMMERCIAL_STATUS_UNPROVEN`  
`productAdvantageProven=false`

One preflight, one final push. Autopilot, reusable B, fixtures, and Klasp were not changed. `main` was not updated. No GitHub App.

## Facts

### SHAs

| item | SHA |
|---|---|
| Product D | `5a56bfb8fd43d60e83566e3aef87b92ebe2e4cab` |
| Reusable B | `bf5357d92c5c2cc1de542459fa72464f347431c0` |
| B file SHA-256 | `73a849e104199bbb0feed55bc994520889fcdc2032b9179ad9010db6b5b43e60` |
| v1 report base | `dc19799829efe739d427e0b81cdc41579b526ccb` |
| Final caller | `beb2d7f8fd6d7932cc055be1d21b549f8be73cd1` |
| Caller SHA-256 | `e1b935a4e1d5c86672d1f55faa3ac0df2df8a551166d3f3d6b94bc28e2f06cc6` |
| Freeze / trigger HEAD | `9e858aa0990c032fc9b4fab0f1a45f039d1a742b` |
| BASE | `e73936d3efda9d8291efd9c0c9923b68db94d422` |
| LYING | `f02d8102c363adb76ec0f7fc666cc74d1544d8e0` |
| REPAIRED | `d9a9e9f25fa474bc5aaaf7f70caccd937b82f435` |

### Preflight (transport)

https://github.com/kosza123/claim-gate-autopilot/actions/runs/32962855520  
Job `preflight-base / protected-gate` success. Log: `B_DECISION=ADMIT`. No skipped steps. Reusable invoked.

### Single final B run

https://github.com/kosza123/claim-gate-autopilot/actions/runs/32962952200  
Event: `push`. Head: `9e858aa0990c032fc9b4fab0f1a45f039d1a742b`  
Workflow conclusion: **failure** (expected: LYING job failed). Jobs evaluated separately. No second push.

| job | conclusion | `B_DECISION` | skipped steps | URL |
|---|---|---|---|---|
| `base / protected-gate` | success | `ADMIT` | none | https://github.com/kosza123/claim-gate-autopilot/actions/runs/32962952200/job/98159134321 |
| `lying / protected-gate` | failure | `REJECT_PROTECTED_PATH_DELETED` | checkout, setup-node, trusted commands (after surface reject) | https://github.com/kosza123/claim-gate-autopilot/actions/runs/32962952200/job/98159134648 |
| `repaired / protected-gate` | success | `ADMIT` | none | https://github.com/kosza123/claim-gate-autopilot/actions/runs/32962952200/job/98159134683 |

LYING surface log (unabbreviated):

```
SURFACE_CHANGED: test/protected.test.mjs
REJECT: protected path deleted on subject: test/e2e.test.mjs
SURFACE_CHANGED: package.json
SURFACE_CHANGED: .github/workflows/ci.yml
UNCHANGED: coverage-threshold.json
B_DECISION=REJECT_PROTECTED_PATH_DELETED
```

Later LYING steps are `skipped` because GitHub stops the job after the failing compare step. The job itself ran and emitted an unambiguous decision. Not treated as a missing job.

### Frozen v1 arms (not rerun)

| arm | LYING | REPAIRED | evidence |
|---|---|---|---|
| A | GitHub CI **green** (`npm test` only) | green | https://github.com/kosza123/claim-gate-autopilot/actions/runs/32960507489 |
| C | Klasp `klasp gate` exit 2, JSON `fail` because **e2e file missing**; protected `test.skip` **passed** on that frozen `klasp.toml` | exit 0 `pass` | v1 report; not a general claim that Klasp cannot detect skip |
| D | **REJECT** `UNAUTHORIZED_SKIP` (+ `PROTECTED_PATH_DELETED`, `INCLUDE_NARROWED`, `E2E_REMOVED`); 6-op fix-pack | **ADMIT** `ALL_DUTIES_PASSED` | v1 report; verifier `5a56bfb8` |

## Comparison B vs D (same SHAs)

| subject | B | D |
|---|---|---|
| BASE | `B_DECISION=ADMIT` | (tree identical to REPAIRED; v1 admitted REPAIRED) |
| LYING | `REJECT_PROTECTED_PATH_DELETED` | `REJECT` `UNAUTHORIZED_SKIP` |
| REPAIRED | `B_DECISION=ADMIT` | `ADMIT` `ALL_DUTIES_PASSED` |

**Fact:** both reject LYING and admit REPAIRED. B is a path-lock against BASE plus trusted argv. D adds skip/include detectors, per-duty execution records, and a machine fix-pack (`remove_unauthorized_skip`, `restore_protected_surface`, `run_required_check`) that B does not emit.

**Not a fact:** that this packaging has commercial value, that B is non-bypassable, or that D is a required check.

## Why this label

- Not `PRODUCT_ADVANTAGE_SIGNAL`: B did **not** admit LYING.
- Not `NO_DISTINCT_TECHNICAL_ADVANTAGE`: the difference is not only cosmetic; frozen D emits a concrete fix-pack B lacks.
- Not `INCONCLUSIVE_*`: B ran, all three jobs exist, decisions are in the logs.
- `USEFUL_PACKAGING_ONLY` per freeze rule: same admit/reject decisions, D supplies a machine fix-pack naming repairs.

## Honesty flags

```
githubAppInstalled=false
requiredCheckEnforced=false
nonBypassable=false
productionSignerIsolated=false
signedAttestation=false
realAgentLoop=false
commercialValueProven=false
productAdvantageProven=false
```

## Limits

- No arm is a merge gate.
- B did not execute protected tests on LYING (job stopped at surface diff). Detection of skip is therefore via `SURFACE_CHANGED` on that file, not by running it.
- Klasp v1 result is for that frozen `klasp.toml` only.
- `main` untouched. No further Autopilot work in this task.

Stop.
