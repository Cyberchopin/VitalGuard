# VitalGuard

> What if the safety architecture used to protect autonomous machines could protect human health?

VitalGuard is a research prototype for multimodal physiological anomaly monitoring. It demonstrates signal validation, contextual anomaly detection, uncertainty handling, and human-controlled escalation using synthetic data.

## Run locally

Requires Node.js 22 or newer. No dependency installation is required.

- Start the dashboard: `npm start`
- Open: http://127.0.0.1:4173
- Run automated tests: `npm test`

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

Five tests currently cover:

1. Exercise without a review request.
2. Exclusion of an unreliable oxygen signal.
3. Human confirmation before escalation.
4. Unknown status after a data-stream interruption.
5. Review timeout without automatic confirmation.

These checks verify selected synthetic behaviors, not clinical performance.

## Project structure

- `dist/engine.mjs` — monitoring engine and policy parameters.
- `dist/scenarios.mjs` — deterministic synthetic signals.
- `dist/app.mjs` — dashboard and interaction logic.
- `dist/index.html` and `dist/styles.css` — interface.
- `scripts/serve.mjs` — local development server.
- `test/engine.test.mjs` — automated behavior tests.

## Scope and limitations

This prototype uses synthetic data only. It does not diagnose conditions, recommend treatment, contact emergency services, or connect to real devices.

Thresholds are demonstration parameters, not validated clinical criteria. The system is inspired by safety architecture; it is not a certified safety-critical system.

Session state is held in browser memory. Reloading or switching scenarios resets it. Export the session to preserve its recorded events.

## Next milestones

- Document architecture and failure-handling decisions.
- Extend evaluation beyond the scripted scenarios.
- Prepare the Devpost narrative and demo video.