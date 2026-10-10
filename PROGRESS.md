# Progress

## Current phase / task
Milestone 0 and T-009 are complete. T-010 is reopened for its CI lifecycle repair.
T-011 is not started; no milestone completion or release tag is claimed.

## Verify status
- Run 38029094981, attempt 1, SHA 7981bf2ce23e66695379606ec28f37d51f92a972: Windows/Ubuntu pass; macOS fails.
- macOS passes 300 unit/19 host tests but rejects `20261010T055556/main.log:8`, an error: Blocked vscode-webview request.
- Failed CI also accepts renderer.log line 15, VSCODE-HOST-001; exact original record remains in VALIDATION.
- Four lifecycle/protocol regressions fail before repair; normal host closure now asserts transport readiness and awaits helper exit.
- Initial candidate full gate stops on two fixture require-await lint errors; corrected without rule changes.
- Repaired local `npm run verify:full` passes: 304 unit/19 host tests, strict checks/builds, 17-file/480.52 KB VSIX.
- Windows x64 / VS Code 1.140.0 / bundled Node 24.21.0; development Node 26.5.0.
- Accepted local record: `20261010T140740/window1/renderer.log:10`, warning, VSCODE-HOST-001.
- Exact message: `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
- No unexpected local diagnostic; full verification is not warning-free.
- Final standalone `npm run verify` passes: 304 tests, strict checks/builds/package; zero errors/warnings.

## Last session
- Read owner-supplied macOS failure; public API confirms the run SHA and three job conclusions.
- Strengthen normal host-test closure with a typed no-op transport probe; fail on missing panels or failed delivery.
- Existing assertions, timeouts, scripts-disabled UI, early cancellation tests and diagnostic policy remain intact.
- Owner observable QA still passes: default/picker, invalid/empty, themes/reopen, fallback notice, threshold and Escape/Cancel/Proceed.
- Early opening cancellation/closure remains manually unobserved; automated cleanup/late-reply coverage is retained.
- Preserve owner's untracked fixture copies and debug.log; no dependency or committed fixture changes.

## Decisions made this session
Owner authorizes necessary repairs/best judgment and handles pushing. Stay on T-010 only.

## Known issues / blockers
- Closing before outer-frame initialization is the leading CI hypothesis; macOS reproduction/repair confirmation requires fresh CI.
- Native desktop control is unavailable here; CLI and real Windows host checks are available.
- Browsing, first-row/multi-GB targets and whole-milestone QA remain later tasks; prior CSV benchmark limitations remain.

## Next
Owner pushes the repair candidate with `git push origin main`.
Supply the new Actions URL/SHA/job conclusions; leave T-010 unchecked until all three full jobs pass.
