# Progress

## Current phase / task
Phase: Milestone 0B. Task: T-002 implemented; manual QA passes, fresh CI pending.
T-000, T-001, T-003, T-006, T-005, T-007 remain checked. T-002 stays unchecked.

## Verify status
- npm run verify and verify:full pass: 93 unit tests, four integration tests/logs.
- Package includes helper, worker, local sql.js loader/WASM/license: 346.38 KB.
- Real VS Code 1.140.0 and 1.141.0 integration runs pass all four tests/log checks.
- Windows x64: bundled Node 24.21.0; native SQLite 3.53.4; fallback SQLite 3.49.1.
- Helper cancellation observed at 25-47 ms; exit/reopen/source hashes verified.
- Owner QA: native 24 ms / fallback 92 ms; both recover and typing stays responsive.
- One full run failed startup timing warnings; unchanged integration/full retries pass.
- Previous green CI: run 37884550873, commit 93b23bf1420cf10dd8b0ea82d3b4c2be0e35268d.
- That old run does not validate T-002. Fresh Windows/macOS/Linux CI is required.

## Last session
- Added typed helper/worker lifecycle and real native/sql.js query tests.
- Worker-only native cancellation took 11,042 ms; replaced by killable helper.
- Added cancel-during-open, concurrent close, process/worker crash recovery tests.
- Installed plan-named sql.js 1.14.2 (MIT), packaged for local-only initialization.
- Shared compiler-fixture setup; kept full options/libraries/diagnostic assertions.
- Added exact-version override and manual commands/instructions to README.md.

## Decisions made this session (move lasting ones into specs/PLAN.md)
- Owner authorized helper isolation and a one-second deterministic cancel target.
- Supported minimum is the lowest tested host, VS Code 1.140.0.
- Production Engine interface/banner/large-file prompt/hook remain T-009.

## Known issues / blockers
- Local owner edit to test/fixtures/empty.json left untouched and uncommitted.
- Fresh three-platform CI and independent risky-change review remain outstanding.
- Earlier VS Code versions/browser support and production performance not claimed.
- No tests, compiler checks, or warning gates disabled; D-2 remains open.

## Next
Implementation committed as a587400b29af6dbf3d54ea3b1e9a37deb88e539d; T-002 stays open.
Owner pushes the commit and supplies fresh CI run/SHA/job evidence.
