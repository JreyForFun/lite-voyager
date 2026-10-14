# Progress

## Current phase / task
Milestone 2, T-020 implementation locally verified.
Only T-020; checkbox remains open for owner preview/fresh review.

## Verify status
Full passes 572 unit tests/52 files and 52 real VS Code host cases.
Full is not warning-free: one HOST-001; exact record in VALIDATION.
Sparse 3 GB CSV: first-row DOM 212.230 ms; 65,536 bytes read; 100 cached rows.
Both engines' existing SQLite/source/memory gates and original budgets pass.
Final standalone verify passes 572 tests/52 files; zero errors/warnings.
Local VSIX: out/t020-preview/lite-voyager-t020.vsix; install/visual QA pending.

## Last session
Implemented format-neutral FileLoader types and worker-backed CSV/TSV preview.
Exact text, bounded complete rows, virtualized grid and cell inspection pass.
Cancel, independent views, snapshot faults and worker recovery pass.
Red-first CSP/transport repairs pass; failed runs stay recorded.

## Decisions made this session
Separate preview command; normal CSV opening stays text; no import/SQL yet.
Explicit preview limits stop without truncation; all values stay text.
Approved Papa Parse/MIT notice; no dependency/lockfile/static-fixture change.
Four exact host families only; every other warning/error still fails.
Preview stays 0.0.1; no publishing/tag or later Milestone 2 work.

## Known issues / blockers
Owner physical preview and fresh independent review are pending.
New-code three-platform CI, cold paint and full import targets are unclaimed.
Desktop API unavailable; owner supplies visible observations.
Pre-existing owner edits/unrelated files stay outside the T-020 commit.

## Next
Owner: install local VSIX; run docs/t020-preview.md checks 1-5 and fresh review.
Owner pushes implementation and supplies current-code CI when available.
Then finalize T-020 checkbox; plan T-022 in a fresh chat before T-021 import.
