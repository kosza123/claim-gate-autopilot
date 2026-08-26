# fixture-product
Fair A/B/C/D subject. Not Autopilot source.

## Transfer ledger

`src/transfer-ledger.mjs` exports `TransferError` and `applyTransferBatch(state, requests)`.

Transfers are integer cents. The function never mutates its inputs. A batch is
atomic: one invalid request applies none of them. Requests are applied in order,
so earlier transfers change later balances and daily totals. Identical request
ids replay as a no-op; the same id with different fields rejects the batch.
