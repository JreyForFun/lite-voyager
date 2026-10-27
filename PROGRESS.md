# Progress

## Current phase / task
T-030 local implementation and QA complete (2026-10-27); owner CI pending.
Owner authorized implementation, scoped fixes/fixtures and QA; retains push/CI.
Only T-030 is active. Details/files/evidence: docs/t030-staged-edits.md.

## Accepted implementation / checks
FR-016/FR-020: read-only default, write mode, typed cells and queued DML.
PK/composite/rowid identity, dirty tabs, staged Undo/Redo/Revert, atomic saves.
Exact int64/NULL/text, conflict checks, backups, cancellation and journal recovery.
Native Save As uses a fresh snapshot worker; fallback uses atomic replacement.
Final independent recovery/lifecycle review is clear;115 focused cases pass.
Standalone npm run verify passes1134 units/112 files, zero errors/warnings.
Full npm run verify:full passes1134 units plus79 integration tests in2828.843s.
Both gates preserve366 hashes, identical between gates; only records change later.
Full uses minimum VSCode1.140.0/Node24.21.0; both T-030 engine workflows pass.
Full is NOT warning-free: VSCODE-HOST-001, warning, renderer.log:10,
source20261027T230326/window1 under out/integration-profile-mIT6rq/logs/.
Exact message: [CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]
Strict log scan passes; all other warnings/errors still fail. No policy changes.
Logs/status/hashes: out/t030-verify-6*, out/t030-full-2*, final-gate-links.json.

## QA / remaining work
Live light/dark staging/dirty/Save QA passes on installed VSCode1.143.1.
Earlier window-binding failures and unapproved ad-hoc QA diagnostics are retained.
Full1 deliberately stopped for the failing spill regression; never a full PASS.
Final full2 passes original large-file/hash/paging/memory/responsiveness checks.
Fallback external-writer race and unknown interrupted-save outcome stay explicit.
Owner authorized task-only commit (2026-10-28); owner pushes and runs existing CI.
Keep T-030 unchecked until actual-candidate Windows/macOS/Ubuntu CI passes.
No later task or milestone-release closure. Preserve every failed run.

## Preserved work / checkpoint
Preserve owner README/shared-spec/TASKS hunks, debug.log, gingTryWan and fixtures.
T-028 local v0.2.0 remains accepted; manifest stays0.0.1; parent checkpointf12a2ed.
Only T-030 is committed. No push, tag, release, dependency or CI-policy change.
