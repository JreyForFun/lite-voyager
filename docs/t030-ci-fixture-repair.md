# T-030: canonical-path fixture repair

Status (2026-10-31): fixture-only repair passes focused tests, independent review
and final standalone verification. Fresh owner-pushed candidate CI is pending.
Only T-030 is active. Owner authorizes repairs, QA and local commits; retains push.

## Failed candidate

Owner supplies [run41054019454](https://github.com/JreyForFun/lite-voyager/actions/runs/41054019454).
Public REST metadata confirms attempt1 at exact commit
`8a1d9af81c94fc73a546f7fa9616b0282a9dfe4d`, completed failure:

- Windows job124056874687 fails:7 unit failures,1139 passes across113 files.
- macOS job124056874180 fails:7 unit failures,1125 passes and14 existing
  platform-specific skips across113 files. No skip is added by this repair.
- Ubuntu job124056874665 succeeds. Remote raw diagnostic counts are not
  independently retrieved; no warning-free remote-run claim is made.

Both failing jobs stop before host tests. They do not establish a new result
for the earlier266.675ms macOS JSONL timer failure. Retain all previous failures.
Owner-pasted logs are copied byte-for-byte to
out/t030-fixture-ci-41054019454-windows.log and -macos.log.
The initial public-metadata approval rejection is resolved after checking that
AGENTS restricts tasks tagged[H], while active T-030 is not tagged[H]. The same
read-only request is approved with that scope evidence; no alternate bypass,
account operation, push, workflow mutation or CI dispatch is used.

## Cause and test-first repair

The seven failing cases are fixtures introduced in the prior repair. They
construct SqliteEdits with a raw temporary-directory path. Production db-worker
passes inspectFile(...).path, which is native-canonical, and retains the requested
path separately. The guard correctly refuses mismatched canonical identities.
Windows RUNNER~1 and macOS /var-/private aliases expose this fixture error;
the prior local temporary parent happened already to be canonical.

The repaired fixture canonicalizes its newly owned temporary parent before
constructing case-lookup map keys. All seven cases explicitly open through a
different alias and assert snapshot.path differs from that requested spelling.
Before correcting the constructors, this forced-alias setup reproduces exactly
7 failures /4 passes locally, with the same source-change errors as CI.
Retain out/t030-fixture-alias-red.log.

The two shared constructors now pass snapshot.path and its source fingerprint,
plus the alias as requestedPath, exactly matching db-worker. They still exercise
the original aliases, six existing/absent sidecar refusals and case-sensitive
positive control. Error patterns, writer-call checks and source/sidecar byte
assertions are unchanged. No source guard, runtime file, test skip, assertion,
deadline, dependency, warning policy or workflow is relaxed or altered.

Focused53 tests /3 files pass, including all11 path cases and the real staged-
edit/hot-journal safety suites: out/t030-fixture-alias-green.log. Independent
read-only review finds no concrete defect or assertion weakening; it does not
run builds/tests. The tests model lookup semantics; no physical macOS validation
is claimed. All165 runtime, host-test and verification-script files match the
last full run byte-for-byte; no runtime/build/config changes appear against the
commit parent. Evidence: out/t030-fixture-runtime-proof.json.

## Validation and handoff

The literal `npm run verify` passes:1146 unit tests /113 files, strict host/
webview/tooling types, lint, production build and35-file VSIX package checks.
There are zero verification errors/warnings. Exit0,691.519s, from
2026-10-31T05:04:27.856Z through05:15:59.375Z; all369 before/after hashes match.
Evidence: out/t030-fixture-verify-1.log, -status.json, -before.json and -after.json.
Only PROGRESS.md and this record change afterward to record final evidence.
The test fixture and all other checked files remain frozen; final index/hash
proof binds the task-only local commit to this verified candidate.

No new full-host run is
claimed for this fixture-only change: runtime, host tests and product UI are
unchanged. The previous full result and its exact approved warning remain
historical in docs/t030-ci-repair.md. Fresh actual-candidate full verification
on Windows/macOS/Ubuntu remains the owner's CI gate; keep T-030 unchecked.

The four repair files are test/unit/staging-paths.test.ts, PROGRESS.md,
docs/t030-ci-repair.md and this document. Preserve all owner README/TASKS/shared-
spec hunks and unrelated untracked files. Only evidence records may change after
the final standalone gate. No push, tag, release or later-task implementation.
Retain the new CI run URL, exact SHA and actual platform results after pushing.
