# Fair B recovery v2 — freeze (before the single final push)

Frozen after a green transport preflight. After this commit: do not edit the final caller, Autopilot, reusable B, fixtures, or Klasp.

## Unchanged from v1

- Product D: `5a56bfb8fd43d60e83566e3aef87b92ebe2e4cab`
- v1 freeze: `3629820940482bd47ff476e2cc9768c5f6165bc0`
- v1 report HEAD (recovery base): `dc19799829efe739d427e0b81cdc41579b526ccb`
- Reusable B commit: `bf5357d92c5c2cc1de542459fa72464f347431c0`
- Reusable B file SHA-256: `73a849e104199bbb0feed55bc994520889fcdc2032b9179ad9010db6b5b43e60`
- Pin commit: `42005704f2b861a39ec42e9cdc4499031527bd48`
- BASE: `e73936d3efda9d8291efd9c0c9923b68db94d422`
- LYING: `f02d8102c363adb76ec0f7fc666cc74d1544d8e0`
- REPAIRED: `d9a9e9f25fa474bc5aaaf7f70caccd937b82f435`

B, D, and fixtures were not modified in this recovery.

## Final caller

- File: `.github/workflows/fair-b-final-v2.yml`
- Commit: `beb2d7f8fd6d7932cc055be1d21b549f8be73cd1`
- File SHA-256: `e1b935a4e1d5c86672d1f55faa3ac0df2df8a551166d3f3d6b94bc28e2f06cc6`
- Pin: `kosza123/claim-gate-autopilot/.github/workflows/reusable-fair-b.yml@bf5357d92c5c2cc1de542459fa72464f347431c0`
- Trigger branch (exact): `experiment-trigger/autopilot-fair-b-final-v2`
- Trigger: `on.push` only. No `workflow_dispatch`.
- Jobs (independent, no `needs`): `base`, `lying`, `repaired`

## Preflight (transport only)

- Trigger branch: `experiment-trigger/autopilot-fair-b-preflight-v2`
- Caller commit: `8381706173455cf6bff8bfbccf39d651afc6e19f`
- Run: https://github.com/kosza123/claim-gate-autopilot/actions/runs/32962855520
- Job: `preflight-base / protected-gate` (reusable actually invoked)
- Head SHA: `8381706173455cf6bff8bfbccf39d651afc6e19f`
- Conclusion: success
- `checked_out=e73936d3efda9d8291efd9c0c9923b68db94d422`
- Log: `B_DECISION=ADMIT`
- No step `skipped`

## Frozen verdict rules

- `PRODUCT_ADVANTAGE_SIGNAL` only if B actually ran, B admits BASE and REPAIRED, **B admits LYING**, and D rejected that same LYING. Then `productAdvantageProven=true`.
- `USEFUL_PACKAGING_ONLY` only if B and D make the **same** decisions **and** frozen D emits a correct machine fix-pack naming concrete repairs that B does not. Then `productAdvantageProven=false` and `COMMERCIAL_STATUS_UNPROVEN`.
- If B and D make the same decisions and the difference is only descriptive/cosmetic → `NO_DISTINCT_TECHNICAL_ADVANTAGE`. `productAdvantageProven=false`, `COMMERCIAL_STATUS_UNPROVEN`.
- Missing job, log, or unambiguous `B_DECISION=` → `INCONCLUSIVE_BASELINE_BLOCKED`.

Do not rerun A, C, or D. Use v1:

- A LYING green: https://github.com/kosza123/claim-gate-autopilot/actions/runs/32960507489
- C LYING: Klasp gate exit 2 (e2e missing); skip not detected on that frozen `klasp.toml`
- D LYING REJECT `UNAUTHORIZED_SKIP`; REPAIRED ADMIT

Honesty flags unless SIGNAL: `githubAppInstalled=false`, `requiredCheckEnforced=false`, `nonBypassable=false`, `productionSignerIsolated=false`, `signedAttestation=false`, `realAgentLoop=false`, `commercialValueProven=false`.

The trigger branch must point at **this freeze commit**. Push it once. No dispatch. No second push.
