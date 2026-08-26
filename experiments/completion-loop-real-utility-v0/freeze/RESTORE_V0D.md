# RESTORE V0D

Canonical source: `/workspace/artifacts/completion-loop-real-utility-v0/tree/oracle/run.mjs`
Transport: `cp` then `git add oracle/run.mjs` (no Contents API, no hand edit of escapeXml).

## Hashes

- broken remote v0c `oracle/run.mjs`: `65f44a2e436e5cb22a6a7cca06984a518bb17ca5a47b5a046c80458343934c87`
- canonical artifact: `219a3f339fdb7659f0d396dec127cb9a298457c114e8adf098d416a740506602`
- restored worktree: `219a3f339fdb7659f0d396dec127cb9a298457c114e8adf098d416a740506602`

`cmp` canonical vs restored: identical.
Diff vs v0c: single `escapeXml` line restored from the artifact file bytes.

Parent: `3da559afeada56e93e4cefcb6dbb9ceb4c9abd39`
