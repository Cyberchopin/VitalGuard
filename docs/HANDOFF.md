# Handoff — local v1.1 working tree

## What changed

- Independent observation/review states; pending or confirmed concerns survive loss of current evidence.
- Frozen event snapshots with replacement episode objects; failed and duplicate decisions do not mutate state.
- Recovery starts after the decision and requires new consecutive samples. Rejected frames/clock ticks cannot satisfy persistence.
- Explicit confidence arithmetic, score terms, review gates and trigger-time evidence.
- SHA-256 sealed exports and a verifier (integrity, not authenticated audit storage).
- Reproducible synthetic development cohorts and quality sensitivity; known failures retained.
- Oxygen corroboration can veto a misleading activity discount.

## Verify before committing

Run `npm test`, `npm run check`, and `npm run evaluate`. Refresh the running dashboard to load the changed modules; a refresh intentionally resets the in-memory session.

Manual acceptance: run Converging signals, pause at review, open Why this assessment, inspect five gates and each contribution, confirm with a note, then export. Verify the downloaded JSON with `node scripts/verify-report.mjs <path>`. The exported report is now wrapped in `{format, algorithm, digest, payload}`.

On September 14, a successful fetch confirmed the initial local and remote histories matched. The hardened implementation was committed locally as `bf5709a`. Subsequent documentation adds measured failure visibility and a submission schedule. Consult the current Git history for the final remote publication revision. Existing `.openai/` and `README.pdf` were left untouched and excluded from the GitHub snapshot; the PDF predates these README updates and should not be used as the current specification.

## Remaining work

Real-signal validation, baseline drift/recalibration, durable session restoration and multi-client concurrency are not implemented. UI source/syntax checks do not replace manual browser acceptance. The evaluation uses development templates; its numbers should never be described as clinical accuracy. Submission recording and a final one-page PDF remain user-facing finishing tasks.
