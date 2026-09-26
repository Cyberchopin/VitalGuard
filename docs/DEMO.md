# Three-minute demonstration

**0:00–0:20 — Thesis and scope.** “VitalGuard studies how a monitoring agent should respond when evidence is uncertain. All signals today are synthetic. We distinguish what is observed from what a person has reviewed.”

**0:20–0:50 — Activity & recovery.** Select Activity & recovery, then Skip to key moment (01:10). Show rising HR/RR with movement and no human review. Open “Why this assessment?” to show the activity discount and contribution arithmetic.

**0:50–1:20 — Sensor disconnect.** Select Sensor disconnect, then Skip to key moment (01:05). Show unreliable oxygen excluded, SENSOR CHECK, and a wider missing-contribution range. “A low observed score is not a statement that the person is safe.”

**1:20–2:00 — Converging signals.** Click Try human review to replay actual engine samples to the first review at 01:08; playback pauses automatically. Expand the event evidence and current calculation. Show the five review gates. Enter a note and confirm. Explain that high priority is a local demo label; no external notification has been sent.

**2:00–2:35 — Failure visibility and its limits.** Show the on-page Evidence & limits table (full protocol remains in EVALUATION.md). Say: “Both groups miss all 40 anomalies. Stream loss produces NO DATA and zero evidence index in the engine. Jointly misleading oxygen and activity stays MONITORING with a high index: that is a silent failure we have not solved.” Do not simulate stream loss by pausing the UI: pause freezes simulated time. Do not present synthetic metrics as clinical performance.

**2:35–3:00 — Audit boundary.** Export a sealed report. Explain immutable in-memory snapshots and digest verification, including why this is not a signed, tamper-proof external audit log. Finish with the next step: real signal-quality validation and persistent single-writer session ownership.

# Devpost draft

## Inspiration
Autonomous-system safety designs separate sensing, uncertainty, escalation and authority. VitalGuard explores that separation in a synthetic physiological monitoring workflow: a system should explain both what changed and whether the evidence deserves trust.

## What it does
The prototype monitors simulated heart rate, oxygen saturation, respiratory rate and activity. It checks signal quality, learns a robust resting baseline, fuses directional anomalies and requests human review after sustained corroboration. Observation status remains separate from review status so an outage cannot disappear behind an outstanding decision.

## How we built it
Browser-native JavaScript modules share a deterministic engine with Node.js tests and evaluation scripts. Median/MAD baseline fitting and explicit rules produce inspectable features. Review actions append events rather than editing history; exported JSON is sealed with SHA-256 for integrity checking. No external model API or paid infrastructure is required to run the demo.

## Challenges and learning
Separating current episode state from past event objects prevented accidental historical mutation. Time-based gates needed actual new samples rather than clock ticks. Synthetic fault evaluation revealed that misleading activity could suppress corroborated anomalies; accepted oxygen evidence now vetoes that discount. Simultaneous misleading oxygen and activity remains a documented failure mode.

## Results and limitations
See the repository's generated evaluation report for exact cohort metrics. Results concern perturbed synthetic templates only. Continuous loss is visible as NO DATA when the engine clock advances, but does not detect the underlying anomaly. Joint plausible errors in oxygen and activity remain a silent miss with a high evidence index. Human confirmation does not protect anomalies that never reach review. Evidence confidence is an explicitly specified sufficiency index, not a calibrated medical probability. Clinical validation, real device integration, durable multi-user state and authenticated audit storage are not implemented.

## Next steps
During the competition, prioritize reproducibility, manual acceptance and clear failure disclosures. Open-data validation, recalibration and transactional persistence are post-demo research/engineering directions; they are not promised competition deliverables. See SUBMISSION_PLAN.md for the finishing schedule.

# Technical resume wording (verify metrics against the submitted revision)

Built a JavaScript physiological-anomaly prototype with robust per-session baseline fitting, quality-aware rule fusion, human-confirmation state transitions and immutable event snapshots; evaluated behavior across deterministic synthetic noise and sensor-failure cohorts using reproducible detection and latency metrics.
