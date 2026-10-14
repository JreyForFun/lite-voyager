# Progress

## Current phase / task
Milestone 2, T-020 review repairs and post-push CI investigation.
Owner keeps T-020 repairs in this chat; next chat will be T-021.

## Verify status
Owner visual checks 1-5 PASS; final standalone 588 tests, zero errors/warnings.
CI 38572461954/ceb05b2: Ubuntu full PASS; Windows install/macOS unit FAIL.
Prior runtime Windows full: 587 unit/53 files and 52 host pass; one HOST-001.
Genuine sparse 3 GB CSV: first DOM 237.054 ms; 65,536 bytes read; 100 rows.

## Last session
Canonical-path alias regression reproduces macOS race-injector failure locally.
Fix only injector path; prove replacement; preserve error/deadline/cleanup checks.
All 37 reader cases and 3 targeted real POSIX FIFO cases PASS.
Independent follow-up clears repair; complete 588-test verify PASS.
Earlier reader/controller/genuine sparse-fixture repairs remain independently clear.

## Decisions made this session
Separate preview command; normal CSV opening stays text; no import/SQL yet.
Explicit preview limits stop without truncation; all values stay text.
No new dependency, lockfile, static-fixture or diagnostic-policy change.
Four exact host families only; every other warning/error still fails.

## Known issues / blockers
Original Ubuntu mailbox failure retained; new Ubuntu full succeeds.
No graphics repair or remote warning-free run is claimed.
All failed WSL probes retained; later passes do not erase intermittent timeouts.
Local WSL full interrupted twice; no further large local Linux run.
Windows npm ci ECONNRESET; macOS corrected injector awaits fresh CI.

## Next
Reviewed T-020 alias-test repair/evidence verified; prepare owner push.
Owner second compaction PASS; C: free 10.464 GB; no large local Linux run.
Owner pushes; inspect fresh actual-candidate three-platform CI here.
Keep T-020 unchecked until remaining gates pass; then hand off T-021.
WSL copy: /home/pengging/lite-voyager-t020-ci.hFKC34; helpers out/t020-linux.
