# Interview Assistant — Software Audit

Audit date: 2026-08-09

## Fixed in this pass

### P0 — Interview state could become inconsistent on Vercel
**Finding:** The interview depended on server-side in-memory state while Vercel functions are not a reliable persistent session store.
**Fix:** Reconstruct interview state from the browser transcript on every request. The API now treats the supplied history as the continuity source.

### P0 — Repeated interview questions
**Finding:** LLM question generation could repeatedly produce the same Pydantic/copay prompt.
**Fix:** Question selection is now deterministic and progresses through eight controlled production scenarios. Claude is reserved for final evidence-based feedback.

### P0 — Interview could fail to complete
**Finding:** Completion required eight answers and four covered days, but topic progression could leave fewer than four days covered.
**Fix:** Each candidate answer is mapped to its sequential topic before the topic index advances, and all restored historical answers contribute to `coveredDays` and scoring.

### P1 — Proctoring timer did not reliably stop on focus recovery
**Finding:** Focus/visibility recovery did not clear the grace-period warning/timer. Callback identities also caused unnecessary effect churn.
**Fix:** Added callback refs, explicit timer cleanup, focus-recovery reset, and a termination guard so the violation callback can fire only once.

### P1 — Voluntary early exit was reported as a completed evaluation
**Finding:** Clicking End Interview sent the user to the report with the default "EVALUATION COMPLETE" state.
**Fix:** Added a distinct `ENDED EARLY` report state and an explicit insufficient-evidence explanation.

### P1 — API input validation was weak
**Finding:** The API accepted malformed session IDs, oversized text, malformed history, and incomplete candidate objects.
**Fix:** Added session ID validation, text/history limits, candidate shape validation, and safe error responses.

### P1 — Client hid API failures
**Finding:** Failed start/send requests could leave the interview UI looking stuck or blank.
**Fix:** Added HTTP/error parsing, visible error feedback, and removal of an optimistic candidate message when a turn fails so retrying does not double-count it.

### P1 — Candidate validator used the wrong `signals` shape
**Finding:** `Candidate.signals` is an object, but the validator checked it with `Array.isArray`, which would reject valid candidates.
**Fix:** Validate `signals` as a non-null object.

### P2 — No production health endpoint
**Finding:** There was no simple endpoint to distinguish an unavailable deployment from an application/API problem.
**Fix:** Added `GET /api/health` with build version, configuration status, and timestamp; response is explicitly `no-store`.

### P2 — Type verification was not a first-class script
**Finding:** The project had build/lint commands but no dedicated TypeScript check.
**Fix:** Added `npm run typecheck`.

## Remaining engineering recommendations

1. Add automated unit tests for question progression, history reconstruction, scoring, and completion.
2. Add an end-to-end browser test for candidate selection → interview → completion → report.
3. Move long-term session state to a durable store if interviews must survive refreshes/devices or support concurrent workers.
4. Add rate limiting/authentication before exposing the interview API publicly.
5. Add structured request IDs and server-side observability rather than relying only on `console` logs.
6. Keep the Anthropic API key server-side only; never expose it through client environment variables.
7. Consider schema validation with Zod or equivalent for request bodies once the API contract stabilizes.
8. Add a dedicated error boundary for unexpected client rendering failures.
9. Verify accessibility with keyboard navigation, focus management, reduced-motion preferences, and screen-reader labels.

## Release verification checklist

- `npm run typecheck`
- `npm run build`
- Open `/api/health` and confirm `ok: true`
- Start a new interview and verify the opening question
- Send at least three distinct answers and verify questions advance
- Complete eight turns and verify the report appears
- Verify skill scores render between 0 and 100
- Test focus loss and focus recovery without accidental termination
- Test voluntary End Interview and confirm `ENDED EARLY`
- Test a failed API request and verify the UI gives a retryable error
