# Autopilot v0a baseline (frozen before code changes)

Recorded from `kosza123/claim-gate-autopilot` at branch creation.

## Git

- repository: `kosza123/claim-gate-autopilot`
- branch started from: `main`
- **base SHA (actual HEAD): `0738cb5c5e8dcc0f59453df53fa125591be147b0`**
- requested reference `0738cb5c5e8dcc0f59453df53fa125591be147b0`: **match**
- diff vs 0738cb5: empty (working tree at this SHA)
- prototype branch: `prototype/autopilot-real-green-subtraction-v0a`
- storyboard sources copied, not rewritten, into `archive/v0-storyboard-*.ts`

## CI at baseline

| run | commit | conclusion |
|---|---|---|
| 32951064184 | `a48b89a` Claim Gate Autopilot v0 | **success** (used committed `out/verdict.txt`) |
| 32951087666 | `0738cb5` Ignore local out/ | **failure** (workflow still `cat out/verdict.txt`) |

Current `main` CI is red. First green was poisoned by a repository output file.

## Honesty flags

```
realTestsExecuted=false
realAgentLoop=false
githubAppInstalled=false
requiredCheckEnforced=false
productionSignerIsolated=false
nonBypassable=false
productAdvantageProven=false
wowProven=false
signedAttestation=false
```

## Known P0 / P1 (must close)

1. P0 `BASE.withdraw` is wrong; compiler can still ADMIT.
2. P0 `run: npm test && npm run e2e` is text, never executed.
3. P0 `applyFixPack()` ignores `run` and stamps fake SHA `c72d10a`.
4. P0 missing duties can ADMIT.
5. P0 rules hard-coded to `src/withdraw.test.ts`.
6. P0 first green CI used repo `out/verdict.txt`.
7. P0 after deleting `out/`, CI is red.
8. P1 `MAX_CYCLES=3` is not a real loop.
9. P0 no test-result source / exit code.
10. P0 no binding of proof to full SHA + tree digest.
11. P1 any config change treated as attack, including legal ones.
12. P1 no comparison vs ordinary CI or Klasp.

## Not in this freeze

No GitHub App, no ruleset changes, no merge, no deploy, no claim.json, no LLM judge.
