# Progress

## Current phase / task
Milestone 1; T-016 reopened after failed candidate CI, run 38378099885.
Exactly this task; no schema, next milestone or release work.

## Verify status
- caf209b: CI Ubuntu passes, Windows/macOS fail; API and owner logs confirmed.
- Old local 487-unit/45-host pass is retained, not three-platform completion.
- Repair regressions fail first (2 failing/5 passing), then 7 pass locally.
- Repaired integration: 45 tests pass; strict log gate accepts one known warning.
- jdqstT/logs/20261013T181428/window1/renderer.log:10, VSCODE-HOST-001.
- Final verify: 489 tests /45 files, zero errors/warnings; builds/package pass.

## Last session
Windows observer fails in two memory tests; cold command has a 3 s timeout.
Logs omit the command's exact cause; repaired observer reports timeout phases.
macOS completes source-safe workloads but size-growth is 84,197,376 bytes.
Peaks 270,581,760 /354,779,136; paging growth 0; strict 50 MB growth fails.
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
macOS diagnosis is a harness-allocation hypothesis until fresh CI confirms it.
Failed full Vitest-startup attempt is retained; separate final local gates pass.
CSV memory, physical/cold first paint, schema and milestone QA/review remain.
Pre-existing edits/unrelated untracked files are preserved outside this repair.

## Next
Owner pushes the repair and supplies fresh CI URL; confirm all three platforms.
Use a fresh chat for remaining Milestone 1 work after this repair is validated.
