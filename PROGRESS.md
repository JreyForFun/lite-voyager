# Progress
## Current status
2026-11-20: Spec Kit (specify 1.4.1.dev0) set up in .specify/ with a constitution mirror; no feature specs yet.
2026-11-20: verify passes (1,459 units/135 files) when run from an uppercase C:/ cwd; lowercase c:\ makes Vitest fail every suite.
2026-11-20: verify:full stopped by owner request after 57/57 host cases passed (incomplete; no result).
2026-11-20: verify:full failed 90/1 (json history-refresh: exercised Start raced frame reload).
Fixed: previewStatus readiness + test waits for painted preview; read-only source wording.
Final: verify 1,461 units pass, zero warnings; verify:full 1,461 units + 91/91 hosts pass,
one approved VSCODE-HOST-001 (not warning-free). One intermediate full failed on disk space
(pagefile growth); orphan 6.7 GB T-016 fixture removed. Details: docs/t032-t033-milestone3.md.
Visual QA: 10/10 light/dark native+fallback import refresh checkpoints (out/import-refresh-qa-*).
Next: owner pushes and runs three-platform CI; T-031 Ubuntu/macOS CI still uninvestigated.
Owner authorizes T-032/T-033 implementation and agent visual QA; owner pushes/CI.
Both features are implemented; final verify passes, verify:full is running.
T-031 remains open: owner reports Ubuntu/macOS CI failed; cause not investigated.
T-030 remains complete. No milestone/release/tag/publishing closure.
## Implemented acceptance
FR-013: exact last 50 successful explicit SQL runs per original source URI.
Atomic bounded metadata index, individually stored SQL, serialized split views.
Keyboard history load never executes SQL; isolated editor Undo; per-source clear.
Paging/export/metadata/failed/cancelled queries do not append history.
Escaped preview bytes stay bounded; malformed action types are refused.
FR-040: asynchronous metadata/WAL monitoring with periodic checks and disposal.
Refresh/Keep; dirty discard confirmation; queue/revision/actual host-busy guards.
All reader reopen results settle before discarding edits; failure retains queue.
Dirty refresh awaits provider completion; clean Revert explicitly reopens readers.
Refresh locks include Undo/Redo; own Save baseline uses the worker version token.
Imports return to preview and require Import again; original URI history survives.
Standalone CSV preview offers explicit reload. No automatic source writes.
## Evidence and limits
Acceptance, files, failures and QA limits: docs/t032-t033-milestone3.md.
Focused run: 136 tests/10 files before final QA repairs; 10 real-host cases pass.
Latest provider suite: 17 pass; history/import focused suite: 34 pass/3 files.
New action-guard regressions pass; original red/failing attempts are retained.
Native/fallback light/dark QA covers real Cancel/Discard and refreshed split views.
Sources stay byte-identical after discard; dirty/write mode clear only on success.
Visual hosts use installed 1.145.2 because 1.140 desktop targeting fails.
Installed visual-host strict log scans FAIL; exact vendor/helper records retained.
Those scoped observations do not substitute for the supported-host full gate.
332 final executable/test/config hashes captured in out/ for gate comparison.
Final verify: 1,459 units/135 files; types/lint/build/VSIX pass, zero diagnostics.
No dependency, exception, workload, deadline, clock or resource limit changed.
Owner edits/unrelated untracked files are preserved; no push or remote CI run.
## Remaining work
Finish npm run verify:full; record host counts, hashes and exact diagnostics.
Fresh independent review and owner-pushed Windows/macOS/Ubuntu CI remain pending.
Keep T-031/T-032/T-033 and milestone checkboxes open until all required evidence.
