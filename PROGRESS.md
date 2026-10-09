# Progress

## Current phase / task
Milestone 0B: T-050 dependency/license review is complete; owner pushes.
T-000, T-001, T-003, T-006, T-005, T-007, T-002, T-004, T-008, T-051 and T-050 are checked.
The foundation milestone remains open; no milestone tag.

## Verify status
- npm run verify passes: 179 unit tests, strict types/lint, builds and VSIX packaging; zero errors/warnings.
- Three red-first T-050 cases cover exact inventory/scope, license resolutions and production notices.
- Two npm audit --json runs return exit 0 and zero known vulnerabilities on 2026-10-09.
- No new verify:full or three-platform CI result is claimed for T-050.
- Prior T-008: seven integration tests pass, but strict logs fail on the intermittent cloud-dictation warning.
- Prior T-002 CI run 37922970386 passes three platforms at 0e3ec57 (2026-10-09).

## Last session
- Restored missing PLAN D-4 with owner-approved scope, acceptance criteria and delegated review decision.
- Documented all 576 locked package paths and 21 direct dependencies in specs/dependency-licenses.json.
- Captured the dated raw audit in specs/dependency-audit.json and review in specs/DEPENDENCIES.md.
- Resolved memorystream's missing declaration as MIT; checked all ten signing tarballs and identical Microsoft terms.
- Confirmed full MIT notices for fourteen embedded editor packages and copied sql.js; development tools are excluded.
- T-050 code/evidence/completion documentation belong to its local task commit; owner handles pushing.

## Decisions made this session
- Retain existing dependencies and overrides; no dependency, application-code or fixture fix was needed.
- Retain Microsoft signing tools for VS Code development only; select JSZip's MIT license option.
- Keep MPL development tooling outside the VSIX.
- Future XLSX work uses official SheetJS CE, preferably a verified vendor tarball; recheck before installing.
- Official guidance currently identifies CDN 0.20.3, Apache-2.0 and fixes for both listed CVEs; no XLSX dependency added.

## Known issues / blockers
- No T-050 acceptance criterion remains open; remote push/CI evidence is pending.
- R-1, D-2, the 24 existing FR/NFR naming gaps and the foundation/full-gate warning remain open.
- T-004 owner evidence: 1.26 GB, 145.4 s, 223.0 MB standalone peak RSS, 27.2 ms parsed preview; full row/hash checks pass.
- These do not prove the 5 GB extension-memory or visible-first-paint targets; disk space prevented the 5 GB run.

## Next
Owner pushes the T-050 commit and supplies CI evidence if available.
Start a fresh chat to assess the remaining foundation gate items before Milestone 1.
