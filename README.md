# Claim Gate Autopilot

Green-by-subtraction firewall for GitHub PRs.

A candidate may turn its own CI green by deleting, skipping, or weakening tests.
This verifier uses a **trusted policy outside the PR**, checks the evidence surface
against the base SHA, and **executes** protected argv on a clean copy of the
exact head commit.

The JSON judge in `kosza123/claim-gate` is frozen as DEMO_ONLY.

## Honest status

See `docs/V0A_BASELINE.md` and `docs/REAL_WOW_DEMO.md` on
`prototype/autopilot-real-green-subtraction-v0a`.

Not a GitHub App. Not production-ready. Not non-bypassable.

## Run

```
npm ci
npm test
```

Policy: `policies/node-green-subtraction-v0.json`  
Compiler: `src/compiler.ts`  
CLI writes **only** to `--out` (mktemp). Repository `out/` is not evidence.
