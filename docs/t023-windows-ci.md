# T-023 Windows CI repair

Status (2026-10-17): T-023 acceptance is complete following independently
confirmed repaired-candidate three-platform full CI. The failures and limits
below remain historical evidence; their precise slow-stage causes are not
retroactively explained by the passing run.

Run [38857662893](https://github.com/JreyForFun/lite-voyager/actions/runs/38857662893),
attempt 1, tests exact `dfab68e5669f0d03db93761f0bff12e23a9eb32b`.
Public API metadata confirms Windows job 116832647357 fails; Ubuntu job
116832647436 and macOS job 116832647468 succeed. There are no runtime artifacts.
The owner's pasted Windows full-step log shows all 777 units pass, then 64 host
tests pass and one fails: the 5-GB CSV preview's first-row DOM report takes
2005.2729 ms, exceeding the unchanged strict 2000-ms bound. All five JSON host
cases, both ten-million-row formats and all four 1/5-GB JSON workloads pass.
Remote raw diagnostic records and other-platform raw counts are not retrieved;
no warning-free remote claim. Preserve this failure and both earlier local ones.

The log has no stage breakdown, so the precise cause of the 2005-ms observation
is unproven. A concrete avoidable cost exists in the measured path: delimiter
detection opens, validates, parses and closes the same bounded sample up to four
times, even when the raw sample contains no alternative delimiter. Repair that
cost and add stage timings; do not label the CI failure transient or resolved
without repaired-candidate evidence.

## Repair acceptance, before code

- Inspect original complete raw records during the existing preferred-delimiter
  preview. If no alternative delimiter occurs anywhere in that raw sample and
  the sample reaches EOF or the complete 100-row boundary, the preferred result
  already wins or ties every candidate. Reuse it with one source open. Keep all
  bytes, records, values, source identity checks and the existing notice.
- Inspect raw headers too, before blank/duplicate header normalization. A tab in
  a whitespace-only header must still trigger normal candidate detection.
  Quoted alternative delimiters conservatively keep the normal path. A partial
  oversized record or payload-limited sample must keep all candidate scans.
  Explicit delimiters and malformed-input handling retain their behavior.
- Add command-relative transport, worker and webview-ready timings to the shared
  import session's test observability. The original command-to-host-received
  first-row timer remains unchanged. Stress logs show stages before asserting
  the original 2000-ms bound, so a failure does not discard its diagnostic data.
- Write deterministic failing regressions before code: count actual source
  opens for the complete one-column sample and verify the timing boundaries.
  Cover raw-header alternatives, quoted/multiline values, preferred formats,
  partial boundaries, invalid UTF-8 and explicit delimiters.
- No dependencies, fixture/workload changes, deadline changes, warning allowance,
  moved timing start, clock subtraction, sampler changes or unchanged retries.
  Run focused units, independent review and the canonical verification gates.
  Owner retains push and repaired actual-candidate three-platform CI.

## Evidence

Seven new assertions fail against the original code: six complete-sample cases
observe four source opens instead of one; one diagnostic case lacks phase
timings. Preserve `out/t023-ci-red.log` (7 failed /18 passed). After the repair,
all 64 focused units in four files pass (`out/t023-ci-focused.log`), including
existing reader/UTF-8/source-snapshot checks. All preview limits and the original
first-row timing assertion remain unchanged. Repaired standalone verification
passes all 790 units /78 files (306.03-second unit phase), strict type checks,
lint, production builds and a 31-file /694.12-KB VSIX, with zero errors and zero
warnings. Preserve `out/t023-ci-verify.log`. Full verification in
`out/t023-ci-full.log` fails at the unchanged 20,000-ms build hook in
`test/unit/csv-import.test.ts:13`: 754 units pass and Vitest does not run that
suite's 36 tests after hook failure (457.75-second unit phase). No test is
disabled or weakened. The full gate has no host phase and remains failed.

Windows System /Kernel-Power events confirm idle Modern Standby from 11:56:46
to 11:59:52 on 2026-10-17, overlapping this unit phase (start 11:55:54). They
also confirm 11:40:43 to 11:47:17 during earlier static checks. These explain the
observed interrupted waits; exact hook scheduling is not logged, so the event
overlap is not proof of that hook's precise cause. Preserve the failure without
an unchanged full retry. A temporary, local-only execution-state request is
then activated for remaining verification using Microsoft's documented
[SetThreadExecutionState](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-setthreadexecutionstate)
with SYSTEM_REQUIRED /CONTINUOUS. No stored power setting, application code,
CI configuration, clock or test deadline changes. The request is released at
the end. Ignored helper: `out/t023-ci-awake.ps1`.

After successful integration compilation, separate focused host acceptance runs
the exact two CSV memory cases plus shared CSV preview/import, JSON import and
storage/save cases. It retains complete 1/5-GB fixtures, every SQL/data/hash check,
60 Browse /20 SQL pages and the unchanged timing/memory guards. Preserve
`out/t023-ci-host.mts` /`out/t023-ci-host.log`. Repaired actual-candidate CI stays
pending; this focused evidence cannot replace the failed full gate.

The independent read-only reviewer finds no concrete defect or weakened guard:
raw headers/quoted values and partial boundaries retain detection semantics;
source checks and every timing/memory/workload/diagnostic policy remain intact.
The reviewer runs no workloads. `readStartedMs`/`readFinishedMs` bracket the host
`loader.preview` call, including worker startup, messaging and termination. They
cannot establish worker CPU versus scheduling delay. The original CI slow-stage
cause remains unproven. A follow-up review finds no concrete main-thread defect
explaining the local host gap below; it identifies no evidence locating that gap
within process creation, VS Code message delivery or HTML replacement.

The separate focused host run (`integration-profile-BfgIf5`) passes 13 cases,
then fails the populated CSV test at 1 GB: maximum host timer gap 127.3266 ms
exceeds the unchanged 100-ms bound. Its preview passes at 280.0248 ms (transport
71.9150, read start 72.4590, read finish 268.1822, webview ready 149.7726 ms).
The 5-GB phase is not reached. This is a failed host gate; cause remains
unproven. Its renderer error, source
`20261017T120513/window1/renderer.log:57`, severity error, is `1 test failed.`
and correctly fails strict scanning. Its only approved warning is HOST-001,
source `20261017T120513/window1/renderer.log:10`, severity warning, exact message
`[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.

One separate preview-only diagnostic then uses the unchanged real populated
5-GB CSV generator: 5,000,003,592 bytes /1,220,704 rows, SHA-256
`350d6e4f39ac41dfa814bb65b80c11f24ff58469c4df6beb8d2b6888cb871e68`.
All 100 complete preview rows match their 4,095-character values and the source
hash is unchanged after closure. First-row command-to-host DOM time is
995.4049 ms, below the original 2000-ms bound; transport 517.6453, read start
519.9242, read finish 816.7392 and webview ready 926.0994 ms. This diagnostic
passes one case /strict log audit in 79,941 ms; it does not run full import,
memory sampling, responsiveness or repeated paging, and does not clear either
failed gate. Preserve `out/t023-ci-preview.log`.

Exact approved warning records from its `integration-profile-` session:

- `20261017T120950/window1/renderer.log:1`, severity warning, HOST-003,
  `Creation of workbench contribution 'workbench.contrib.preferencesActions' took 30ms.`
- `20261017T120950/window1/renderer.log:10`, severity warning, HOST-001,
  `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.

The diagnostic is not warning-free. No other warning or error is accepted.
The temporary execution-state request is released with exit 0; stored power
settings remain unchanged. The diagnostic test module is removed after the
run so it cannot enter the ordinary test glob. No unchanged failing gate is
retried. Production code is unchanged after the 790-unit standalone pass;
only documentation/evidence updates follow. T-023 remains unchecked until
repaired actual-candidate three-platform full CI is clean. The original
2005-ms CI cause and the separate local 127-ms gap remain unproven.

## Files and reproduction

### Repaired actual-candidate CI and closure (2026-10-17)

Owner reports [run 39002490041](https://github.com/JreyForFun/lite-voyager/actions/runs/39002490041)
PASS. Public GitHub API run/job/step metadata independently confirms attempt 1,
completed success, at exact `db28c92ea6e8406e02b999899a38843c8bfa0ce7`, the
reviewed repair commit and local HEAD before these documentation updates.

- Windows job 117308167927: locked installation and applicable Windows/macOS
  full-verification step succeed.
- Ubuntu job 117308167922: locked installation and Linux session-bus/virtual-display
  full-verification step succeed.
- macOS job 117308167800: locked installation and applicable Windows/macOS
  full-verification step succeed.

Remote raw logs, test counts and diagnostic counts are not retrieved; no
warning-free remote claim. The configured full steps retain all original
preview/import/paging/data/hash/memory/timing and exact diagnostic guards.
Together with the observed local 790-unit standalone, original 65-host/stress
acceptance, scoped visual QA and cleared independent review, this completes
only T-023. Check its task box. Earlier CI/local failures remain failed and
their original unknown causes stay unknown; no unchanged retry-to-green.
Closure changes documentation only. Local closure `npm run verify` passes all
790 units /78 files (334.99-second unit phase), strict type checks, lint,
production build and 31-file /694.21-KB VSIX with zero errors and zero warnings.
Preserve `out/t023-close-verify.log`. The temporary local idle-sleep execution
request is released with exit 0 and no stored power setting changes. Only final
documentation status updates follow; code, tests and guards remain unchanged.
Owner retains push of the closure records. T-024 begins in a fresh chat;
no whole-milestone closure, release or tag is claimed.

Closure files only: `PROGRESS.md`, `docs/t023-json.md`, `docs/t023-windows-ci.md`,
and T-023 entries in `specs/TASKS.md` /`specs/VALIDATION.md`.

### Repair files and commands (historical)

Modified: `src/loaders/csv-detection.ts`, `src/loaders/csv-preview-reader.ts`,
`src/editor/csv-import.ts`, `src/test/csv-import-memory.test.ts`,
`test/unit/csv-import-panel.test.ts`, `CHANGELOG.md`, `docs/t023-json.md`,
`PROGRESS.md`, the T-023 entries only in `specs/TASKS.md` and `specs/VALIDATION.md`.
Created: `test/unit/csv-detection.test.ts`, `docs/t023-windows-ci.md`.
Owner README/T-015 spec edits and existing untracked fixtures stay excluded.

Focused unit command: `npx vitest run test/unit/csv-detection.test.ts
test/unit/csv-import-panel.test.ts test/unit/csv-preview.test.ts
test/unit/csv-preview-snapshot.test.ts`. Canonical commands are `npm run verify`
and `npm run verify:full`; full is failed as recorded, not retried unchanged.
Integration compilation is `npx tsc --project tsconfig.integration.json`.
Ignored host/diagnostic helpers, logs and execution-state helper are under `out/`.
Owner pushes the scoped repair, then supplies the new CI run URL.
