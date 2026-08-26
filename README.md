# fixture-product
Fair A/B/C/D subject. Not Autopilot source.

## Transfer ledger

`applyTransferBatch(state, requests)` applies an atomic batch of transfers.

- Amounts are integer cents and must be positive safe integers.
- Inputs are never mutated; success returns a new state.
- Requests run in order, so earlier transfers affect later balances and daily limits.
- If any request is invalid, the whole batch is rejected with `TransferError`.
- A retry with the same `id` and same parameters is a no-op.
- The same `id` with different parameters is `IDEMPOTENCY_CONFLICT`.
