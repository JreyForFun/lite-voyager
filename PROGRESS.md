# Progress

## Current phase / task
Phase: Milestone 0B. Task: T-006 complete; next task is T-005.
T-000, T-003, and T-006 checked. T-001 remains open.

## Verify status
- npm run verify: passed strict checks, lint, 30 unit tests, bundles, VSIX check.
- npm run verify:full: passed the same checks plus both integration tests and logs.
- Integration host: VS Code 1.140.0; Node 26.5.0 runs development tooling.
- Both bundles package into a temporary 5.18 KB VSIX, removed after checking.
- Gate tests cover exit failures, warnings/errors, protocol drift, and structured logs.
- CI and other operating systems: not tested yet.

## Last session
- Finished approved T-006; wrote an isolation regression test and observed it fail first.
- Added fresh empty installed/built-in extension directories to the test host.
- Lite Voyager activates and Hello World runs in the real VS Code host.
- Full verification now passes; marked T-006 complete in specs/TASKS.md.
- Updated PLAN.md with isolation behavior and its coverage limit.
- Retained user-provided Marketplace publisher ID jreyinnovarev.

## Decisions made this session (move lasting ones into specs/PLAN.md)
- Isolate unrelated Git/Copilot built-ins using VS Code's extension-directory flags.
- No vendor files modified and no tests, output, or runtime diagnostics filtered.
- Built-in coexistence is outside the isolated integration test's coverage.

## Known issues / blockers
- T-001 competitor counts/features are not re-verified.
- M0 Engine-interface gate conflicts with T-009; T-007 CI matrix needs clarification.
- T-005, T-007, T-002, T-004, T-008, T-051, T-050 remain unstarted.
- .vscode/settings.json remains uncommitted and unchanged.

## Next
Start a fresh chat for T-005: test fixtures and large-file generators.
Restate its acceptance criteria/files and obtain approval before coding.
No milestone gate or tag claimed; no push performed.
