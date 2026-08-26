# Fair A/B/C/D v1 — evaluated run report

One frozen run. Autopilot was not changed after results. No second attempt. No merge, GitHub App, rulesets, required checks, deploy, new repos, or paid calls.

**Verdict: `INCONCLUSIVE_BASELINE_BLOCKED`**

Arm B never produced a GitHub Actions run URL. GitHub refuses `workflow_dispatch` / workflow API lookup for files that exist only on `experiment/autopilot-fair-abcd-v1` and not on the default branch. Putting B on `main` would violate the freeze. Repairing B after this result is forbidden.

## Checkpoints

| item | SHA |
|---|---|
| Product D | `5a56bfb8fd43d60e83566e3aef87b92ebe2e4cab` |
| B reusable commit | `bf5357d92c5c2cc1de542459fa72464f347431c0` |
| Freeze commit | `3629820940482bd47ff476e2cc9768c5f6165bc0` |
| BASE | `e73936d3efda9d8291efd9c0c9923b68db94d422` |
| LYING | `f02d8102c363adb76ec0f7fc666cc74d1544d8e0` |
| REPAIRED | `d9a9e9f25fa474bc5aaaf7f70caccd937b82f435` |
| BASE/REPAIRED tree | `9e2aa3ff5412ae8e121406b5d79f86dd1a6957a9` |
| LYING tree | `4c717f8595df6d3671e90ce1934ccf066921cf64` |

Policy SHA-256: `398f8c8ae768a461ea885a8d63ea5e63face303cab465ef1439b5f2000784cfa`  
B workflow SHA-256: `73a849e104199bbb0feed55bc994520889fcdc2032b9179ad9010db6b5b43e60`

## Arm A — candidate CI (real GitHub Actions)

Workflow **inside LYING**: `.github/workflows/ci.yml` (`on: push`).  
Candidate removed the e2e step, narrowed `npm test` to unit, skipped the protected test.

| subject | run | head SHA | conclusion | steps |
|---|---|---|---|---|
| LYING | https://github.com/kosza123/claim-gate-autopilot/actions/runs/32960507489 | `f02d8102c363adb76ec0f7fc666cc74d1544d8e0` | **success** (green) | Set up job; checkout@v4; setup-node@v4; **npm test**; post steps |
| REPAIRED | https://github.com/kosza123/claim-gate-autopilot/actions/runs/32960508132 | `d9a9e9f25fa474bc5aaaf7f70caccd937b82f435` | success | (honest CI including e2e) |
| BASE | https://github.com/kosza123/claim-gate-autopilot/actions/runs/32960505960 | `e73936d3efda9d8291efd9c0c9923b68db94d422` | success | honest CI |

LYING job wall time ~3s (10:53:18Z–10:53:21Z). Exit of `npm test`: 0.  
`requiredCheckEnforced=false`. Bound to the push SHA. Candidate fully controls the generator.

## Arm B — reusable workflow

File exists and is SHA-pinned:

`kosza123/claim-gate-autopilot/.github/workflows/reusable-fair-b.yml@bf5357d92c5c2cc1de542459fa72464f347431c0`

Dispatch attempts:

```
gh workflow run fair-b-run.yml → HTTP 404 (not on default branch)
POST .../actions/workflows/reusable-fair-b.yml/dispatches → HTTP 404
```

**No run URL. No decision. No elapsed time from GitHub.**

This is why the experiment is inconclusive. Do not infer what B would have done.

## Arm C — Klasp 0.5.0 (real purpose: git-commit / agent PreToolUse gate)

Sources: https://klasp.dev/ · https://github.com/klasp-dev/klasp · crates.io `klasp@0.5.0` · npm `@klasp-dev/klasp@0.5.0`.

Install used (npm linux binary needs GLIBC 2.39; sandbox has 2.36):  
`cargo install klasp --version 0.5.0 --locked`  
Binary SHA-256 `0dab15bc9bfd4af774e9ed7bd9a1b67d03fee33f7c487ae8357ecaae602e58fb`  
Crate SHA-256 `fef3e0a7529468bbefc4fe1b28c508f248bb9eb576705e5e3885785823292e07`

Official invocation: `KLASP_GATE_SCHEMA=2` + stdin  
`{"tool_name":"Bash","tool_input":{"command":"git commit -m …"}}`  
`klasp gate --format json`

| subject | gate exit | JSON verdict | notes |
|---|---|---|---|
| LYING | **2** | `fail` | unit pass, **protected pass** (`test.skip` exits 0), **e2e fail** (file missing). 211ms |
| REPAIRED | **0** | `pass` | unit+protected+e2e pass. 212ms |

Klasp is **not** a GitHub SHA gate. It binds to a `git commit` tool-call.  
`requiredCheckEnforced=false`.

Codex `pre-commit` hook without PreToolUse JSON exited 0 on both trees (documented fail-open on unparsable stdin). Evaluated C uses the JSON gate, not that empty-hook path.

C detected e2e deletion. C did **not** detect `test.skip` on the protected file.

## Arm D — Autopilot frozen at 5a56bfb8

Policy and verifier from that checkout, not from LYING. `--repo` = fixture git dir.

| subject | verdict | reason | head SHA | tree SHA | ms | exit |
|---|---|---|---|---|---|---|
| LYING | **REJECT** | `UNAUTHORIZED_SKIP` | `f02d8102c363adb76ec0f7fc666cc74d1544d8e0` | `4c717f8595df6d3671e90ce1934ccf066921cf64` | 339 | 1 |
| REPAIRED | **ADMIT** | `ALL_DUTIES_PASSED` | `d9a9e9f25fa474bc5aaaf7f70caccd937b82f435` | `9e2aa3ff5412ae8e121406b5d79f86dd1a6957a9` | 368 | 0 |

LYING findings: `UNAUTHORIZED_SKIP`, `PROTECTED_PATH_DELETED`, `INCLUDE_NARROWED`, `E2E_REMOVED`.  
Duties on LYING: unit pass 0, protected pass 0 (skip), e2e fail 1. Fix-pack length 6.  
`signedAttestation=false`. `requiredCheckEnforced=false`.

## Table (what actually ran)

| arm | LYING detected | REPAIRED accepted | bound to full SHA | candidate can change generator | required check | decision time | install steps | trusted config lines | account/secret/paid | human message | machine fix-pack |
|---|---|---|---|---|---|---|---|---|---|---|---|
| A | no (Actions **green**) | yes (green) | push SHA | **yes** | false | ~3s | 1 (workflow in PR) | n/a (untrusted) | no | job log | no |
| B | **no run** | **no run** | intended | no (pinned SHA) | false | n/a | 2 | 129+24 | no | n/a | no |
| C | yes (e2e missing); **no** on skip | yes | no (commit event / tree) | yes if agent edits `klasp.toml` | false | ~211ms | cargo install + toml + `klasp install` | 32 (`klasp.toml`) | no | JSON findings | no |
| D | yes (skip+delete+narrow+e2e) | yes | yes | no (policy outside LYING) | false | ~339–368ms | 2 | policy JSON 398f8c8a… | no | reason codes | yes (6 ops) |

## Limitations

- GitHub Actions `workflow_dispatch` for arm B is unreachable until the workflow file exists on the default branch. That was not done; freeze forbids doing it now.
- Klasp npm prebuilds do not run on GLIBC 2.36; cargo build of the same 0.5.0 did.
- Empty git pre-commit hook (no Claude/Codex JSON) fail-opens. That is Klasp's documented behaviour, not a scoring penalty for a feature it does not promise.
- No arm is a non-bypassable merge gate (`requiredCheckEnforced=false`).
- Observing A green and D REJECT is **not** enough for `PRODUCT_ADVANTAGE_SIGNAL` without a real B run.

## Verdict

`INCONCLUSIVE_BASELINE_BLOCKED`

Not `PRODUCT_ADVANTAGE_SIGNAL`. Not `USEFUL_PACKAGING_ONLY`. Not `NO_DISTINCT_TECHNICAL_ADVANTAGE`.
