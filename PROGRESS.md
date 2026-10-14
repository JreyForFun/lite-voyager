# Progress

## Current phase / task
Milestone 2, T-020 review repairs and post-push CI investigation.
Owner keeps T-020 repairs in this chat; next chat will be T-021.

## Verify status
Owner visual checks 1-5 PASS; final standalone 587 tests, zero errors/warnings.
CI 38539935087/attempt 1: Windows/macOS pass; Ubuntu fails on GPU errors.
Final Windows full: 587 unit/53 files and 52 host cases pass; one HOST-001.
Genuine sparse 3 GB CSV: first DOM 237.054 ms; 65,536 bytes read; 100 rows.

## Last session
Independent fresh-context review authorized and performed in this chat.
Fixed unscanned UTF-8 rejection with physical-line/budget-bounded decoding.
Fixed FIFO blocking with preflight/nonblocking POSIX open/snapshot comparison.
Fixed failed commands awaiting notification dismissal; all fixes are red-first.
Independent follow-up clears all code/fixture findings; no concrete defect remains.
Red-first sparse-fixture fix: unit/host stay 3 GB; focused 37 cases pass.

## Decisions made this session
Separate preview command; normal CSV opening stays text; no import/SQL yet.
Explicit preview limits stop without truncation; all values stay text.
No new dependency, lockfile, static-fixture or diagnostic-policy change.
Four exact host families only; every other warning/error still fails.

## Known issues / blockers
Ubuntu emitted 30 Chromium mailbox errors during preceding T-012.
GPU cause not reproduced; no graphics repair claimed or rejected flag applied.
All failed WSL probes retained; later passes do not erase intermittent timeouts.
Linux 587 units pass; both full host attempts interrupted; no Linux full pass.
Owner recovered 10.062 GB; resumed run exhausted host space again (69.9 MB).

## Next
Reviewed T-020 repairs verified and prepared for owner push.
Reviewed second compaction ready; no further large local Linux run.
Record hosted CI after owner push; preserve unknown WAL/graphics causes.
Keep T-020 unchecked until remaining gates pass; then hand off T-021.
WSL copy: /home/pengging/lite-voyager-t020-ci.hFKC34; helpers out/t020-linux.
