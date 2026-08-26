# Claim Gate Autopilot

Leave the agent on the task. Autopilot independently finds gaps, sends a machine-readable fix pack, and calls a human only when the exact SHA has complete duties.

The JSON judge (`kosza123/claim-gate`) is frozen as DEMO_ONLY.

## What this is

A PR completion compiler. Not an AI-truth detector. Not more `claim.json` fields.

Trusted: this Action + `compiler.ts`. Untrusted: the PR.

Missing data, a crash, a skipped protected test, a mutated workflow, or a stale SHA → `INCOMPLETE` or `REJECT`. Never a silent ADMIT.

## Pin

    - uses: actions/checkout@v4
      with:
        fetch-depth: 0
    - uses: kosza123/claim-gate-autopilot@PIN_SHA

## Demo

    AUTOPILOT_DEMO=lying node --experimental-strip-types cli.ts
