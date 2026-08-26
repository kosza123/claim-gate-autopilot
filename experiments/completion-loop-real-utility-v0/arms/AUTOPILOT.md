# AUTOPILOT arm

Branch start: experiment/completion-loop-autopilot-v0
oracleReadableByAgent=true

Same oracle, catalog, facts, cycle limit as NATIVE.
Additional input only: Autopilot D 5a56bfb8 fix-pack and loop controller.

Autopilot ADMIT is surface + duty exit 0, not booking correctness.
Autopilot must not receive extra knowledge of the intended patch.

Banned reads (case becomes CONTAMINATED):

- oracle/model.mjs, compare.mjs, run.mjs, policy.json, commands.mjs
- fixtures/ and freeze/CATALOG.json expected labels
- SCORECARD.json before the arm ends

Reset worktree to the case candidate SHA before every case.
Max 3 cycles on a defective case.
Do not carry patches across cases.
Do not read the NATIVE thread.
Fill SCORECARD.json only at the end.
