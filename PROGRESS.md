# Progress
## Current phase / task
T-030 macOS host timer investigation; no product/threshold change.
Owner authorizes scoped fixes/QA/review/local commit; retains push/CI dispatch.
## Latest actual-candidate CI (owner supplied full log)
Run42360697008/attempt1/exact270639c: Ubuntu/Windows PASS; macOS FAIL.
Mac1324units/17existing skips;78hosts PASS/1FAIL: FR-014 native JSON export.
50000rows/55ticks/1337.323ms; raw286.739084ms > unchanged100ms cap.
out/integration/test/result-export.test.js:112:28; later native checks unreached.
All four populated JSON/JSONL imports PASS: maxima22.496/30.083/30.908/29.451ms.
SQLite/CSV large-file data/memory/hash workloads PASS; no root cause established.
Saved errors are test summaries; approved HOST-001 warning, NOT warning-free:
20261107T094409/window1/renderer.log:15; exact family in investigation report.
## Supplemental native macOS diagnostic failed at preflight
Manual macos-system-trace.yml: original verify prelude and entire host suite once.
Native System Trace preflight before workload; rolling120s, recording45m bound.
Immediate first raw >100ms export/import marker stops trace; suite continues.
Raw trace/TOC/selected tables/console/status retained; original failures survive.
Mac-only opt-in callbacks/CPU/GC; no changed Windows/Linux sampling or settings.
42focused/3files PASS; tooling/integration types/scoped lint PASS.
Verify1359/128/types/lint/build/VSIX PASS; zero diagnostics;399 frozen hashes.
674.052s; independent follow-up clear; evidence out/t030-system-trace-verify-1.*.
Run42365183964/attempt1/exact12f7bea: prelude/compile PASS; preflight FAIL.
31s trace step matches collector30000ms SIGKILL deadline; host suite never starts.
Native stall cause unknown; no deadline/permission/product change or retry.
Artifact13571442081/1726bytes uploads; download401; public metadata retained.
Need preflight.stdout.log + preflight.stderr.log text; no new ZIP request.
## Retained evidence / limits
Focused42360961523/exact270639c: all original JSON/JSONL volumes PASS,219919ms.
Maxima16.680/20.567/18.364/48.722ms; complete data/source hashes/memory PASS.
Strict focused saved-log scan: no warnings/errors; not full-suite acceptance.
Prior42069600294 JSON136.357291ms failure retained; cause unproved.
Prior Windows77pass/2fail:3000ms observer/112.7969ms JSON timer, causes unknown.
Nativecaps42360767270 PASS; installed manual supports used trace options.
Details/archive hashes: docs/t030-macos-ci-investigation.md.
## Preserved work / status
Preserve owner README/PLAN/TASKS/VALIDATION hunks, ZIPs and other files.
Normal CI/launch config/product/assertions/workloads/deadlines unchanged.
No relaxed limits, diagnostic exceptions or automatic retries; T-030 unchecked.
