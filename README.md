# VitalGuard

VitalGuard is a browser-native physiological anomaly research prototype: per-session median/MAD fitting, quality-aware rule fusion, separate observation/review states, immutable event snapshots and human-controlled escalation. All evaluation data is synthetic.

The motivating question is: what if the safety architecture used to protect autonomous machines could protect human health? The implementation and its limits are specified below; no clinical or safety certification is claimed.

## Run locally

Requires Node.js 22 or newer. No dependency installation is required.

- Start the dashboard: `npm start`
- Open: http://127.0.0.1:4173
- Run automated tests: `npm test`
- Check module syntax and local asset paths: `npm run check`
- Regenerate quantitative results: `npm run evaluate`
- Verify an exported report: `node scripts/verify-report.mjs <session.json> [independently-retained-sha256]`

No build step is required; `dist/` contains authored source, not disposable build output. Google Fonts is optional and falls back to system fonts offline.

## Monitoring pipeline

Signal ingestion → quality checks → temporal features → anomaly fusion → evidence confidence → escalation policy → human review → event timeline.

Inputs: heart rate, oxygen saturation, respiratory rate, and activity.

A statistical detector learns a resting baseline using median and median absolute deviation (MAD). Transparent rules combine baseline deviations with demo thresholds. Evidence confidence is an engineering heuristic, not a medical probability.

## Demo scenarios

- **Activity & recovery:** movement explains elevated heart and respiratory rates.
- **Quiet deterioration:** gradual changes across signals produce a review request.
- **Sensor disconnect:** unreliable oxygen readings trigger a sensor check.
- **Converging signals:** sustained, corroborated anomalies request human confirmation.

Only human confirmation enables the demo’s HIGH PRIORITY state. Unanswered reviews remain pending.

## Automated checks

Tests cover scripted behaviors plus review-time outages, recovery/re-arming, duplicate and invalid decisions, frozen historical evidence, monotonic event times, malformed inputs, sample-gap persistence, context faults, confidence arithmetic and SHA-256 export verification. See `test/engine.test.mjs` and `test/safety.test.mjs`.

The reproducible evaluation contains 644 synthetic traces. In the 200-trace noise/baseline-offset cohort, all 100 positive scenarios requested review and none of the 100 negative scenarios did; median/p95 detection delay from synthetic onset was 40/43 seconds. With 5% intermittent frame loss the corresponding delay was 41/52 seconds. These are development-cohort results, not patient-level sensitivity or specificity.

The report also exposes failures: prolonged data loss missed all 40 positive cases, as did jointly misleading oxygen and activity. See [evaluation protocol and complete results](docs/EVALUATION.md) before citing any number. No formal reliability proof is claimed.

These failures behave differently: on continuous loss, `tick(now)` produces NO DATA and zero evidence sufficiency at t=48 in all 40 positive traces. With jointly misleading oxygen and activity, all 40 remain MONITORING with index ≥ 0.70 throughout the measured fault window: **a silent failure with no sensor-quality downgrade**. Read [known failure behavior](docs/KNOWN_LIMITATIONS.md). The dashboard does not currently offer a whole-stream outage control; these loss checks exercise the engine. “No data” is not successful anomaly detection, and no external alert is sent.

## Project structure

- `dist/engine.mjs` — monitoring engine and policy parameters.
- `dist/scenarios.mjs` — deterministic synthetic signals.
- `dist/app.mjs` — dashboard and interaction logic.
- `dist/audit.mjs` — canonical JSON and SHA-256 export seals.
- `dist/index.html` and `dist/styles.css` — interface.
- `scripts/serve.mjs` — local development server.
- `test/engine.test.mjs` — automated behavior tests.
- `test/safety.test.mjs` — state, evidence integrity and failure-handling tests.
- `scripts/evaluate.mjs` — seeded cohorts and input-quality sensitivity analysis.

## Technical documentation

- [Architecture and state contract](docs/ARCHITECTURE.md)
- [Confidence formula, score bounds and design limits](docs/UNCERTAINTY.md)
- [Evaluation summary](docs/EVALUATION.md) and [per-trace results](docs/evaluation.json)
- [Three-minute demo and Devpost draft](docs/DEMO.md)

Open **Why this assessment?** to inspect every score term, confidence factor and review gate. Alert events retain their own trigger-time evidence rather than reading live values.

## Scope and limitations

This prototype uses synthetic data only. It does not diagnose conditions, recommend treatment, contact emergency services, or connect to real devices.

Thresholds are demonstration parameters, not validated clinical criteria. The system is inspired by safety architecture; it is not a certified safety-critical system.

Session state is held in browser memory. Reloading or switching scenarios resets it. Export the session to preserve its recorded events. Exports now use a versioned envelope with `payload` and a SHA-256 `digest`; this is a breaking change from the original raw report shape. They cannot restore an active session.

Events are immutable through returned application objects. Digest verification detects changed export contents, but an attacker able to replace both payload and digest can recompute the seal. Retain the digest independently for replacement detection. There is no authenticated identity, external audit anchor or tamper-proof database.

The baseline is fitted per session and then frozen. It does not model long-term drift. Architecture documentation explains the choice and a proposed production persistence/concurrency design; neither is presented as implemented functionality.

## Next milestones

- Validate on appropriately labeled open physiological recordings.
- Design a versioned, explicit baseline recalibration workflow.
- Implement authenticated transactional persistence if expanding beyond the demo.
- Record the demo and prepare the final submission artifacts.


## Submission interface update - September 22, 2026

Try human review replays actual synthetic frames to the first pending review. Skip to key moment replays to a representative point without bypassing the engine. The page now includes selected evaluation results, explicit silent-failure disclosure, and a downloadable [one-page project brief](dist/VitalGuard-project-brief.pdf). All sessions remain in memory; resetting a scenario or refreshing discards the current session. Export before switching if you need to retain it.

The simulation engine and its thresholds are unchanged. See [release validation](docs/RELEASE-2026-09-22.md) and [recording script / Devpost text](docs/DEMO.md).
