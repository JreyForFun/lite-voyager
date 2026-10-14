# Progress

## Current phase / task
Milestone 2, T-020 review repairs and post-push CI investigation.
Owner keeps T-020 repairs in this chat; next chat will be T-021.

## Verify status
Owner visual checks 1-5 PASS; final standalone 601 tests, zero errors/warnings.
CI 38585494750/5dd4770: Windows/Ubuntu full PASS; macOS log gate FAIL.
Prior runtime Windows full: 587 unit/53 files and 52 host pass; one HOST-001.
Genuine sparse 3 GB CSV: first DOM 237.054 ms; 65,536 bytes read; 100 rows.

## Last session
Canonical-path fixture repair now passes all 588 units on macOS CI.
All 52 macOS host cases PASS; sparse first DOM 81.455 ms, 65,536 bytes/100 rows.
Owner delegates exact HOST-005 decision; adopt only remoteStatusIndicator family.
Official VS Code source identifies unconditional BlockStartup contribution.
Earlier reader/controller/genuine sparse-fixture repairs remain independently clear.

## Decisions made this session
Separate preview command; normal CSV opening stays text; no import/SQL yet.
Explicit preview limits stop without truncation; all values stay text.
No new dependency, lockfile or static fixture; policy now has five exact families.
Unsigned timing only; structured renderer warnings reported; all other diagnostics fail.

## Known issues / blockers
Original Ubuntu mailbox failure retained; new Ubuntu full succeeds.
No graphics repair or remote warning-free run is claimed.
All failed WSL probes retained; later passes do not erase intermittent timeouts.
Local WSL full interrupted twice; no further large local Linux run.
HOST-005 tests red first (2 failures), then 48 log-policy cases PASS.

## Next
Standalone 601-test verify PASS; independent implementation review clear.
Owner second compaction PASS; C: free 10.464 GB; no large local Linux run.
Owner pushes reviewed policy repair; inspect fresh three-platform CI here.
Keep T-020 unchecked until remaining gates pass; then hand off T-021.
WSL copy: /home/pengging/lite-voyager-t020-ci.hFKC34; helpers out/t020-linux.
