# Progress

## Current phase / task
Milestone 2: T-026 CI failure investigation; diagnostic candidate, causes unresolved.
T-025 remains complete. Evidence/files: docs/t026-autocomplete.md and t026-ci-repair.md.

## Verify status
Run39815054580/attempt1/exact25c95c7: locked installs pass; Ubuntu full succeeds.
Windows passes 972 units/76 hosts, then strict logs reject main.log:9:
Extension host with pid 636 still exists, forcefully killing it...
Sole approved warning HOST-001, 20261022T163646/window1/renderer.log:15:
[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]
That failed full is not warning-free. Duplicate attachments/hash are retained.
Owner-supplied macOS log: 959 units/13 platform skips, 75 hosts pass/1 fails.
5-GB JSONL raw host timer gap 101.4173750000773 ms exceeds unchanged 100 ms.
All four FR-012 hosts pass on both platforms; no completed final JSONL hash claim.
Current diagnostics: 80 focused tests/five files and both tooling/host-test types pass.
Installed VS Code Node24.21.0 headless recorder probe passes, empty stderr.
First standard gate fails native tooling import; red-first syntax repair passes 80 focused.
Changed-candidate standalone pending; no new full gate attempted.

## Last session
External Windows CIM traces record creation identity around host exit without
target handles/signals. Bounded JSON CPU/callback/GC traces retain raw intervals.
Original CI commands remain; explicit CI flag starts one diagnostic child gate.
Nonzero status, warning/error rejection, awake lease and all workloads/bounds stay.
New tests fail first; Unicode/native-loader repairs pass independent follow-up.
Instrumentation can affect timing; these traces cannot establish historical cause.
Retained-dead-handle probe returns ESRCH; PID reuse/host blocking remain unproven.
No product/UI/dependency change; earlier scoped visual QA remains separately recorded.

## Decisions / limits
Exactly T-026; no retry-to-green, sample discard, relaxed guard or speculative fix.
All earlier failures and historical passing gates retained in linked records.
Owner README/shared-spec edits, unrelated fixtures/debug files remain untouched.

## Next
Owner pushes diagnostic candidate and runs fresh Windows/macOS/Ubuntu CI.
Return complete verify logs including shutdown identity/JSON interval evidence.
Use causal evidence to repair; keep T-026 unchecked until actual-candidate CI passes.
No new task, milestone closure, release or tag.
