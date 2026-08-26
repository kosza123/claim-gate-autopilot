# NATIVE arm

Branch start: experiment/completion-loop-native-v0
oracleReadableByAgent=true

Same oracle, catalog, facts, cycle limit as AUTOPILOT.
No Autopilot fix-pack.

Banned reads (case becomes CONTAMINATED):

- oracle/model.mjs, compare.mjs, run.mjs, policy.json, commands.mjs
- fixtures/ and freeze/CATALOG.json expected labels
- SCORECARD.json before the arm ends

Reset worktree to the case candidate SHA before every case.
Max 3 cycles on a defective case.
Do not carry patches across cases.
Do not read the AUTOPILOT thread.
Fill SCORECARD.json only at the end.
