# Isolation

oracleReadableByAgent=true

This freeze stays in one repository. An agent with repo checkout can read oracle/, fixtures, labels, and the scorecard. There is no second repo.

Hard ban for both future arm threads:

Do not open:

- oracle/model.mjs
- oracle/compare.mjs
- oracle/run.mjs
- oracle/policy.json
- oracle/commands.mjs
- experiments/completion-loop-real-utility-v0/fixtures/
- experiments/completion-loop-real-utility-v0/freeze/CATALOG.json expected classifications
- arms/SCORECARD.json before the arm finishes

Any such access voids that case as CONTAMINATED.

The candidate must not change policy, runner, fixtures, or expected results, and must not self-issue the final ADMIT. Only the external oracle writes ADMIT/REJECT/INCOMPLETE.
