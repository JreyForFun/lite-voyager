# Progress
## Current task
T-030 CI repair only; owner retains push and CI dispatch. No later task starts.
Owner authorizes scoped fixes, fixtures, QA and task-only local commit.
## Implemented candidate
Import process fork now runs in a launcher worker; host awaits real PID readiness.
PID registration remains durable before jobs; ordered exact-value IPC is retained.
Cancel-before-PID and child-close plus launcher-exit confirmation are covered.
Unknown exit rejects; importer/editor retain storage for safe orphan cleanup.
Build/VSIX/dependency audit include launcher; no dependency or launch flag changed.
Autocomplete waits now require an active matching popup on an idle host.
Original actions, workloads, timers, deadlines and all diagnostic failures remain.
## Current evidence
CI 42437310018: owner reports macOS PASS; supplied Ubuntu/Windows logs FAIL.
Windows failure: 5-GB JSONL raw 322.8667 ms; sync fork 320.7046 ms, no GC overlap.
Ubuntu: 79 hosts PASS, then strict FAIL on nine native ProduceMemory errors.
RED/green cleanup, package and completion regressions retained in report/out.
Initial standalone 1,397-unit PASS is superseded by package/guard hardening.
First final full INCOMPLETE: Windows reboot at 12:38:30; 405 sources still match.
Recovery npm run verify:full PASS: 1,400 units/131 files, 79 hosts, 2955.65 s.
Types, lint, build, 36-entry VSIX, integration compilation and strict scans PASS.
Windows 5-GB JSONL raw max: 49.254000 ms; all 405 hashes match.
Full is NOT warning-free; every approved record is verbatim in investigation.
Earlier 403-file Ubuntu full: 78 hosts PASS/1 autocomplete FAIL; big-data cases PASS.
Final 405-file Ubuntu autocomplete: 4 hosts PASS; both probes fail startup GPU logs.
CreateCommandBuffer differs from CI ProduceMemory; no graphics cause/fix claim.
Offline cached runtimes/dependencies only; setup failures and raw logs retained.
Earlier visual QA retained with failed manual-host logs; no new physical Mac QA.
## Remaining acceptance / preservation
Fresh actual-candidate three-platform CI and Ubuntu strict acceptance remain open.
No threshold, workload, renderer setting, error policy or warning family relaxed.
Owner README/PLAN/TASKS/VALIDATION edits, unrelated files and six ZIPs preserved.
Evidence, all 18 changed files and commands: docs/t030-macos-ci-investigation.md.
T-030 stays unchecked. No push, CI dispatch, tag or release performed.
