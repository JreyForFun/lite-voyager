# Progress

## Current phase / task
Milestone 0 and T-009/T-010/T-011/T-012 are complete. Milestone 1 continues.
T-013 is reopened/unchecked for the Windows/macOS CI failures at 92c12e9.
Owner reports nine SQL/Browse table QA passes on 2026-10-12.
Repaired three-platform CI is required; no milestone closure or release tag.

## Verify status
- Candidate `npm run verify:full` passes: 381 unit / 28 real-host tests.
- Run 38204288838 / attempt 1 / 92c12e9 fails Windows/macOS; Ubuntu passes.
- Windows x64 / VS Code 1.140.0 / bundled Node 24.21.0.
- Strict types/lint/builds pass; final standalone VSIX: 19 files / 606.91 KB.
- Candidate full run accepts one warning: VSCODE-HOST-001.
- Source: `20261012T125026/window1/renderer.log`, line 10, severity warning.
- Message: `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
- This full run is not warning-free; failure history is in VALIDATION.md.
- Candidate `npm run verify` passes: 381 tests; zero errors/warnings.

## Last session
- Verify public CI run/job/step metadata; retain supplied failure excerpts.
- Batch disposable fixture setup; red-first tests prove atomicity/all data.
- Add context/action-correlated DOM status and actual context restoration waits.
- Preserve every original deadline, data/delivery/source assertion and owner file.

## Decisions made this session
Owner authorizes scoped fixes/fixtures; owner pushes. No dependency added.
Browser test correlation is never persisted; no user-query behavior changes.
Keep original limits/fixtures/worker concurrency and warning policy unchanged.

## Known issues / blockers
Repaired three-platform CI and unreported manual QA details remain.
Independent milestone review, whole-milestone QA and schema panel remain.
Cold-disk/multi-GB/physical-paint targets and T-014/later features remain open.

## Next
Owner pushes the repaired T-013 commit with `git push origin main`.
Supply the new CI URL; use PROGRESS.md for a fresh T-013 follow-up chat.
Do not begin T-017 or tick T-013 until the repaired CI evidence passes.
