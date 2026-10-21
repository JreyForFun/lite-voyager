# T-026 validation repair: idle standby (2026-10-21)

The owner requests investigation and repair of the fixture-generation failure,
while retaining both failed full gates and prohibiting further full reruns.

## Evidence and cause

Windows System log, Microsoft-Windows-Kernel-Power:

- 2026-10-20 20:50:34 Asia/Manila: event 506, entering Modern Standby,
  reason Idle Timeout.
- 20:55:20: event 507, exiting Modern Standby, reason Power Button.
- The full-run renderer records completion of the preceding ten-million-row
  JSON/JSONL case at 20:50:40.485, then the 1-GB fixture failure at 20:55:21.075.
  The generation step therefore overlaps standby; the approximately 286-second
  standby interval exceeds its unchanged 180000-ms deadline.
- The earlier CSV case also overlaps idle standby: 20:11:28 to 20:13:11,
  followed by its 3000-ms observer watchdog failure at 20:13:15.778.

Event XML, record IDs and UTC timestamps are retained in
out/t026-standby-evidence.json; original renderer/full-run logs remain intact.
This establishes a suspended-machine environment during both failing steps,
which the earlier isolated runs did not reproduce. Verification previously held
no system-awake request. CPU/disk activity alone is not a Windows idle-sleep
inhibitor, as documented by Microsoft. The historical execFile output still lacks
exit-code/signal/killed fields: do not retroactively invent a particular signal
or claim the old full gates passed. Standby is confirmed; deadline expiry during
that interruption is the supported explanation for the full/isolated difference.

Reference: [SetThreadExecutionState](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-setthreadexecutionstate).

## Repair and acceptance

Only the verification launcher changes. Before any checks, Windows starts a
hidden, dependency-free PowerShell helper. One synchronous native thread holds
ES_CONTINUOUS | ES_SYSTEM_REQUIRED, acknowledges acquisition, and clears the
request after stdin EOF or original owner-process exit. An opened owner process
handle avoids PID-reuse confusion. The helper also acknowledges that the system
requirement was present when released. Thread/process termination clears the
thread-owned request as a fallback.

Verification awaits startup and cleanup. A missing acknowledgement, launch failure,
diagnostic, premature exit, nonzero exit or invalid release acknowledgement fails
the gate. Check and cleanup failures both remain visible. Other platforms launch
no Windows helper. The extension and VSIX do not contain this tooling. No display
request, simulated input, away mode, global power-plan change, retry, clock
adjustment, deadline increase or workload/assertion/diagnostic change is made.
Explicit user sleep and OS/battery policies can override power requests; existing
strict deadlines remain effective in that case.

## Tests-first evidence

- The new lifecycle suite first fails because scripts/keep-awake.mts is absent.
- Initial implementation passes nine cases, including the actual native request.
- Two additional regressions fail: split CRLF acknowledgement and an overstrong
  assumption that parent exit necessarily delivers the fake Node helper's EOF
  callback. Fix stream normalization across complete chunks and validate the real
  native helper's owner-exit cleanup instead. The real helper explicitly watches
  its original owner as well as EOF; the eleven-case suite then passes.
- An additional assertion fails because aggregate console output hides the two
  error messages. Preserve both original errors and render both messages.
- Initial lint finds an unnecessary async test callback; return promises directly.
  No lint/type disable or test removal is used.
- Optional read-only powercfg /requests inspection fails because this session
  lacks a Windows-elevated token. No privilege/power-policy change is
  attempted. Native acquisition/release acknowledgements provide the actual
  system-request check instead.
- The unchanged 1-GB generator under the native guard passes in 7951.8724 ms with
  empty stderr. All 1,000,016,431 bytes and SHA-256 match the original recipe:
  41eacc598a3e38c50ac6f7b7deffb88ea3786126d1da2e954c7c3b9bf9205454.
  Both native acknowledgements pass. Evidence:
  out/t026-json-fixture-awake-result.json. This is not a full host-memory/gate pass.

Standalone `npm run verify` PASSes after repair: 949 tests/96 files, strict
host/webview/tooling types, lint, production bundles and 34-file/996.33-KB VSIX.
Zero errors and zero warnings. Started 2026-10-21 13:56:09.443 UTC, finished
14:05:51.713 UTC (582.270 seconds). Native acquisition and release both pass;
all 276 captured file hashes remain unchanged throughout. Evidence:
out/t026-standby-verify-1.log and -status.json. The scoped Windows event query
finds no standby entry/resume events during that run; query result is retained
in out/t026-standby-verify-1-power-events.json.

No full rerun is started; both original full failures and exact diagnostics remain in
[t026-autocomplete.md](t026-autocomplete.md). T-026 remains unchecked for full
acceptance and owner-supplied actual-candidate three-platform CI.

Commands for focused and standalone checks:

```
npm test -- test/unit/keep-awake.test.ts
npm run verify
```
