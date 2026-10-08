# Progress

## Current phase / task
Phase: Milestone 0B. Task: T-005 complete; next task is T-007.
T-000, T-003, T-006, T-005 checked. T-001 remains open.

## Verify status
- npm run verify: passed strict checks, lint, 60 unit tests, bundles, VSIX check.
- Final packaging check: 5.69 KB VSIX; fixtures/generated datasets excluded.
- verify:full last passed for T-006; not rerun for fixture-only T-005.
- 10-million-row CSV/SQLite generation passed locally in 163,629 ms.
- CSV: 1,258,888,906 bytes; SQLite: 1,246,060,544 bytes.
- Independent Python checked every CSV record and read-only SQLite counts/IDs.
- CI and other operating systems: not tested yet.

## Last session
- Finished approved T-005 after red-first tests; added 30 acceptance tests.
- Added 27 small fixtures, hashes, stress/large generators, and runtime recipes.
- Confirmed XLSX exact text IDs and cached formula 6.25 with independent readers.
- Corrected approved FR-020 and matching WITHOUT ROWID QA wording.
- Updated affected specs/changelogs; specs/PROGRESS.md now points to root status.
- Marked T-005 complete; large local datasets remain git-ignored.

## Decisions made this session (move lasting ones into specs/PLAN.md)
- Development/test Node minimum is 25.7; locally tested Node 26.5.0.
- Generators refuse existing destinations; SQLite work runs in a worker.
- No new project dependencies; fixture bytes are preserved by .gitattributes.

## Known issues / blockers
- T-001 competitor counts/features are not re-verified.
- M0 Engine-interface gate conflicts with T-009; T-007 CI matrix needs clarification.
- T-007, T-002, T-004, T-008, T-051, T-050 remain unstarted.
- .vscode/settings.json remains uncommitted and unchanged.

## Next
Start a fresh chat for T-007: CI and its platform matrix.
Restate its acceptance criteria/files and obtain approval before coding.
No milestone gate or tag claimed; no push performed.
