# T-027: macOS startup warning, proposed policy decision

Status: exact proposal approved and implemented test-first on 2026-10-25;
canonical local verify/full pass by 2026-10-26 (Asia/Manila). The owner retains
push/CI. T-027 is complete after independently confirmed candidate three-platform
CI on 2026-10-26; see the final confirmation below.
The investigation/proposal below is historical context, superseded only by
the dated decision and observed results at the end.

## Observed candidate CI

[Run 40178896696](https://github.com/JreyForFun/lite-voyager/actions/runs/40178896696),
attempt 1, tests exact `084ab2ba07f81cb4b2a4b3b69a35ba2dbc31596f`.
Public GitHub REST run/job/step metadata independently confirms:

- Windows job 121125487293: locked install and applicable full verification pass.
- Ubuntu job 121125487325: locked install and applicable full verification pass.
- macOS job 121125487139: locked install passes; full verification fails.

Created 2026-10-25T09:00:48Z, updated 09:18:46Z. Metadata is retained locally in
`out/t027-ci-40178896696-run.json` and `-jobs.json`. Raw Windows/Ubuntu step logs
were not supplied or independently retrieved; no warning-free remote claim.

The owner-supplied complete macOS verify-step log reports strict types/lint,
1,034 passing units with 14 platform skips (107 passing files/one skipped),
production build, 34-file/997.14-KB VSIX and all 77 host tests passing. Host runner
and VS Code exit zero. The runtime-log checker then rejects this sole reported
unapproved record, causing full verification to exit one:

```text
20261025T090446/window1/renderer.log:13: 2026-10-25 09:04:55.382 [warning] Creation of workbench contribution 'chat.builtinTools' took 212ms.
```

One other diagnostic is explicitly approved, not suppressed:

```json
{"source":"20261025T090446/window1/renderer.log","line":16,"severity":"warning","rule":"VSCODE-HOST-001","message":"[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]"}
```

No GPU error or original 100-ms host-interval failure appears in this supplied
log. All four populated JSON/JSONL interval maxima pass: 29.321417000028305,
67.30475000001024, 67.23029100004351 and 52.26233399997 ms. This observation
does not establish a repair or cause for the previous intermittent failures.
Retain [the earlier investigation](t027-ci-investigation.md) unchanged.

Original attachment:
`C:/Users/ADMIN/.codex/attachments/ff667b37-dd39-4950-95db-9c05bcbf167a/Pasted text.txt`.
Byte-identical copy: `out/t027-ci-40178896696-macos.log`.
SHA-256: `36c40663e4f6210361f0e4bc0ee469eba102586bbd6300f365e317773f670534`.

## Vendor evidence and its limits

The CI log identifies VS Code 1.140.0 darwin-arm64 revision
`b224f6bf5a4fcad5fa4c640ed10f179c3b613e48`. Fetching that exact revision's
`src/vs/workbench/common/contributions.ts` from Microsoft's public repository
returns HTTP 404. Do not claim inspection of that exact macOS source revision.

The already installed official Windows 1.140.0 distribution is available at
`.vscode-test/vscode-win32-x64-archive-1.140.0/07f806f999/resources/app`.
Its product revision is `07f806f999227108933c2e30515b26eecc1fda74`, distinct
from the macOS revision. Inspection of its bundled
`out/vs/workbench/workbench.desktop.main.js` establishes:

- The vendor contribution class has fixed ID `chat.builtinTools`; its constructor
  creates and registers built-in chat tools through vendor services.
- It is registered at `Eventually`, not `BlockStartup`.
- The vendor registry measures synchronous construction using `Date.now()` and
  warns with the observed wording when the applicable threshold is exceeded.
  The after-restore threshold is 100 ms (before-restore threshold 20 ms).

This is evidence of vendor-owned warning generation, not proof of the actual
macOS constructor's dependencies, why it took 212 ms, or its relation to any
historical GPU/host stall. The warning is logged after the extension host starts;
do not describe it as a proven pre-extension warning. No vendor files are edited.

## Concrete proposal: inactive pending owner decision

Current AGENTS.md and VALIDATION section 1 explicitly permit only five exact
renderer diagnostic families. Generic implementation authorization is not
treated as approval to silently broaden that specific policy.

Recommend one additional exact family, proposed ID `VSCODE-HOST-006`:

```text
Creation of workbench contribution 'chat.builtinTools' took Nms.
```

`N` must contain only ASCII digits, an unsigned integer duration. Proposed
anchored message pattern (not installed):

```js
/^Creation of workbench contribution 'chat\.builtinTools' took \d+ms\.$/
```

All existing guards remain: only a structured timestamped `[warning]` from
`YYYYMMDDTHHMMSS/windowN/renderer.log`; return/report original source, line,
severity, rule and message. Error severity, extension-host/main logs, missing or
nested session sources, malformed durations, changed IDs, extra wording and every
other warning/error still fail. Console checks/types/lint/builds retain zero
diagnostics; full runs containing this family are never called warning-free.
No blanket chat/vendor allowance, log filtering, threshold/clock adjustment,
workload reduction, launch switch, dependency or retry-to-green exception.

This is an explicit validation-policy change, not a performance repair. If the
owner declines it, keep the current failure rather than hide the warning.

## Implementation and acceptance if approved

Continue exactly T-027. Write failing tests before adding the rule. Cover the
observed 212-ms record and other unsigned integer values; structured metadata and
outer console reporting; rejection of signed/decimal/non-numeric durations,
suffixes/prefixes, altered IDs, error severity and wrong/malformed log sources;
mixed approved and unapproved records must still fail and preserve reporting.
Keep all existing tests and five approved families unchanged.

Expected files to change after approval:

- `AGENTS.md`: document the exact sixth-family owner decision.
- `specs/SPEC.md`: update only current T-027 diagnostic-policy acceptance.
- `specs/PLAN.md`: record the policy decision and validation approach.
- `specs/VALIDATION.md`: install the exact rule and reporting/guard requirements.
- `scripts/integration-logs.mts`: add only the exact rule/type member.
- `test/unit/integration-logs.test.ts`: red-first acceptance and guard cases.
- `docs/t027-ci-startup-warning-proposal.md`: retain proposal/decision/results.
- `PROGRESS.md`: current status and handoff.

Run focused policy tests, literal `npm run verify` (zero errors/warnings), then
one changed-candidate CI-enabled `npm run verify:full`, preserving all original
large-file/data/source/timing/memory tests and reporting every approved warning.
Use the existing independent-review requirement. Owner pushes and supplies fresh
actual-candidate three-platform CI; neither this proposal nor a local pass ticks
T-027. No tag/release/publishing change.

## Checks performed during investigation

- Direct replay of the two exact warning messages into the current real checker
  confirms `chat.builtinTools` is rejected while HOST-001 is explicitly reported.
  The replay uses synthetic line positions 1/2; original CI positions are 13/16.
- Existing policy suite: 48 tests/one file PASS with installed Vitest. The initial
  sandboxed invocation fails before collecting tests with Vite `spawn EPERM`.
  Re-running outside that sandbox succeeds; both logs are retained as
  `out/t027-ci-40178896696-policy-tests.log` and `-policy-tests-unsandboxed.log`.
  This is not a full-gate retry and does not clear the failed CI.
- No executable changes, new tests, policy changes or full verification run in
  this investigation. Earlier candidate verification remains historical evidence.

Files written this investigation: this record and root `PROGRESS.md` only.
Preserve the owner's existing README/shared-spec edits and unrelated fixtures.

## Approved implementation (2026-10-25)

In direct response to the exact sixth-family proposal, the owner says OK and
delegates full implementation, fixture edits, judgement and local QA; the owner
retains push/CI. Adopt only the proposed HOST-006 family. Update AGENTS and the
current SPEC/PLAN/VALIDATION policy accordingly; preserve historical five-family
records as historical evidence. No new dependency, launch switch, workload or UI.

Test first: adding 26 acceptance/guard cases to the existing 48-case policy suite
produces 6 failures / 68 passes against the unchanged checker. The six failures
are three unsigned-duration acceptance cases, two mixed-diagnostic reporting
cases and the outer-console reporting case. Existing and new negative guards
continue passing. Retain `out/t027-host006-red.log`.

Implementation adds one anchored regex entry and one rule-union member only.
No changes to source/severity parsing, log traversal, console checking or the
previous five rules. The suite then passes all 74 tests/one file in 4.13 s;
retain `out/t027-host006-green.log`. Tests assert original metadata, explicit
console reporting, mixed-warning/error failures, and rejection of non-ASCII,
signed, decimal, exponential or empty durations, altered wording, wrong sources,
missing timestamp and error severity. No previous test is removed or relaxed.

Independent read-only review is requested using the review-bugbot skill's
existing isolated reviewer fallback (specialized Bugbot launcher unavailable).
Canonical standalone/full evidence will be appended after completion. No
visual UI change occurs in this follow-up; retain earlier scoped milestone
visual evidence as historical evidence, not a new physical-paint claim.

## Final local verification (completed 2026-10-26 Asia/Manila)

Both commands are run literally through the existing capture helper, with 314
source/config/record hashes captured before and after each command. Each exits
zero with every hash unchanged. No tracked files are edited during either gate.
The helper additionally captures AGENTS/README/CHANGELOG for this follow-up.

- `npm run verify`: 1,074 units / 108 files, strict host/webview/tooling types,
  lint, production build and 34-file/997.32-KB VSIX pass with zero errors and
  warnings. Started 2026-10-25T15:11:37.714Z, finished 15:21:20.824Z, 583.110 s.
  Evidence: `out/t027-host006-verify-1.log`, `-before.json`, `-status.json`.
- `LITE_VOYAGER_CI_DIAGNOSTICS=1` then `npm run verify:full`: same 1,074 units /
  108 files plus all 77 real-host tests, strict console/log checks and external
  diagnostic-recorder cleanup pass. Started 2026-10-25T15:22:06.313Z, finished
  16:10:24.330Z, 2898.017 s. Evidence: `out/t027-host006-full-1.log`,
  `-before.json`, `-status.json`. This is one changed-candidate full run.

Full is **not warning-free**. Exactly two approved records occur, both severity
warning from `20261025T233217/window1/renderer.log`; no other warning or error is
accepted:

```json
{"source":"20261025T233217/window1/renderer.log","line":1,"severity":"warning","rule":"VSCODE-HOST-005","message":"Creation of workbench contribution 'workbench.contrib.remoteStatusIndicator' took 49ms."}
{"source":"20261025T233217/window1/renderer.log","line":11,"severity":"warning","rule":"VSCODE-HOST-001","message":"[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]"}
```

HOST-006 does not occur in this real Windows run. Its acceptance/reporting is
observed in the 74-case policy suite and a replay of the exact two macOS messages
at original source/line positions 13/16 (`out/t027-host006-replay.log`). This is
a synthetic message replay, not a new macOS host run or a fresh CI pass.

Every original workload, hash and numeric guard remains. Representative retained
full-run measurements (sampled host plus helpers; renderer reported separately):

- SQLite: 1,285,033,984 / 5,874,388,992 bytes, ten million rows each; peaks
  283426816 / 293040128 bytes, paging growth 6422528 / 17248256 bytes, full
  source hashes and original 60 Browse / 20 SQL paging checks pass.
- Ten-million-row JSON and JSONL: complete aggregates and source hashes pass.
  Populated 1/5-GB JSON peaks 302194688 / 301461504 bytes, maximum raw host
  intervals 52.7178000001004 / 75.66749999998137 ms. JSONL peaks
  302088192 / 250949632 bytes, intervals 36.9570000001695 / 77.69640000001527 ms.
  All original source/data checks and sampling-gap limits pass. Bounded trace
  omissions remain explicit; no historical stall-cause attribution.
- CSV: 1,000,013,832 / 5,000,003,592 bytes, 244144 / 1220704 rows; peaks
  220266496 / 225652736 bytes; paging growth 33071104 / 29872128 bytes;
  first populated DOM 491.2308999998495 / 797.3047999998089 ms; maximum raw
  host intervals 57.64669999992475 / 56.74750000005588 ms. All original
  60 Browse / 20 SQL pages and full source hashes pass.

Both-engine real webview controls/DOM, fidelity, schema completion, cancellation,
source safety and the remaining original host tests pass. No layout changes
occur; no new physical screenshot/paint, cold-start or unsampled-peak claim.
Earlier delegated visual QA is retained in the milestone record.

Independent read-only review finds no concrete checker defect. Its initial
documentation-status gap is resolved by the approval/implementation section;
follow-up confirms that resolution. Final factual-record review confirms the
counts, durations, both exact warning records, metrics and log hashes without
correction. Review itself does not substitute for executing gates.

Log SHA-256 values:

- Standalone: `c51bd899c8f89e03d80204d747760478adfc6290d8f6ef1d8fc8bd99990ff956`.
- Full: `db7b33e2a42b7c0b699d4dd40d269b342e1b39c1047456edfed853bcf25cc203`.

Two unshipped task-only commit-preview attempts stop before index mutation:
sandbox child-process `spawn EPERM`, then a selector expecting added `T-027`
text misses the new PLAN paragraph. The corrected preview selects only added
`HOST-006` hunks in PLAN/VALIDATION and succeeds. No tracked or executable change,
candidate test failure or full-gate retry results from those preview attempts.

Only the eight files listed above under implementation scope belong to this
follow-up. Preserve all inherited owner document hunks and unrelated fixtures.
After recording results, compare frozen hashes again: record-only updates are
allowed; no executable change may be included without revalidation. Owner pushes
the local task commit and supplies fresh actual-candidate CI URL/SHA and complete
failed-step logs if needed. Do not tick T-027, tag or claim earlier GPU/timing
causes repaired from this policy amendment or these local passes.

## Actual-candidate CI confirmation (2026-10-26 Asia/Manila)

The owner reports PASS ALL and supplies
[run 40211134222](https://github.com/JreyForFun/lite-voyager/actions/runs/40211134222).
Public GitHub REST independently confirms attempt 1, exact tested commit
`8cd598317a56c96e3038d7ae7fb598d9e4462411`, completed/success:

- Windows job 121222400478: locked installation and applicable full verification
  succeed.
- macOS job 121222400648: locked installation and applicable full verification
  succeed.
- Ubuntu job 121222400650: locked installation and session-bus/virtual-display
  full verification succeed.

Run created 2026-10-25T16:19:38Z, updated 16:34:03Z. Metadata is retained in
`out/t027-ci-40211134222-run.json` and `-jobs.json`. Remote raw logs and approved
warning records were not independently retrieved; do not call remote runs
warning-free or infer their warning counts from metadata. The local full's two
exact approved warning records remain reported above.

This clears actual-candidate three-platform CI for the already reviewed and
locally verified implementation. Prior cumulative review, scoped eight-item
delegated QA and acceptance reconciliation remain in the milestone QA record.
T-027 may be checked. Only task acceptance closes: no new feature, release,
tag, publication or separate milestone-release closure. Historical Windows
startup/WidgetHost and macOS GPU causes remain unestablished; this passing run
does not establish a causal repair. Keep all failed runs and limits.

This confirmation changes records only. The executable candidate remains the
verified 8cd5983 source. Owner document hunks and unrelated fixtures are preserved;
the owner pushes closure records.

Required closure `npm run verify` also passes: 1,074 units / 108 files, strict
types/lint/build, 34-file/997.32-KB VSIX, zero errors/warnings. Started
2026-10-25T16:40:32.936Z, finished 16:50:45.091Z (612.155 s), exit zero and
314 unchanged before/after hashes. Evidence: `out/t027-closure-verify-1.log`,
`-before.json`, `-status.json`. Final result/checklist wording updates are records
only; executable parity with the successful candidate remains unchanged.
