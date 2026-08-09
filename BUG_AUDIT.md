# Interview Assistant — Software Audit

Audit date: 2026-08-09

## Verified/fixed in this pass

### P0 — Interview state could become inconsistent on Vercel
**Finding:** The interview depended on server-side in-memory state while Vercel functions are not a reliable persistent session store.
**Fix:** Reconstruct interview state from the browser transcript on every request.

### P0 — Repeated interview questions
**Finding:** LLM question generation could repeatedly produce the same Pydantic/copay prompt.
**Fix:** Question selection is deterministic and progresses through eight controlled production scenarios. Claude is reserved for final feedback.

### P0 — Completion and domain coverage
**Finding:** Completion and charting could represent more curriculum domains than the candidate had actually answered.
**Fix:** Each answer is mapped to one sequential topic and the report renders only domains represented in the scored transcript.

### P0 — Retry could double-count an answer
**Finding:** A request could be processed by the server while the browser believed it failed, then a retry could submit the same answer again.
**Fix:** The client now includes the current candidate message as the final history item; the API detects that condition and does not score/add it twice.

### P1 — Evidence scoring was too literal
**Finding:** Exact full-sentence matching against curriculum objectives made good paraphrased answers difficult to recognize.
**Fix:** Scoring now uses normalized concept-term overlap plus evidence for failure modes, adjacent concepts, tools, reasoning, validation, monitoring, fallback, audit, and related production signals. Very short answers remain capped.

### P1 — Proctoring timer did not reliably stop on focus recovery
**Fix:** Added callback refs, timer cleanup, focus-recovery reset, and a termination guard.

### P1 — Voluntary early exit was reported as completed
**Fix:** Added a distinct ENDED EARLY state and insufficient-evidence explanation.

### P1 — API validation was weak
**Fix:** Added session ID validation, text/history limits, candidate shape validation, and safe error responses.

### P1 — Client hid API failures
**Fix:** Added HTTP/error parsing, visible error feedback, and optimistic-message rollback on failed turns.

### P1 — Candidate validator used the wrong signals shape
**Fix:** `signals` is validated as a non-null object.

### P2 — Production health endpoint was stale
**Finding:** `/api/health` reported `adaptive-v5-hardened` while the application code had advanced beyond that build.
**Fix:** Health build marker is now `adaptive-v8-production-audit` so production diagnostics match the application release.

### P2 — UI build marker was stale
**Fix:** UI marker is now `ui-v8-production-audit`.

## External production/security findings

### P0 — Production deployment is behind `main`
At audit time, production `/api/health` still reported `adaptive-v5-hardened` while `main` contained newer v7/v8 code. A deployment from the current `main` commit must be completed and verified before calling the production site current.

### P0 — Anthropic is not configured in production
Production health reported `anthropicConfigured: false`. The application has a deterministic fallback, so interviews can run, but Claude-powered final feedback is unavailable until `ANTHROPIC_API_KEY` is configured in Vercel. The secret must remain server-side.

### P1 — Next.js 14.2.24 is unsupported
The repository uses Next.js 14.2.24. Next.js currently lists 14.x as unsupported and recommends supported LTS releases. Production should be upgraded to a supported release after a controlled compatibility/build test. Do not change the major version blindly without regenerating and testing the lockfile.

### P1 — Public API lacks authentication/rate limiting
The interview endpoint is callable by a client with a self-supplied candidate/session payload. This is acceptable for a prototype/demo, but not sufficient for a high-trust production assessment platform. Add authentication, server-side candidate lookup, rate limiting, and durable session storage before public launch.

### P1 — Browser proctoring is focus-loss detection, not tamper-proof proctoring
The UI intentionally says `Proctoring Active`; it should not claim tamper-evidence. Browser focus/visibility APIs cannot guarantee that a candidate did not use another device or bypass browser signals.

## Remaining engineering work

1. Add automated unit tests for question progression, history reconstruction, idempotent retries, scoring, and completion.
2. Add an end-to-end browser test for candidate selection → interview → completion → report.
3. Upgrade Next.js to a supported LTS release in a controlled dependency migration.
4. Configure `ANTHROPIC_API_KEY` in Vercel if Claude feedback is required.
5. Add authentication/rate limiting/server-side candidate lookup before public launch.
6. Add durable session storage if interviews must survive refreshes/devices or run concurrently at scale.
7. Add structured request IDs and server-side observability.
8. Add accessibility testing for keyboard navigation, focus management, reduced motion, and screen readers.

## Release verification checklist

- `npm run typecheck`
- `npm run build`
- Open `/api/health` and confirm `ok: true` and the current build marker
- Start a new interview and verify the opening question
- Send short answers and verify they are not presented as evidence of technical skill
- Send substantive technical answers and verify scores respond to demonstrated evidence
- Retry a submitted turn and verify it is not double-counted
- Complete eight turns and verify only assessed domains appear
- Verify skill scores remain between 0 and 100
- Test focus loss and focus recovery without accidental termination
- Test voluntary End Interview and confirm `ENDED EARLY`
- Test a failed API request and verify retryable UI feedback
- Verify production deployment is running the same commit intended for release
