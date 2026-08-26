# TRANSPORT V0C

Branch: repair/completion-loop-ab-freeze-v0c
Parent: repair/completion-loop-ab-freeze-v0b @ d890500ed271ea63927d509b06fabe2b5b639ea6

## Why nine files were missing on v0b

git status --short on a clean clone of v0b: empty.
git status --ignored --short: empty.
.gitignore: `out`, `node_modules`, `oracle-out` only.
git check-ignore -v on each missing path: not ignored.
git ls-tree -r of d890500e: paths absent.

Cause for every missing path: **nieutworzony na remote**.
v0b uploaded fixtures through incomplete GitHub Contents API batches.
Those nine blobs were never created, never staged, never committed.

| path | cause |
|---|---|
| fixtures/mutants/m05-missing-cancel-creates.mjs | nieutworzony (batch never included this file) |
| fixtures/mutants/m06-partial-book-crash.mjs | nieutworzony |
| fixtures/mutants/m07-confirm-missing-creates.mjs | nieutworzony |
| fixtures/mutants/m10-steal-occupied-slot.mjs | nieutworzony |
| fixtures/good/g2-event-log.mjs | nieutworzony |
| fixtures/good/g4-event-log-cached.mjs | nieutworzony |
| fixtures/good/g5-map-store-frozen-snap.mjs | nieutworzony |
| freeze/CATALOG.json | nieutworzony |
| freeze/MANIFEST.sha256 | nieutworzony |

Not gitignore. Not wrong path. Not a staging skip of a local worktree.

## This commit

Adds those nine files only, plus this report.
Does not change oracle, policy, model, generator, existing fixtures, Autopilot, B, protocols, or orders.
