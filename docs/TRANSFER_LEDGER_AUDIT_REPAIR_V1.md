# Transfer ledger audit repair v1

Labels:

```
TRANSFER_LEDGER_AUDIT_REPAIR_PASS
POLICY_COVERAGE_GAP_CONFIRMED
AUTOPILOT_ADVANTAGE_UNPROVEN
```

This is not evidence of Autopilot advantage. Autopilot did not find or fix these bugs. Its frozen policy at `5a56bfb8` does not check them.

## Branch

`repair/transfer-ledger-b-audit-v1` started at B result `0dff7d3be3074ca67ec5ddbbe80f7a9ea11ccc49`.

## Untouched SHAs

- A: `a232fa78252167bca5c4b622187c79c383bcfaf0` (`dogfood/transfer-ledger-run-a`)
- B result: `0dff7d3be3074ca67ec5ddbbe80f7a9ea11ccc49`
- B branch later head (not used): `554d9e296e0b58765ced0cddf2417e9701c90d7a`
- Autopilot: `5a56bfb8fd43d60e83566e3aef87b92ebe2e4cab`

No force-push. No merge to `main`.

## Changed files

- `src/transfer-ledger.mjs`
- `test/unit.test.mjs`
- `README.md`
- `docs/TRANSFER_LEDGER_AUDIT_REPAIR_V1.md`

## Local results

- `npm test`: 29 pass, 0 fail, 0 skipped
- `npm run e2e`: pass
- withdraw + protected tests: pass
- new regressions: toString/constructor/__proto__ ids, __proto__ sender daily limit, replay after deleted accounts, conflict before ACCOUNT_NOT_FOUND, receiver overflow, Date/Map/Set/class maps, extra metadata, invalid dailyLimitCents

## Dynamic key audit

No `obj[key] =` remains in `src/transfer-ledger.mjs`. Reads/writes of `balances`, `sentToday`, and `processed` go through `ownHas` / `ownGet` / `ownSet` (`Object.getOwnPropertyDescriptor` + `Object.defineProperty`).
