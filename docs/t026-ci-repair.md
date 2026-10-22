# T-026: clean-checkout fixture repair (2026-10-22)

[Run 39771461612](https://github.com/JreyForFun/lite-voyager/actions/runs/39771461612),
attempt 1, exact `63dadc9dacd9c32b5ffb1a9ac10f7f83a572cc3b`, fails on Ubuntu,
Windows and macOS. GitHub REST run/job metadata independently confirms each failed
job/applicable verification step and successful locked install. The owner supplies
the three verification-step logs. They are retained byte-for-byte with SHA-256
in out/t026-ci-39771461612-evidence.json and the three platform .log files.

All platforms fail the same four FR-012 worker tests with ENOENT from mkdtemp:
out/t026-unicode-* and out/t026-unit-*. Windows reports 963 pass/4 fail;
Ubuntu and macOS each report 950 pass/4 fail/13 platform skips (967 total).
Types and lint pass. Build/packaging/host integration are not reached. Remote
host coverage and remote warning-free status are not claimed.

## Cause and acceptance

The real-worker suite builds dist in beforeAll, then attempts mkdtemp inside out
without creating that parent. out is ignored and absent on a fresh checkout.
This local workspace already contained it, hiding the fixture's dependence on
prior artifacts/suite order. No generator, application engine or platform-specific
autocomplete defect is indicated by these logs.

Retain every original test/assertion/schema/SQL/source-hash check and existing
30000-ms build setup/15000-ms worker-case budgets. Test the actual four-case suite
from an owned fresh project root with no out directory. Do not change the CI
workflow or global runner to pre-create a directory for this fixture.

## Red-first repair

- New sql-completion-clean-checkout.test.ts copies the actual source/webview/build
  inputs and original four-case worker suite to an owned OS temporary root, links
  existing dependencies and asserts out is absent. The first run fails all four
  child cases with the exact CI ENOENT paths; the parent regression fails too.
- Both fixture prefixes now use mkdtemp under the OS temp directory, matching
  established engine tests. Cleanup verifies the owned parent before recursive
  deletion. No application, engine, worker, workflow, dependency or limit changes.
- The regression removes the dependency link before guarded temporary-root
  cleanup. Its bounded wrapper covers the existing 30-second setup plus four
  15-second budgets; none of those existing budgets is increased.
- The same clean-root run then passes all four actual native/fallback worker
  cases, including accepted Unicode/quoted SQL, 125 tables/1003 columns, distant
  prefix matches, broken-view recovery, export preservation and source hashes.
- Focused tests PASS: 20 cases/three files, including the new parent regression;
  all four repeated child cases pass. Duration 12.75 seconds. Independent
  read-only review finds no concrete defect or assertion/cleanup weakening.

Canonical current-candidate local gates and owner-pushed fresh three-platform CI
remain pending. The failed CI is retained; T-026 stays unchecked. Earlier local
passes, failures, exact approved diagnostics and delegated renderer QA remain in
[t026-autocomplete.md](t026-autocomplete.md). This repair changes no UI, so no new
visual behavior is claimed or needs rechecking.

Changed files for this repair: test/unit/sql-completion-engine.test.ts,
test/unit/sql-completion-clean-checkout.test.ts, this file, docs/t026-autocomplete.md,
PROGRESS.md, specs/PLAN.md, specs/TASKS.md and specs/VALIDATION.md. Preserve unrelated
owner edits. The owner retains pushing and remote CI.

```
npm test -- test/unit/sql-completion-clean-checkout.test.ts test/unit/sql-completion-engine.test.ts test/unit/sql-completion.test.ts
npm run verify
npm run verify:full
```
