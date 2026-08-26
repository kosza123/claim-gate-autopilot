## Claim Gate Autopilot
**REJECT** — SHA `8f3a21c`  ·  cycle 1/3
4 duty(ies) broken on 8f3a21c. Fix pack has 4 action(s).
- pass  **Unit tests present** — src/withdraw.test.ts still on the SHA
- FAIL  **Test config intact** — Test runner config differs from base — protected suite can be excluded
- FAIL  **Protected tests still run** — Protected tests skipped, focused, or deleted on this SHA
- FAIL  **CI workflow intact** — Workflow on this SHA dropped required jobs
- FAIL  **Required E2E still scheduled** — E2E job removed from the SHA
### Fix pack

```json
[
  {
    "op": "restore_file",
    "path": "vitest.config.ts",
    "reason": "Restore test config from base"
  },
  {
    "op": "remove_skip",
    "path": "src/protected.test.ts",
    "reason": "Protected test was skipped or focused"
  },
  {
    "op": "restore_file",
    "path": ".github/workflows/ci.yml",
    "reason": "Restore CI workflow from base"
  },
  {
    "op": "run",
    "cmd": "npm test && npm run e2e",
    "reason": "Re-run required suites on this SHA"
  }
]
```
_Fail closed. Merge stays blocked._
