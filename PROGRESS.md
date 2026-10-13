# Progress

## Current phase / task
Milestone 1; T-016 scoped safety/memory acceptance and repair CI are complete.
Only T-016 closes; schema, whole-milestone QA/review and release remain separate.

## Verify status
- CI 38384170955 /attempt 1 at 284fbee succeeds on all three platforms.
- Public API confirms locked installs and applicable full-verification steps.
- Remote raw test/memory/warning counts are not claimed.
- Repaired integration: 45 tests pass; strict log gate accepts one known warning.
- jdqstT/logs/20261013T181428/window1/renderer.log:10, VSCODE-HOST-001.
- Repair verify: 489 tests /45 files, zero errors/warnings; builds/package pass.
- Closure verify: 489 tests /45 files, 202.04 s, zero errors/warnings.
- Prior local host gate is not warning-free; exact diagnostic is in VALIDATION.

## Last session
Failed caf209b Windows/macOS CI and local full-startup failure remain recorded.
Red-first reader/hash repairs pass; the repaired candidate now passes full CI.
Repaired Windows peaks 270,688,256 /276,115,456; size growth 5,427,200 bytes.
All pages/scans/hashes pass; max gap 584.9556 ms; large workload 192.188 s.

## Decisions made this session
Reuse one fixed 1 MiB hash buffer to avoid cumulative chunk allocations.
Persistent Windows CIM reader; initial bootstrap bounded before opening.
Retain 3 s measured gaps, 500 MB cap, 50 MB growth and 540/600 s budgets.
Retain full hashes, 10 million rows, 60 Browse/20 SQL pages and payload scans.
Owner-approved native SHM coordination stays; database/WAL bytes stay exact.
No dependencies or production changes; all observer tooling stays out of VSIX.

## Known issues / blockers
Green macOS confirms repaired acceptance, not sole cause of the old failure.
Failed full Vitest-startup attempt is retained; separate final local gates pass.
CSV memory, physical/cold first paint, schema and milestone QA/review remain.
Pre-existing edits/unrelated untracked files are preserved outside this repair.

## Next
Owner pushes completion records; use a fresh chat for remaining Milestone 1 work.
