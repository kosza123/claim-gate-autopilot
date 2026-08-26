# fixture-product
Fair A/B/C/D subject. Not Autopilot source.

## Transfer ledger

`applyTransferBatch(state, requests)` in `src/transfer-ledger.mjs` applies an atomic batch of integer-cent transfers without mutating inputs. Successful transfers update `balances` and `sentToday` and store a normalized record in `processed`. Replays of the same `id` with identical parameters are no-ops; conflicting parameters reject the whole batch. Failures throw `TransferError` with a `code` (`INVALID_STATE`, `INVALID_REQUEST`, `ACCOUNT_NOT_FOUND`, `INSUFFICIENT_FUNDS`, `DAILY_LIMIT_EXCEEDED`, `IDEMPOTENCY_CONFLICT`) and `requestId` when the error belongs to a specific request.
