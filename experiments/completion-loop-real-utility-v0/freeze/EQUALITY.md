# Arm equality

Both arms receive:

- the same task text
- the same candidate SHA
- the same oracle
- the same counterexample and facts
- the same model and work limit
- at most three cycles on a defective case
- zero human hints

Only difference:

- NATIVE: JUnit/JSON + native hook
- AUTOPILOT: the same facts plus Autopilot D fix-pack and loop controller at 5a56bfb8

Autopilot must not receive extra knowledge of the intended patch.
Each thread works only its arm, does not read the other arm's results, resets the worktree to the candidate SHA before every case, and does not carry repair code across cases.
