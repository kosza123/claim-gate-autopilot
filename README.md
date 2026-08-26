# fixture-product
Fair A/B/C/D subject. Not Autopilot source.

## Transfer ledger

`applyTransferBatch(state, requests)` in `src/transfer-ledger.mjs` applies an atomic batch of integer-cent transfers without mutating inputs. Successful transfers update `balances` and `sentToday` and store a normalized record in `processed`. Replays of the same `id` with identical parameters are no-ops even if the original accounts no longer exist; conflicting parameters reject the whole batch. Maps use own-property get/set so keys such as `toString`, `constructor`, and `__proto__` are ordinary ids. Failures throw `TransferError` with a `code` (`INVALID_STATE`, `INVALID_REQUEST`, `ACCOUNT_NOT_FOUND`, `INSUFFICIENT_FUNDS`, `DAILY_LIMIT_EXCEEDED`, `IDEMPOTENCY_CONFLICT`) and `requestId` when the error belongs to a specific request.

## KNOWN_LIMITATIONS

Not `none`. Remaining, unfixed limits of this ledger:

- Single-threaded in-memory only. No persistence, no concurrency control, no cross-process locking.
- `dailyLimitCents` is taken from each request, not from a durable per-account policy.
- Amounts are IEEE safe integers (cents). No BigInt, no decimal types, no rounding rules for FX.
- Extra request fields are ignored; extra state metadata is preserved but not schema-validated.
- Batch size and map size are unbounded.
- Output maps are mutable. Callers must copy if they need a freeze.
- Not a security boundary: no authn/authz, no signatures, no audit log beyond `processed`.
- Autopilot policy at `5a56bfb8` does not cover these invariants. Passing ADMIT on the pre-repair SHA did not prove ledger correctness.
