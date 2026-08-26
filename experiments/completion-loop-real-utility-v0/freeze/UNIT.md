# Experiment unit — frozen

One unit = one candidate case.

Cases: 12 labeled defective + 5 labeled good = 17.
Each case starts from the same candidate SHA on NATIVE and AUTOPILOT.
A defective case may use at most 3 repair cycles.
A good case must end without an unnecessary code change.
Each cycle produces a new SHA and a fresh oracle result.
No result, crash, or stale SHA = INCOMPLETE. Record it. Do not silent-retry.
The result of case A must not be counted as the result of case B.

## ≥80% repaired

(number of defective cases that reach a true oracle ADMIT in ≤3 cycles) / 12

Do not count findings or fix-pack actions as repairs.
Do not count Autopilot ADMIT as a true repair.
m04 is labeled defective in the catalog but its frozen bytes equal the good map-store. That case cannot become a true repair without changing the frozen mutant, which this freeze forbids.
