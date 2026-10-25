# T-027 failed candidate CI investigation

Owner supplies the failed run and complete Windows/macOS verify-step logs on
2026-10-25 (Asia/Manila). Existing T-027 authorization covers investigation,
fixtures, tests and necessary repairs; the owner retains push/CI.

## Confirmed failed run

[Run 40055575496](https://github.com/JreyForFun/lite-voyager/actions/runs/40055575496),
attempt 1, exact 176b18450b63a3a7c75382bb441b68ce60b6680c. Public REST metadata
independently confirms Windows and macOS fail their applicable full-verification
step; Ubuntu succeeds. All locked installs pass. Created 2026-10-24T02:46:34Z,
updated 03:01:09Z. Retain the metadata in out/t027-ci-40055575496-run.json and
-jobs.json. The passing local 176b184 gate remains historical evidence; it does
not override these failed jobs or cover later executable changes.

- Windows job 120757696167: 1,032 units / 106 files pass. Host tests report
  75 pass / 1 fail. The populated 1-GB JSONL native import has an original
  102.54019999998854-ms timer interval against the unchanged 100-ms limit,
  ready/none to importing/none. A generic PROMISE callback overlaps for
  99.24479999998584 ms; sampled process CPU deltas are both zero, no GC entry
  overlaps, and resource coverage is explicitly incomplete (167 untracked).
  Neither phase, callback type, CPU zero nor absence of recorded GC establishes
  which operation blocked, native waiting, OS descheduling or a root cause.
  A separate WidgetHost error also independently prevents a strict clean gate:

  `[7192:1024/025321.757:ERROR:mojo\public\cpp\bindings\lib\interface_endpoint_client.cc:748] Message 4 rejected by interface blink.mojom.WidgetHost`
- macOS arm64 job 120757696038: 1,018 units pass / 14 platform skips; all 76
  host tests pass. Strict console validation then rejects 40 Chromium GPU
  errors: 20 ProduceOverlay/non-existent-mailbox and 20 Invalid-mailbox records,
  at 02:57:30.041697 through 02:57:30.091680. They occur around the two-view
  opening test, which passes. This identifies context, not product/GPU causation.
  Existing ordinary macOS rendering and the previous green run do not establish
  the backend selected here or make this failed run acceptable.

Full original verify-step outputs are retained byte-for-byte as
out/t027-ci-40055575496-windows.log and -macos.log. The exact 40 macOS error
records are appended below. The failed jobs do not reach a successful formatted
approved-diagnostic report; no warning-free remote claim is made.

## Diagnostic acceptance and implementation

No confirmed product or host-configuration repair is claimed. Preserve every
source/data assertion, full workload, deadline, 100-ms timer, renderer argument,
error/warning rejection and five-family exception policy. No unchanged retry.

The original async callback trace lacks named operations. Add opt-in named spans
for state postMessage, fixed Output appendLine, storage/source/space preflight,
import-work directory, synchronous helper fork, PID registration and IPC send.
Use the stable Node diagnostics channel API with fixed labels and numeric fields
only. With no subscriber, return the original value/promise/error and do not read
clocks/CPU. The existing opt-in interval recorder subscribes only while active,
keeps 128 spans, reports drops and removes listeners on stop. Record synchronous
calls separately from await elapsed time; never subtract either from the original
timer. Copy only approved fields from channel messages, rejecting malformed labels.
Process CPU deltas are process-wide, not causal thread attribution.

The initial active `code --status` experiment is rejected: although its one
250-row native JSONL startup assertion passes (42.2112-ms raw maximum with a
34.2011-ms named fork), the status report contains this unapproved GPU error:

`[8772:1025/152902.054:ERROR:ui\gl\direct_composition_support.cc:247] : GetGpuDriverOverlayInfo: Failed to retrieve video device`

Its process snapshot also shows a separate Code --status instance with GPU,
network and crashpad descendants. The direct CLI timeout cannot guarantee their
cleanup, and lexical profile ownership alone is insufficient. No surviving leak
is observed; no clean probe or failed-CI explanation is claimed. Retain
out/t027-ci-probe-1.log. Remove this active launcher from the candidate entirely.

The replacement reads one passive OS process snapshot (PowerShell CIM / ps),
bounded to 15 seconds / 1 MiB / 8,192 records / 65,536 command characters. Resolve
canonical profile ownership, refuse linked out/profile paths, select the exact
isolated main process and descendants, and require the actual test-host PID.
Emit only that tree. It launches no Code/GPU instance, queries no graphics API,
sends no signals and retains no process handles. Arguments are a point-in-time
observation, not proof of the actual graphics backend or any historical cause.
Missing/uncertain identity, malformed output or collector failure fails collection.

## Observed checks and limits

- New primitives initially fail missing modules. After primitives exist, the
  real controller wiring regression fails with an empty span list (31 pass /
  1 fail). Wiring then passes. A further genuine red regression proves extra
  private channel fields could be retained; explicit field copying fixes it.
- First lint rejects an unsafe asymmetric matcher assignment; correct the test
  type/shape without any, ignore or suppression. Strict types/lint then pass.
- Stronger passive-snapshot tests fail before replacement, including no Code
  launch, owner/prefix exclusion, linked-profile refusal and collector failures.
  Current focused checks pass 42 tests / 6 files; integration types pass.
- Changed passive candidate probe 2 passes one real-host 250-row JSONL test and
  strict console/log checks: original raw maximum 70.8018 ms, named synchronous
  fork 56.2899 ms; all ten stages and exact source bytes are observed. Incomplete
  generic async resource coverage remains explicit (2 untracked); named spans
  are not proof of the prior 1-GB failure. No 1/5-GB or memory claim is made from
  this small probe. Evidence: out/t027-ci-probe-2.log.
- Probe 2 is not warning-free. Exact severity-warning approved records, source
  20261025T153453/window1/renderer.log:
  - Line 1, VSCODE-HOST-005: `Creation of workbench contribution 'workbench.contrib.remoteStatusIndicator' took 24ms.`
  - Line 3, VSCODE-HOST-002: `Creation of workbench contribution 'workbench.contrib.chatLanguageModelsData' took 31ms.`
  - Line 11, VSCODE-HOST-001: `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
- Independent read-only follow-up clears the passive replacement, canonical
  ownership, bounded fixed-label spans, disabled-path behavior and unchanged
  gates, with no remaining concrete finding in inspected paths. Reviewer runs
  no tests; primary-agent logs supply passing execution evidence.
- Canonical `npm run verify` PASS: 1,048 units / 108 files, strict host/webview/
  tooling types, lint, production build and VSIX (34 files, 997.32 KB), zero
  errors/warnings; 2026-10-25T07:39:40.256Z through 07:49:38.732Z, 598.476 s.
  All 310 before/after hashes match. Evidence: out/t027-ci-verify-1.log,
  -before.json and -status.json.
- Canonical `npm run verify:full` with the workflow's existing
  LITE_VOYAGER_CI_DIAGNOSTICS=1 PASS: 1,048 units / 108 files plus 77 real-host
  tests, every original workload and strict console/log checks. Started
  2026-10-25T07:51:00.057Z, finished 08:34:23.040Z (2602.983 s), exit 0,
  all 310 hashes match. External Windows creation-identity observations retain
  the original host's disappearance; no pin/kill or historical-cause claim.
  Evidence: out/t027-ci-full-1.log, -before.json and -status.json.
- Full is not warning-free: exactly one approved severity-warning record,
  VSCODE-HOST-001, source 20261025T160104/window1/renderer.log:10:
  `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
  No other warning/error is accepted. The three probe warnings above are a
  separate earlier host, not additional warnings in this full run.
- The matching 1-GB JSONL workload passes with raw 41.3198 ms at ready/none to
  importing/none; named fork 30.1641 ms, Output 0.0581 ms, state 0.4988 ms,
  plus separately labelled await spans. The earlier 102.5402-ms CI stall is not
  reproduced or explained. Full JSON/JSONL maxima are 53.1330 / 46.7519 /
  41.3198 / 45.7075 ms; all complete data/source checks pass. Generic resource
  coverage/drops remain explicit. Current small probe max is 48.6283 ms.
- Source/configuration/test bytes remain the verified executable candidate;
  only completion records follow the gates. Instrumentation can affect timing.
  No original failed-CI cause or repaired CI pass is claimed.

## Current measured evidence

Host: VS Code 1.140.0, Windows x64, helper Node 24.21.0; native SQLite 3.53.4
and fallback 3.49.1. Native populated SQLite/CSV each retain 60 Browse / 20 SQL
pages. Every combined host-plus-helper peak is strictly below 500,000,000 bytes;
CSV peaks are 320831488 / 322756608, with 1925120-byte size growth and paging
growth 37019648 / 29958144, each below 50,000,000 bytes. SQLite peaks are
277676032 / 290275328, size growth 12599296 and paging growth 9449472 / 16019456.
Populated CSV first DOM 507.5368 / 616.6773 ms and SQLite 1203.3540 / 896.7812 ms
are below 2000 ms. CSV host timer maxima 43.7158 / 49.7959 ms are below 100 ms.
All memory observation gaps are below 3000 ms, and actual helpers have at least
five samples. JSON/JSONL retains full populated imports/data/hashes, without a
repeated-paging claim. Ten-million-row aggregates and full hashes also pass.

These are warm generated files and sampled resident memory. Renderer memory is
reported separately; CSV calibration renderer peak is 966537216 bytes and the
5-GB CSV renderer peak is 594735104, not under the extension-host/helper cap.
No physical paint, cold-disk speed or unsampled instantaneous-peak claim is made.
Complete sizes, hashes, sample counts/gaps, peaks and source checks follow in the
retained raw evidence block; source files are never read wholesale for hashing.

## Owner handoff

Keep T-027 unchecked. After local validation, owner pushes the diagnostic candidate
and supplies fresh Windows/macOS/Ubuntu run URL, exact tested SHA and complete
verify logs. Named spans should distinguish Output/state/fork work from async
preflight waits if the timer failure recurs. Passive process arguments may inform
a later controlled graphics experiment; do not toggle renderers or add diagnostic
exceptions from a guess. The Windows WidgetHost and macOS mailbox errors remain
separate unresolved failures. No release/tag or later-feature scope is added.

## Exact original macOS console errors

```text
[4306:1024/025730.041697:ERROR:gpu/command_buffer/service/shared_image/shared_image_manager.cc:370] SharedImageManager::ProduceOverlay: Trying to Produce a Overlay representation from a non-existent mailbox.
[4306:1024/025730.042911:ERROR:components/viz/service/display_embedder/skia_output_device_buffer_queue.cc:258] Invalid mailbox.
[4306:1024/025730.042924:ERROR:gpu/command_buffer/service/shared_image/shared_image_manager.cc:370] SharedImageManager::ProduceOverlay: Trying to Produce a Overlay representation from a non-existent mailbox.
[4306:1024/025730.042928:ERROR:components/viz/service/display_embedder/skia_output_device_buffer_queue.cc:258] Invalid mailbox.
[4306:1024/025730.042931:ERROR:gpu/command_buffer/service/shared_image/shared_image_manager.cc:370] SharedImageManager::ProduceOverlay: Trying to Produce a Overlay representation from a non-existent mailbox.
[4306:1024/025730.042933:ERROR:components/viz/service/display_embedder/skia_output_device_buffer_queue.cc:258] Invalid mailbox.
[4306:1024/025730.042935:ERROR:gpu/command_buffer/service/shared_image/shared_image_manager.cc:370] SharedImageManager::ProduceOverlay: Trying to Produce a Overlay representation from a non-existent mailbox.
[4306:1024/025730.042938:ERROR:components/viz/service/display_embedder/skia_output_device_buffer_queue.cc:258] Invalid mailbox.
[4306:1024/025730.042942:ERROR:gpu/command_buffer/service/shared_image/shared_image_manager.cc:370] SharedImageManager::ProduceOverlay: Trying to Produce a Overlay representation from a non-existent mailbox.
[4306:1024/025730.042944:ERROR:components/viz/service/display_embedder/skia_output_device_buffer_queue.cc:258] Invalid mailbox.
[4306:1024/025730.064336:ERROR:gpu/command_buffer/service/shared_image/shared_image_manager.cc:370] SharedImageManager::ProduceOverlay: Trying to Produce a Overlay representation from a non-existent mailbox.
[4306:1024/025730.064394:ERROR:components/viz/service/display_embedder/skia_output_device_buffer_queue.cc:258] Invalid mailbox.
[4306:1024/025730.064404:ERROR:gpu/command_buffer/service/shared_image/shared_image_manager.cc:370] SharedImageManager::ProduceOverlay: Trying to Produce a Overlay representation from a non-existent mailbox.
[4306:1024/025730.064410:ERROR:components/viz/service/display_embedder/skia_output_device_buffer_queue.cc:258] Invalid mailbox.
[4306:1024/025730.064415:ERROR:gpu/command_buffer/service/shared_image/shared_image_manager.cc:370] SharedImageManager::ProduceOverlay: Trying to Produce a Overlay representation from a non-existent mailbox.
[4306:1024/025730.064420:ERROR:components/viz/service/display_embedder/skia_output_device_buffer_queue.cc:258] Invalid mailbox.
[4306:1024/025730.064424:ERROR:gpu/command_buffer/service/shared_image/shared_image_manager.cc:370] SharedImageManager::ProduceOverlay: Trying to Produce a Overlay representation from a non-existent mailbox.
[4306:1024/025730.064429:ERROR:components/viz/service/display_embedder/skia_output_device_buffer_queue.cc:258] Invalid mailbox.
[4306:1024/025730.064434:ERROR:gpu/command_buffer/service/shared_image/shared_image_manager.cc:370] SharedImageManager::ProduceOverlay: Trying to Produce a Overlay representation from a non-existent mailbox.
[4306:1024/025730.064439:ERROR:components/viz/service/display_embedder/skia_output_device_buffer_queue.cc:258] Invalid mailbox.
[4306:1024/025730.072710:ERROR:gpu/command_buffer/service/shared_image/shared_image_manager.cc:370] SharedImageManager::ProduceOverlay: Trying to Produce a Overlay representation from a non-existent mailbox.
[4306:1024/025730.072892:ERROR:components/viz/service/display_embedder/skia_output_device_buffer_queue.cc:258] Invalid mailbox.
[4306:1024/025730.072998:ERROR:gpu/command_buffer/service/shared_image/shared_image_manager.cc:370] SharedImageManager::ProduceOverlay: Trying to Produce a Overlay representation from a non-existent mailbox.
[4306:1024/025730.073291:ERROR:components/viz/service/display_embedder/skia_output_device_buffer_queue.cc:258] Invalid mailbox.
[4306:1024/025730.073484:ERROR:gpu/command_buffer/service/shared_image/shared_image_manager.cc:370] SharedImageManager::ProduceOverlay: Trying to Produce a Overlay representation from a non-existent mailbox.
[4306:1024/025730.073576:ERROR:components/viz/service/display_embedder/skia_output_device_buffer_queue.cc:258] Invalid mailbox.
[4306:1024/025730.074135:ERROR:gpu/command_buffer/service/shared_image/shared_image_manager.cc:370] SharedImageManager::ProduceOverlay: Trying to Produce a Overlay representation from a non-existent mailbox.
[4306:1024/025730.074768:ERROR:components/viz/service/display_embedder/skia_output_device_buffer_queue.cc:258] Invalid mailbox.
[4306:1024/025730.074850:ERROR:gpu/command_buffer/service/shared_image/shared_image_manager.cc:370] SharedImageManager::ProduceOverlay: Trying to Produce a Overlay representation from a non-existent mailbox.
[4306:1024/025730.074901:ERROR:components/viz/service/display_embedder/skia_output_device_buffer_queue.cc:258] Invalid mailbox.
[4306:1024/025730.090632:ERROR:gpu/command_buffer/service/shared_image/shared_image_manager.cc:370] SharedImageManager::ProduceOverlay: Trying to Produce a Overlay representation from a non-existent mailbox.
[4306:1024/025730.090792:ERROR:components/viz/service/display_embedder/skia_output_device_buffer_queue.cc:258] Invalid mailbox.
[4306:1024/025730.091605:ERROR:gpu/command_buffer/service/shared_image/shared_image_manager.cc:370] SharedImageManager::ProduceOverlay: Trying to Produce a Overlay representation from a non-existent mailbox.
[4306:1024/025730.091647:ERROR:components/viz/service/display_embedder/skia_output_device_buffer_queue.cc:258] Invalid mailbox.
[4306:1024/025730.091655:ERROR:gpu/command_buffer/service/shared_image/shared_image_manager.cc:370] SharedImageManager::ProduceOverlay: Trying to Produce a Overlay representation from a non-existent mailbox.
[4306:1024/025730.091661:ERROR:components/viz/service/display_embedder/skia_output_device_buffer_queue.cc:258] Invalid mailbox.
[4306:1024/025730.091666:ERROR:gpu/command_buffer/service/shared_image/shared_image_manager.cc:370] SharedImageManager::ProduceOverlay: Trying to Produce a Overlay representation from a non-existent mailbox.
[4306:1024/025730.091670:ERROR:components/viz/service/display_embedder/skia_output_device_buffer_queue.cc:258] Invalid mailbox.
[4306:1024/025730.091676:ERROR:gpu/command_buffer/service/shared_image/shared_image_manager.cc:370] SharedImageManager::ProduceOverlay: Trying to Produce a Overlay representation from a non-existent mailbox.
[4306:1024/025730.091680:ERROR:components/viz/service/display_embedder/skia_output_device_buffer_queue.cc:258] Invalid mailbox.
```

## Canonical raw metric records

- Original windows verify-step SHA-256: 2d951d010da5207ee4ed4c9a298b88a122f562cab511b4ccade859d486fe5787.
- Original macos verify-step SHA-256: 1d062b7fbb67b514a8f30c27e81bf934875327a979019dabdbeb5acfea008740.

```json
[
  {
    "kind": "T-019 first-DOM evidence",
    "value": {
      "name": "one-gb.sqlite",
      "bytes": 1285033984,
      "firstDomMs": 1203.353999999992,
      "scope": "warm generated input; openWith through first populated DOM report, not physical paint"
    }
  },
  {
    "kind": "T-016 memory evidence",
    "value": {
      "name": "one-gb.sqlite",
      "bytes": 1285033984,
      "rows": 10000000,
      "report": {
        "peakBytes": 277676032,
        "hostPeakBytes": 154529792,
        "helperPeakBytes": 123478016,
        "rendererPeakBytes": 409620480,
        "samples": 58,
        "helperSamples": 57,
        "maxGapMs": 655.0588,
        "pagingGrowthBytes": 9449472
      },
      "sha256": "7fe4e06f189cc8bcc833521f82a2833118a98245d3c9f26d8bbae21032e0b298"
    }
  },
  {
    "kind": "T-019 first-DOM evidence",
    "value": {
      "name": "five-gb.sqlite",
      "bytes": 5874388992,
      "firstDomMs": 896.7811999999976,
      "scope": "warm generated input; openWith through first populated DOM report, not physical paint"
    }
  },
  {
    "kind": "T-016 memory evidence",
    "value": {
      "name": "five-gb.sqlite",
      "bytes": 5874388992,
      "rows": 10000000,
      "report": {
        "peakBytes": 290275328,
        "hostPeakBytes": 159866880,
        "helperPeakBytes": 130805760,
        "rendererPeakBytes": 395190272,
        "samples": 147,
        "helperSamples": 146,
        "maxGapMs": 573.9815000000017,
        "pagingGrowthBytes": 16019456
      },
      "sha256": "203e3860172622ef1a65108ae8d14acfe51c25b0f689ae267f4184e4721a535e"
    }
  },
  {
    "kind": "T-016 memory comparison",
    "value": {
      "vscode": "1.140.0",
      "node": "24.21.0",
      "platform": "win32",
      "arch": "x64",
      "fileGrowthBytes": 4589355008,
      "memoryGrowthBytes": 12599296,
      "elapsedMs": 267742.42449999996,
      "scope": "sampled resident host plus database helpers including workers; renderer separate; warm generated input; source hashes outside memory window"
    }
  },
  {
    "kind": "T-023 memory evidence",
    "value": {
      "format": "json",
      "bytes": 1000016431,
      "rows": 243313,
      "sha256": "41eacc598a3e38c50ac6f7b7deffb88ea3786126d1da2e954c7c3b9bf9205454",
      "peakBytes": 300068864,
      "hostTimerMaxGapMs": 53.13299999991432,
      "samples": 88,
      "importHelperSamples": 75,
      "maxObservationGapMs": 1096.6414999999997,
      "rendererPeakBytes": 431558656,
      "scope": "populated 4095-character TEXT records; full native import/data check; sampled host + all helpers; renderer separately; no physical paint or repeated-paging claim"
    }
  },
  {
    "kind": "T-023 memory evidence",
    "value": {
      "format": "json",
      "bytes": 5000065711,
      "rows": 1216561,
      "sha256": "3f93be795a091bd8d55247187772c3fbc1f7e8c53e1f9a1139008fd572bb8c37",
      "peakBytes": 303968256,
      "hostTimerMaxGapMs": 46.75190000003204,
      "samples": 384,
      "importHelperSamples": 332,
      "maxObservationGapMs": 1145.165399999998,
      "rendererPeakBytes": 417820672,
      "scope": "populated 4095-character TEXT records; full native import/data check; sampled host + all helpers; renderer separately; no physical paint or repeated-paging claim"
    }
  },
  {
    "kind": "T-023 memory evidence",
    "value": {
      "format": "jsonl",
      "bytes": 1000012320,
      "rows": 243312,
      "sha256": "a98cbfd61a4bad6a3004833be21b56d2f05cd45652005cf2925b5cf19df09d76",
      "peakBytes": 297975808,
      "hostTimerMaxGapMs": 41.31979999993928,
      "samples": 94,
      "importHelperSamples": 82,
      "maxObservationGapMs": 913.748599999999,
      "rendererPeakBytes": 403562496,
      "scope": "populated 4095-character TEXT records; full native import/data check; sampled host + all helpers; renderer separately; no physical paint or repeated-paging claim"
    }
  },
  {
    "kind": "T-023 memory evidence",
    "value": {
      "format": "jsonl",
      "bytes": 5000061600,
      "rows": 1216560,
      "sha256": "fe866f10bc4733086d26e8ef9f2545e49e05b45ae8905462a6a9aded2f5d30d9",
      "peakBytes": 295645184,
      "hostTimerMaxGapMs": 45.70750000001863,
      "samples": 433,
      "importHelperSamples": 374,
      "maxObservationGapMs": 825.5664000000015,
      "rendererPeakBytes": 406077440,
      "scope": "populated 4095-character TEXT records; full native import/data check; sampled host + all helpers; renderer separately; no physical paint or repeated-paging claim"
    }
  },
  {
    "kind": "T-021 CSV observer calibration",
    "value": {
      "peakBytes": 308367360,
      "hostPeakBytes": 176263168,
      "helperPeakBytes": 140328960,
      "rendererPeakBytes": 966537216,
      "samples": 38,
      "helperSamples": 20,
      "maxGapMs": 1277.9012000000002,
      "pagingGrowthBytes": 2023424,
      "importHelperPid": 20296,
      "browserHelperPid": 2380,
      "baselineAt": 25624.0332,
      "pagingStartedAt": 28083.431,
      "pagingFinishedAt": 34486.174199999994,
      "importHelperSamples": 15,
      "baselineSamples": 5,
      "pagingSamples": 10,
      "finalSamples": 5
    }
  },
  {
    "kind": "T-021 memory evidence",
    "value": {
      "minimum": 1000000000,
      "bytes": 1000013832,
      "rows": 244144,
      "sha256": "d9ca2d901ce394b65f350d58e6acfb7aa5de1ff6c709ef59cc165cfb0de68789",
      "engine": "node:sqlite",
      "runtime": "v24.21.0",
      "milliseconds": 61520.2248999998,
      "firstDomMs": 507.53679999988526,
      "ticks": 2116,
      "hostTimerMaxGapMs": 43.71580000012182,
      "peakBytes": 320831488,
      "hostPeakBytes": 176009216,
      "helperPeakBytes": 145006592,
      "rendererPeakBytes": 493166592,
      "samples": 90,
      "helperSamples": 42,
      "maxGapMs": 1239.4465000000055,
      "pagingGrowthBytes": 37019648,
      "importHelperPid": 9592,
      "browserHelperPid": 8492,
      "baselineAt": 51951.0811,
      "pagingStartedAt": 54238.7396,
      "pagingFinishedAt": 68341.47559999999,
      "importHelperSamples": 45,
      "baselineSamples": 5,
      "pagingSamples": 21,
      "finalSamples": 5,
      "scope": "warm populated single-TEXT-column CSV; sampled extension host + import/database helpers including workers; renderer separately; not physical paint or unsampled peaks"
    }
  },
  {
    "kind": "T-021 memory evidence",
    "value": {
      "minimum": 5000000000,
      "bytes": 5000003592,
      "rows": 1220704,
      "sha256": "350d6e4f39ac41dfa814bb65b80c11f24ff58469c4df6beb8d2b6888cb871e68",
      "engine": "node:sqlite",
      "runtime": "v24.21.0",
      "milliseconds": 194315.66659999988,
      "firstDomMs": 616.6772999998648,
      "ticks": 9450,
      "hostTimerMaxGapMs": 49.79590000002645,
      "peakBytes": 322756608,
      "hostPeakBytes": 179527680,
      "helperPeakBytes": 143642624,
      "rendererPeakBytes": 594735104,
      "samples": 299,
      "helperSamples": 81,
      "maxGapMs": 1187.4494000000122,
      "pagingGrowthBytes": 29958144,
      "importHelperPid": 23248,
      "browserHelperPid": 29476,
      "baselineAt": 184685.8364,
      "pagingStartedAt": 186378.931,
      "pagingFinishedAt": 197097.1715,
      "importHelperSamples": 215,
      "baselineSamples": 5,
      "pagingSamples": 21,
      "finalSamples": 5,
      "scope": "warm populated single-TEXT-column CSV; sampled extension host + import/database helpers including workers; renderer separately; not physical paint or unsampled peaks"
    }
  }
]
```

## Task-owned files

- PROGRESS.md
- docs/t027-ci-investigation.md
- docs/t027-milestone2-qa.md
- specs/PLAN.md
- specs/SPEC.md
- specs/TASKS.md
- specs/VALIDATION.md
- src/diagnostics.ts
- src/editor/csv-import.ts
- src/import-host-diagnostics.ts
- src/loaders/csv-import-client.ts
- src/test/host-interval-diagnostics.ts
- src/test/host-runtime-diagnostics.ts
- src/test/t027-import-startup.test.ts
- test/unit/csv-import-panel.test.ts
- test/unit/host-interval-diagnostics.test.ts
- test/unit/host-runtime-diagnostics.test.ts
- test/unit/import-host-diagnostics.test.ts

Only T-027 hunks in shared specs belong to the commit. Preserve inherited owner
README/spec edits, debug.log, gingTryWan and unrelated fixture files. No dependency,
workflow, renderer-argument, version, tag or publishing change.
