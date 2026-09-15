# Known failure modes — measured behavior, not a recovery claim

Policy vg-demo-1.1. Reproduce with `npm run evaluate`; the fault-window metrics in EVALUATION.md and per-trace `faultWindow` fields in evaluation.json use t=45..140 inclusive. No detector thresholds or algorithms were changed to produce this disclosure.

| Failure | Anomaly reviews | What the system actually reports | Interpretation |
|---|---|---|---|
| Continuous stream loss | 0/40 positive traces | All 40 enter NO DATA at t=48. Evidence sufficiency becomes zero; direct missing-contribution range is 0–100. A state event is recorded. | Missed anomaly, but loss of evidence is visible when the clock is advanced. This is not successful anomaly detection. |
| Misleading oxygen + activity, both nominal quality | 0/40 positive traces | No NO DATA or SENSOR CHECK. All 3,840 fault-window frames retain MONITORING and an index ≥ 0.70. | Silent anomaly miss with an overly reassuring evidence index. The system cannot recognize this joint fault. |

## Continuous loss: detection and observability are separate

The last frame is t=44. At t=45,46,47 its age is within the allowed three seconds. At t=48 the age exceeds that limit: 93 of the 96 fault-window seconds per positive trace show NO DATA and zero evidence sufficiency. No physiological review occurs because qualifying physiological evidence is missing.

The engine's `tick(now)` is required to discover elapsed-time staleness. The synthetic evaluation invokes it on dropped frames. The current dashboard's four scenarios do not offer a whole-stream outage control or a real-device watchdog; pausing playback pauses simulated time and is **not** a disconnection test. The evaluated downgrade is an engine status and event, not an SMS, audible alarm or notification to another person.

If a review was already pending, its separate review state remains pending during loss; an overdue event may be appended, but the system does not auto-confirm or clear it. Dedicated tests cover this case. The cohort's fault starts before a review, so that cohort itself cannot prove pending-review preservation.

## Joint misleading inputs: silent failure remains

Oxygen is replaced by a plausible near-98 reading, activity indicates movement, and reported quality remains high. Input checks accept this internally plausible evidence. The activity discount suppresses the other deviations, while the sufficiency calculation has no independent basis for questioning the reported quality. The system therefore does not request review or issue a sensor-quality downgrade.

Human confirmation cannot repair a case that never reaches the human. The index measures accepted evidence under policy assumptions; it does not validate whether those assumptions are true. Do not claim universal fault awareness, safe fallback in every failure mode, or “the system always knows when it is uncertain.”

## Required presentation wording

“We separate loss of data from a medical conclusion. In our stream-loss test, the engine reports unknown data, although it misses the underlying anomaly. When two inputs are plausibly wrong together, it can still remain in monitoring with a high evidence index. That is a documented silent failure, not a solved problem.”

The main contribution is inspectable decision architecture and **measured limits of failure visibility**, not clinical detection accuracy. Future independent signal-quality validation, additional information or redesigned policies would need separate testing; none is claimed within this submission scope.
