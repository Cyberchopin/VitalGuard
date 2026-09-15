# Evidence sufficiency and uncertainty specification

The UI retains “evidence confidence” for continuity. Its precise meaning is an **evidence sufficiency index** C, not the probability of an anomaly, a medical event or a correct decision. The index is a deterministic policy input, not a learned uncertainty model. The statistical detector and the sufficiency policy are separate components.

## Exact sufficiency formula

For k in {HR, SpO₂, RR, activity}, let qₖ be reported signal quality. Set aₖ = qₖ only if the value is finite, in its input range, passes the frozen-signal test, qₖ ∈ [0.65, 1], and frame age ≤ 3 s; otherwise aₖ = 0.

```
Q = (a_hr + a_spo2 + a_rr + a_activity) / 4
K = 1 if activity is accepted, else 0.5
B = 1 after baseline calibration, else 0.5
C = min(Q, K) × B
```

Fresh qualities (0.98, 0.98, 0.97, 0.99) yield C = 0.98. Excluding oxygen yields C = 0.735. Missing activity caps C at 0.5. Before calibration the multiplier halves it. A stale stream sets all aₖ to zero, so C = 0. Missing confidence in a channel is not imputed from other channels.

Within the accepted region and below the context cap, ∂C/∂qₖ = B/4. Above the cap it is zero. At qₖ = 0.65 there is an intentional discontinuity caused by rejecting low-quality evidence. Baseline completion is another discontinuity. These are policy choices that require domain validation before real use. The input quality values themselves come from the simulator and are not sensor-calibrated reliability probabilities.

## Detector and fusion formula

Calibration per channel: center = median(x); scale = max(floor, 1.4826 × median(|x − center|)), with floors HR=4, SpO₂=0.8, RR=1.5. Per-session fitting is limited personalization; there is no longitudinal subject model. The factor is a conventional robust scale approximation, not an assumption that physiological tails are Gaussian.

Use the last 5 seconds of accepted values to compute median v. Directional z = (v − center)/scale for HR/RR and (center − v)/scale for SpO₂. Only these demo directions are scored; low heart rate or low respiratory rate is not modeled as an anomaly.

```
clip(x) = min(1, max(0, x))
rule_hr   = clip((v_hr − 100) / 50)
rule_spo2 = clip((96 − v_spo2) / 8)
rule_rr   = clip((v_rr − 22) / 12)
novelty_k = 0.6 × clip((z_k − 3) / 5)
severity_k = max(rule_k, novelty_k) × context_k
score = round(25 × severity_hr + 45 × severity_spo2 + 30 × severity_rr)
```

Activity ≥ 0.35 multiplies HR/RR by 0.15 unless accepted oxygen severity ≥ 0.25 vetoes the discount. Oxygen is never discounted. Missing physiological channels contribute zero. Explainability snapshots retain raw values, medians, z-scores, each rule and novelty term, context multipliers, weights, gate outcomes and baseline.

## Bounds, not probability intervals

The displayed score range is `[S, min(100, S + missing weights)]` on the rounded demo scale, holding accepted features and current context fixed. It bounds only direct missing physiological-channel contributions. It does not cover measurement error in accepted signals, model error, or the effect of unobserved oxygen on the activity veto. Missing activity is handled by the confidence cap rather than a score weight. This is **not** a statistical confidence interval or a bound on medical risk.

Review requires baseline calibration, S ≥ 55, C ≥ 0.70, at least two severity terms ≥ 0.25, and eight elapsed seconds of consecutive qualifying samples. Confirmation remains a separate human action. Corroborating channels are not assumed to be statistically independent: HR and SpO₂ may share a device in a future integration.

## Evaluation and next research step

[EVALUATION.md](EVALUATION.md) and `evaluation.json` contain a fixed-quality sweep and cohort-level detection/delay metrics. No probability calibration score is reported because C is not a probability and synthetic labels cannot calibrate real clinical uncertainty. Do not rename it a probability to strengthen the pitch.

A future empirical model needs device-quality ground truth, per-subject/time-separated train/calibration/test sets, an explicitly defined anomaly target and a drift protocol. Calibration or conformal coverage must be evaluated on that defined target under its stated assumptions. Adding such methods to four scripted templates would not establish real-world coverage.
