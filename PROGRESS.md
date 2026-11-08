# Progress
## Current status
T-031 local implementation, visual QA and gates pass; not closed (2026-11-08).
Scope: FR-021 SQLite row add/delete only; owner retains push and CI.
T-030 remains complete; no milestone/release/tag/publishing closure.
Final standalone passes 1,427 units/131 files and packaging; zero errors/warnings.
Final full passes 1,427 units and 81 hosts; independent review/CI remain pending.
## Validated behavior
Typed/default-aware inserts and confirmed deletion of exact original row keys.
Both-engine staging/source safety, dirty state, Undo/Redo/Revert and recovery.
Atomic mixed-queue Save/Save As, constraints/foreign keys and external conflicts.
Exact int64, NULL/empty/literal NULL, NUL/Unicode, >1-MB cells and 1,000 columns.
Child-before-parent deletion ordering; BLOB-key previews contain placeholders.
Untrusted insert properties cannot replace the worker-created operation kind.
Supported 1.140.0 native/fallback light/dark visual QA passes (ten saved captures).
Native narrow split shares pending changes; requesting view owns its add form.
Explicit visual Save changes only disposable fixtures; independent reads agree.
Busy metadata/Save backup snapshots and empty restore pass regression tests.
Final visual strict scan passes with exact approved HOST-004 and HOST-001.
## Evidence and retained limits
Acceptance, file list and transcripts: docs/t031-row-operations.md.
Final standalone transcript: out/t031-verify-3.log (exit 0).
Full transcript: out/t031-full-2.log (exit 0; sole exact approved HOST-001).
First gate (1,422 units) is superseded by boundary hardening and new tests.
All red tests, first failed host synchronization run and tool failures remain.
Archived-host UI binding failed; installed-host UI binding enabled visual QA.
Installed visual hosts have vendor proposal notices; no strict-log pass claimed.
First supported visual scan found the backup defect; repaired test-first.
No diagnostic allowance, workload, deadline, memory or responsiveness limit changed.
Retain T-030 fallback rename race and unknown interrupted-save outcome limits.
Owner README/PLAN/TASKS/VALIDATION hunks, unrelated files and six ZIPs preserved.
## Remaining work
Task-only diff and exact warning metadata: docs/t031-row-operations.md.
Independent review uses a fresh chat and out/t031-review.patch.
Owner pushes and supplies exact-candidate Windows/macOS/Ubuntu CI.
Keep T-031 unchecked until its required acceptance evidence passes.
