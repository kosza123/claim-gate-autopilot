# HAMADA SEMANTIC COMPLETION — SHADOW SPIKE V0

Date: 2026-08-26  
Repo: kosza123/claim-gate-autopilot  
Branch: experiment/hamada-semantic-completion-shadow-v0  
Base (untouched main): 0738cb5c5e8dcc0f59453df53fa125591be147b0  
Status: STOPPED AFTER STAGE 0

## Terminal label

```
HAMADA_NOT_READY_FOR_SEMANTIC_SPIKE
```

This is not a commercial verdict. This is not WOW. This is not PRODUCT_ADVANTAGE.
This is a Stage-0 capability preflight result.

## Hypothesis under test

Can Hamada turn implementation-independent business rules into a deterministic
model, generate a minimal counterexample, and can frozen Claim Gate Autopilot
hand that counterexample to a repair agent?

Stage 0 answers only the first half: does Hamada already have those abilities?
It does not.

## Isolation (observed, not claimed as product)

| Pin | Exact SHA / pointer |
|---|---|
| Autopilot frozen D | 5a56bfb8fd43d60e83566e3aef87b92ebe2e4cab |
| reusable B | bf5357d92c5c2cc1de542459fa72464f347431c0 |
| Autopilot main (this branch parent) | 0738cb5c5e8dcc0f59453df53fa125591be147b0 |
| Hamada canonical git repo | kosza123/kosza123-semantic-language-2045 |
| Hamada main (docs only) | d8ebf9caaf3b2ce018fcd1d05b35487a208b4094 |
| Hamada authorized integration branch | fmajchrzak/fil-6-gate0-set-kernel |
| Hamada integration HEAD (working kernel) | da0359eca2d9db164a305e8c842b75bc3c6ff5a5 |
| FIL-14 tooling infra (A/B absent) | worker/fil-14-tooling-infra-v1 @ 930851ccb25b74273d09d92889cfa1cc315760d9 |
| Drive CURRENT_STATE | 1rT8tnNOu7xfhQG_m5VZcEJEdwqoY7YZY6DbG7DTJocE (updated 24 Aug 2026; stale vs later product work) |
| FIL-13 tooling contract | 1xkx7fzj2JZ9H-g-DiOJBljEPFeh4ZCb4hIIcaluWxpI · CONTRACT_READY · Candidate A not authorized |
| Famada plugin repo | kosza123/Famada-AI-progress-Agents @ 0307c0bdc957472d7fe688b717cc5defe5f24317 |
| claim-gate JSON judge | DEMO_ONLY (out of scope) |

Frozen Autopilot and reusable B were not modified.
No merge to main. No deploy. No GitHub App. No paid API. No LLM judge.
No booking-system implementation was written.
Known transfer-ledger defects were not reused as evidence.

---

# STAGE 0 — recovery and capability preflight

## 1. Canonical Hamada HEAD

Chat is not canonical. Two real sources disagree in scope, not in the kill:

- Drive CURRENT_STATE (24 Aug 2026): integration SHA da0359eca…, main then listed as f91664c00… (now the research/gate0-freeze branch). FIL-14 dispatched. Candidate A not authorized.
- GitHub today: `main` is d8ebf9caa… and contains only README.md + Famada/README.md. The executable SetZ kernel lives on `fmajchrzak/fil-6-gate0-set-kernel` at da0359eca…. FIL-14 PR #5 is still open against that integration branch.

Working code HEAD used for this preflight: **da0359eca2d9db164a305e8c842b75bc3c6ff5a5**.

Famada-AI-progress-Agents is a separate AgentLens / ClaimGate plugin (UNKNOWN ≠ SUCCESS). It is not a business-rule model compiler.

## 2. Working code vs documentation / plans / interfaces

Working code on the integration SHA (src/hamada):

- kernel.ts — SetZ command interpreter (add/has/iterNew/iterNext/swap/revise)
- adapter.ts — list/BST residents and phi
- commit.ts, inv.ts, pick.ts, golden.ts
- kernel.test.ts, hardening.test.ts, model.test.ts, mutation.test.ts

Working adjacent experiment code (not a product compiler):

- experiments/gate0-comparison-v2 — frozen SetZ style-model comparison; language thesis killed (FIL-11)
- experiments/tooling-benchmark-v1 — FIL-14 F2–F3 corpus/oracles/red-spec; Candidate A and Baseline B entry points missing on purpose (red-spec exit 86)

Not working product code:

- no compiler from external business rules to a model
- no host-implementation adapter for an arbitrary JS/TS program
- no minimal-counterexample receipt type
- no shadow verdict SHADOW_MATCH / SHADOW_DISAGREE / SHADOW_UNKNOWN
- FIL-13 Candidate A (admission/evidence tool) is specified and not implemented
- Drive / Linear / README language about “semantic identity” and “AI-assisted realization” is thesis text, not an executable surface

## 3. Capability table

Required by the spike hypothesis. Ratings are AVAILABLE / PARTIAL / MISSING.

| Required ability | Rating | Proof |
|---|---|---|
| Describe a bounded state machine | PARTIAL | SetZ types `K`, `Cmd`, `Event` in src/hamada/kernel.ts at da0359eca. The machine is one hardcoded abstract set (list/BST + caps + certified region). There is no input language that accepts book/cancel/confirm invariants. |
| Execute that machine deterministically | PARTIAL | `kernel(K, cmd)` is a pure command step for SetZ only. Determinism is for that kernel, not for a compiled foreign policy. |
| Generate bounded operation sequences | PARTIAL | model.test.ts BFS: UNIVERSE=[-1,0,1,2], MINS=[-1,0,1,2], MAX_DEPTH=6, MAX_CAPS=2. Sequences are hardcoded test commands, not derived from an external policy. FIL-11 reported 1,750 states / 27,552 transitions on that same bounded SetZ space. |
| Compare model with an implementation | PARTIAL / domain-closed | model.test.ts compares an independent handwritten SetZ `Model` against `kernel()`. Both live in the Hamada repo and describe the same SetZ kernel. There is no adapter that drives an external appointment-booking implementation and diffs it to a compiled model. Mutation probes in mutation.test.ts likewise probe the SetZ kernel, not a foreign program. |
| Return a minimal counterexample | MISSING | On mismatch the tests `assert` and fail. No object with invariant id, minimal op sequence, initial state, expected vs actual, program SHA, policy SHA, Hamada runtime version. No shrinking. No first-class witness type. |
| Compile implementation-independent business rules | MISSING | No policy compiler. FIL-13 explicitly excludes “a new language, parser, compiler, broad runtime”. Candidate A, if built later, is an admission/evidence tool over a frozen envelope (ADMIT/REJECT/INCOMPLETE + receipt), not a model-vs-implementation checker for book/cancel/confirm. |
| Hand a Hamada counterexample to frozen Autopilot | MISSING | Frozen Autopilot 5a56bfb8 checks SHA, protected-test deletion, skips, evidence freshness, test-surface integrity. It has no input slot for a semantic counterexample. Using it as a semantic repair router would require changing Autopilot, which this spike forbids. |

Hard stop rule from the assignment: if the deterministic model for the *target domain* or the comparison-with-implementation path is missing, do not invent a substitute language inside Autopilot.

Both are missing for the appointment domain. SetZ is the wrong machine.

## 4. Why Stages 1–5 were not executed

Stage 1 would freeze a booking system and write invariants outside the candidate.
Stage 2 would require a Hamada contract compiled to a deterministic model.
Stage 3 would dogfood frozen Autopilot only as a surface guard.
Stage 4 would emit SHADOW_* plus a structured counterexample.
Stage 5 would pack mutants for a later blind repair agent.

Doing any of that today means writing a new model checker in JS and labeling it Hamada. That is the forbidden substitute engine.

Therefore:

- no booking implementations
- no property-based arm A vs Hamada arm B
- no Autopilot run against a booking SHA
- no shadow receipts
- no repair-agent pack
- Autopilot dogfood against this domain: not attempted (`DOGFOOD_GUARD` not applicable; the spike never reached Stage 3)

## 5. What would have to exist before a retry

A later spike may restart only after Hamada (not Autopilot) exposes all of:

1. A pinned policy schema whose expressiveness is no richer than ordinary JS property tests for the same six invariants.
2. A deterministic interpreter of that policy that is not a wrapper around Mocha/node:test.
3. A host adapter: apply op sequence to a candidate module, read state/result.
4. A search/shrink that returns one minimal structured counterexample without an LLM.
5. Shadow-only emission: SHADOW_MATCH | SHADOW_DISAGREE | SHADOW_UNKNOWN.
6. Policy bytes and digest outside the candidate tree.

Until then the honest label remains HAMADA_NOT_READY_FOR_SEMANTIC_SPIKE.

FIL-13 Candidate A, even if implemented, would still be the wrong tool unless its contract is versioned to include model-vs-implementation checking. That would be a new contract, not this spike.

---

# Human report (required six answers)

## 1. What Hamada could actually do before this spike

It can run one small, frozen abstract-set kernel (SetZ). It can explore that kernel exhaustively inside fixed bounds and check it against a second handwritten model of the same kernel. It can reject some forged adapters and bad inhabitants on that kernel. Gate-0 as a new-language differentiator is already killed (FIL-11). The tooling-layer pivot has a frozen comparison contract (FIL-13) and corpus infra (FIL-14) but no Candidate A.

It cannot ingest six appointment invariants and emit a model. It cannot drive two booking implementations. It cannot return a minimal counterexample receipt.

## 2. What was built in this thread

Only Stage-0 recovery: exact HEADs, separation of code vs plans, the capability table above, this stop record, and the experiment branch. No engine. No booking domain. No Autopilot patch.

## 3. What would have been only an adapter to existing tests

Any “Hamada contract” written now as JSON plus a JS enumerator calling `book`/`cancel`/`confirm` would be ordinary model-based tests with extra files. That is arm A of Stage 2, not Hamada. Shipping it under a Hamada label would fake the spike.

## 4. Did using Hamada shorten policy authoring?

No. Hamada was not used to author a booking policy. There is no compiler that would have made that faster than writing the six invariants as tests.

## 5. What still must not be claimed

- Hamada is not a semantic completion engine for PRs.
- Autopilot ADMIT is not “the booking system is correct”.
- SetZ exploration is not general business-rule verification.
- FIL-13/FIL-14 infra is not Candidate A.
- Famada AgentLens is not this spike.
- No commercial value, no product advantage, no WOW.
- This branch does not authorize merge, deploy, App, or marketplace.

## 6. One final label

```
HAMADA_NOT_READY_FOR_SEMANTIC_SPIKE
```

Not `HAMADA_SEMANTIC_COMPLETION_SPIKE_READY`.
Not `DOGFOOD_ONLY_NO_SEMANTIC_ADVANTAGE` — that label requires both arms to exist and to show that property tests already match Hamada at similar cost. Arm B cannot exist without a substitute engine.

Checkpoint id: STAGE0_PREFLIGHT_STOP_2026-08-26
Honesty flags: shadowMode=n/a (spike not started); hamadaCompilerExists=false; substituteEngineBuilt=false; frozenAutopilotMutated=false; mainMerged=false; wowClaimed=false; commercialClaimed=false
