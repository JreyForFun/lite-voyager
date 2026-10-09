# Progress

## Current phase / task
Phase: Milestone 0B. T-002 fixes committed; local full gate passes, fresh CI pending.
T-000, T-001, T-003, T-006, T-005, T-007 remain checked. T-002 stays unchecked.

## Verify status
- npm run verify and verify:full pass: 103 unit and six integration tests/strict logs.
- Package includes helper, worker, local sql.js loader/WASM/license; under 1 MB.
- VS Code 1.141.0 fixes pass six integration tests/strict logs (20/35 ms cancel).
- Windows x64: bundled Node 24.21.0; native SQLite 3.53.4; fallback SQLite 3.49.1.
- Final full gate: native 21 ms / fallback 22 ms; exit/reopen/source hashes verified.
- Owner QA: native 24 ms / fallback 92 ms; both recover and typing stays responsive.
- Core cloud-dictation startup warnings intermittently fail the strict host gate.
- T-002 CI run 37916047454 passes Windows, macOS, Linux full verification.
- Tested SHA: f3085869c88262b2ffdbfddb47805f6287cdcc3a (attempt 1, 2026-10-09).

## Last session
- Worker-only native cancellation took 11,042 ms; replaced by killable helper.
- Added cancel-during-open, concurrent close, process/worker crash recovery tests.
- Installed plan-named sql.js 1.14.2 (MIT), packaged for local-only initialization.
- Fixed WAL/snapshot rejection, statement cleanup, and complete-page byte accounting.

## Decisions made this session (move lasting ones into specs/PLAN.md)
- Owner authorized helper isolation and a one-second deterministic cancel target.
- Supported minimum is the lowest tested host, VS Code 1.140.0.
- Production Engine interface/banner/large-file prompt/hook remain T-009.

## Known issues / blockers
- Owner-authorized empty.json restoration is complete (zero bytes).
- Fresh-context follow-up review confirms fixes; no remaining concrete defect found.
- Fix commit: 9b80bbfe805a84edf65e72297daf20a65ea8d041.
- Push failed: no cached GitHub credentials. Owner sign-in/push is required.
- Earlier VS Code versions/browser support and production performance not claimed.
- No tests, compiler checks, or warning gates disabled; D-2 remains open.

## Next
Owner: git -c http.proxy= push origin main; paste the Actions run URL.
Then inspect fresh three-platform CI before ticking T-002.
