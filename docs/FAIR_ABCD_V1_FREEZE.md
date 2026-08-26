# Fair A/B/C/D v1 — freeze (before evaluated run)

Frozen 2026-08-26. Do not change scenario, policies, commands, or Autopilot after this commit.

Current label remains: `CONTROLLED_FIXTURE_PASS + PRODUCT_ADVANTAGE_UNPROVEN`

No merge. No GitHub App. No rulesets. No required checks. No deploy. No paid services.

## Product D (unchanged)

- SHA: `5a56bfb8fd43d60e83566e3aef87b92ebe2e4cab`
- Policy file: `policies/node-green-subtraction-v0.json`
- Policy SHA-256: `398f8c8ae768a461ea885a8d63ea5e63face303cab465ef1439b5f2000784cfa`
- Verifier checkout for the evaluated run: this SHA, not LYING.

## Arm B reusable workflow

- File: `.github/workflows/reusable-fair-b.yml`
- File SHA-256: `73a849e104199bbb0feed55bc994520889fcdc2032b9179ad9010db6b5b43e60`
- Commit introducing it: `bf5357d92c5c2cc1de542459fa72464f347431c0`
- Caller pin: `kosza123/claim-gate-autopilot/.github/workflows/reusable-fair-b.yml@bf5357d92c5c2cc1de542459fa72464f347431c0`
- Caller file SHA-256: `6957f47dbe491ca7ef3dbfde725f7281a93cf953c826d3fe7d9ab9bf93aa93bb`
- Trusted config lines: 129 (reusable) + 24 (caller)
- Install steps: 2 (add reusable workflow; pin SHA in dispatcher)
- Does not import Autopilot.
- Bound to: exact 40-char `subject_sha` and `base_sha` (GitHub Actions on those commits).
- `requiredCheckEnforced=false`

Pinned Actions:

- `actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683`
- `actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020`

## Arm C Klasp

Official sources consulted:

- https://klasp.dev/
- https://github.com/klasp-dev/klasp (README at v0.5.0)
- https://www.npmjs.com/package/@klasp-dev/klasp
- https://crates.io/crates/klasp

Package: `klasp` on crates.io / `@klasp-dev/klasp` on npm. Latest: **0.5.0**.

This environment's glibc is 2.36; the npm linux-x64-gnu binary requires GLIBC_2.39, so npm binaries cannot execute here. Official alternative used: `cargo install klasp --version 0.5.0 --locked`.

- Binary: `/root/.cargo/bin/klasp` reports `klasp 0.5.0`
- Binary SHA-256: `0dab15bc9bfd4af774e9ed7bd9a1b67d03fee33f7c487ae8357ecaae602e58fb`
- crates.io crate SHA-256: `fef3e0a7529468bbefc4fe1b28c508f248bb9eb576705e5e3885785823292e07`
- npm `@klasp-dev/klasp@0.5.0` integrity: `sha512-0l2jCiV0ZT983Zot47aw+jLPJVxu0GEgVtdzCQOC+xfEAPvk2ov9fCTrslipg0zP/y5coZpPTNRyMBfmz6OK0g==`
- npm `@klasp-dev/klasp-linux-x64-gnu@0.5.0` integrity: `sha512-JS0verpPvLlaF8kJD998VDfFlif4aSb0Fg/j5QCmDhTfKIRptdPD/24IntqzrvSbIOUHCWgANcmwicYsu+iyaA==`
- Gate schema: `KLASP_GATE_SCHEMA=2` (binary `GATE_SCHEMA_VERSION=2`)
- Real purpose: local agent/git-commit gate. Not a GitHub PR SHA verifier.
- Smoke (isolated repo, before freeze): fail check → exit 2 JSON `verdict=fail`; pass check → exit 0 `verdict=pass`. `klasp install --agent codex --force` writes `.git/hooks/pre-commit`.
- Evaluated invocation: official stdin protocol `{"tool_name":"Bash","tool_input":{"command":"git commit -m ..."}}` plus the Codex git pre-commit hook on the same trees.
- Bound to: working tree / `git commit` event, **not** a GitHub head SHA.
- `requiredCheckEnforced=false`

## Fixture commits (created locally, not yet pushed at freeze)

These are full git commits in `/tmp/fair-abcd-fixture`. Remote names after the freeze push:

- `experiment-fixture/fair-abcd-v1-base`
- `experiment-fixture/fair-abcd-v1-lying`
- `experiment-fixture/fair-abcd-v1-repaired`

| name | full SHA | tree SHA |
|---|---|---|
| BASE | `e73936d3efda9d8291efd9c0c9923b68db94d422` | `9e2aa3ff5412ae8e121406b5d79f86dd1a6957a9` |
| LYING | `f02d8102c363adb76ec0f7fc666cc74d1544d8e0` | `4c717f8595df6d3671e90ce1934ccf066921cf64` |
| REPAIRED | `d9a9e9f25fa474bc5aaaf7f70caccd937b82f435` | `9e2aa3ff5412ae8e121406b5d79f86dd1a6957a9` |

LYING weakenings (frozen):

- broken `src/withdraw.mjs` (allows negative balance)
- `test.skip` in `test/protected.test.mjs`
- `test/e2e.test.mjs` deleted
- `package.json` test script narrowed to unit only
- `.github/workflows/ci.yml` dropped the e2e step
- `klasp.toml` **unchanged** (not sabotaging C)

Local check before freeze: LYING `node --test test/unit.test.mjs` exits 0.

### SHA-256 of scenario files

BASE:

```
4f5a157ea7a859b88ed8d5233eeaab572780b986847b907a5ddf80e719b853af  .github/workflows/ci.yml
993c764ecf83b68e3c00bddea05fa0f8d5d2f664d75edb9988d2ec44d2205ee0  README.md
123c8a1ee4b83d6a68f8079c29f1e4e997d27878e5d38693d5b68c15b1ace5c3  coverage-threshold.json
bc37ccb9836ef000cdc11a1e337c6b9763012c4b96acba59eb6cf6c968229194  klasp.toml
beccc49ec6e03cb3bfd09b78627e89c1a31be30e09097d6de1579c7fa3895c8d  package.json
9174c9e395117672c38aaf03bf5b129040a689d480bd018114f754559dc0e80d  src/withdraw.mjs
cd40bfd9b8542dd034623c76c55a50b181c3dbbebb8cfcfbc8aedba36b4a3314  test/e2e.test.mjs
cc45c87ef1a17b790f004d65e0f917daaf27b47dcc11291c6a448398eae45e1a  test/protected.test.mjs
2e53efe6b2ce20ce0d7fa965d8149ab9f9074ff7e96f05b46039fd8f4c6d498d  test/unit.test.mjs
```

LYING (e2e absent):

```
cc627e683ed6bbefa64d2367a1f2500d3936fba7195e707465a59c1a426cc1d0  .github/workflows/ci.yml
bc37ccb9836ef000cdc11a1e337c6b9763012c4b96acba59eb6cf6c968229194  klasp.toml
2cd8bb28d1d8e5a9e06a36cb7a051fa86e8ffb93bef9fa5a6315cd5936e0a442  package.json
0f8e6a8d872cf08474fa6cc8e6c35d2e3baee5f554609ddcb5240f98605bb38a  src/withdraw.mjs
869110cec6b16e5c300aef0aabdbb0f70d0dcf6614961a70d37441db60e99841  test/protected.test.mjs
2e53efe6b2ce20ce0d7fa965d8149ab9f9074ff7e96f05b46039fd8f4c6d498d  test/unit.test.mjs
```

## What each arm binds to

| arm | subject | bound to full SHA? |
|---|---|---|
| A | GitHub Actions workflow **inside LYING** | the push commit SHA (LYING) |
| B | reusable workflow outside LYING, checkout of inputs | yes, `subject_sha` + `base_sha` |
| C | Klasp `git commit` / PreToolUse gate | working tree + commit event, **not** GitHub SHA |
| D | Autopilot `5a56bfb8` + frozen policy | yes, head SHA + tree SHA |

## Verdict criteria (frozen)

- `PRODUCT_ADVANTAGE_SIGNAL` only if A is green on LYING, D rejects LYING and admits REPAIRED, real B misses at least one frozen weakening that D catches, C actually ran as intended, no false ADMIT on REPAIRED, D not tuned after results.
- `USEFUL_PACKAGING_ONLY` if B catches the same weakenings and D is mainly nicer packaging/fix-pack.
- `NO_DISTINCT_TECHNICAL_ADVANTAGE` if strong B matches D at similar cost.
- `INCONCLUSIVE_BASELINE_BLOCKED` if B is not a real reusable workflow, C does not run, a run URL is missing, or an arm is skipped.

Every arm: `requiredCheckEnforced=false`.

## Allowed after freeze

- Push already-created fixture SHAs to `experiment-fixture/fair-abcd-v1-*`
- One evaluated run of A, B, C, D
- Write the report from those results

## Forbidden after freeze

- Changing Autopilot source, policy, or existing tests
- Changing B workflow, Klasp version, fixture trees, or commands
- Second evaluated run
- Repairing an arm after seeing results
- Merge, GitHub App, rulesets, required checks, deploy, paid APIs, new repositories
