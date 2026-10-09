# Progress

## Current phase / task
Phase: Milestone 0B. Task: T-007 D-Bus change implemented; CI rerun needed.
T-000, T-001, T-003, T-006, T-005 checked; 0A human checklist complete.

## Verify status
- npm run verify and verify:full pass locally on Windows, Node 26.5.0.
- 66 unit tests, two integration tests, and runtime-log checks pass.
- Strict checks, lint, bundles, and temporary VSIX check pass (6.56 KB).
- Initial T-006 compiler-test timeouts passed on unchanged retries.
- Original Ubuntu run passed 65 unit/two integration tests, then D-Bus failed.
- YAML parsing passes; the new Linux wrapper has not run here.
- Fresh three-platform CI conclusions, run URL, and tested SHA are needed.

## Last session
- Added a failing D-Bus regression test before changing Linux CI.
- Linux now uses dbus-run-session with xvfb and the complete full gate.
- Accepted the owner's dated competitor review and checked T-001.
- Preserved positioning changes; restored approved FR-020 and changelog.
- Updated affected specs/status; T-007 remains unchecked.

## Decisions made this session (move lasting ones into specs/PLAN.md)
- Provide a real session bus; keep all diagnostic rejection intact.
- T-001 rests on human reports, not independent account/count verification.
- No new project dependencies; decisions are recorded in PLAN.md.

## Known issues / blockers
- T-007 needs fresh green CI evidence for all three platforms.
- Existing T-006 compiler tests have intermittent local timing failures.
- M0 Engine-interface gate versus T-009 still needs clarification.
- D-2 positioning remains open until the risk spikes inform the decision.
- T-002, T-004, T-008, T-051, and T-050 remain unstarted.

## Next
Push the local change and paste the new CI run URL, SHA, and job conclusions.
For a failure, paste its complete failing-step log. No push performed here.
No milestone gate/tag claimed; start a fresh T-002 chat after T-007 passes.
