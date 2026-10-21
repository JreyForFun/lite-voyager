# T-026 actual-host visual QA (2026-10-21)

Owner reauthorizes full local validation, necessary repairs/fixtures and delegated
visual QA, retaining push and remote CI. This supersedes the earlier instruction
against further full runs. Preserve both historical full failures and all guards.

## Capture method and scope

The Windows Computer Use helper fails target binding for the new disposable host,
then fails once more after fresh window selection, with the exact error:
`window id 919680 no longer belongs to Microsoft.VisualStudioCode; current owner is Microsoft.VisualStudioCode`.
No further native-helper input is attempted. The original user window is untouched.

Fallback captures the actual VS Code 1.140.0 workbench renderer over its own
loopback-only Chromium debugger endpoint. This is the running extension's real
webview and SQLite backend, not the earlier synthetic component shell. The
disposable test profile is out/integration-profile-t026-native-l02L1p; source data
is a copied sample.sqlite in out/t026-native-qa. Existing integration controls
exercise the actual CodeMirror keymap, SQL editor and engine. Captures show the
whole workbench client. Windows.Graphics.Capture/physical display paint remains
unobserved; no OS-level key injection or scrolling-smoothness claim is made.

## Observations

Inspected initial-dark.png, tables-dark.png, tables-light.png,
quoted-columns-light.png and quoted-columns-dark.png in out/t026-native-qa:

- Both themes show a readable, positioned completion popup, visible caret,
  selected-row contrast, table/view/column detail and unobscured help text.
- Actual metadata offers record_labels and records. ArrowDown selects records;
  Enter inserts its quoted identifier. Run returns the real copied table's row
  and the BLOB placeholder, preserving the prior browse surface during metadata.
- In `SELECT s."quo" FROM "select" AS s`, the real column `quote"name` is offered
  with its table detail. Enter inserts escaped `"quote""name"`; SQL length changes
  from 33 to 41 and Run returns the exact value `quoted` in one column.
- Undo restores length 33. Ctrl-Space reopens that column offer and Escape
  dismisses it. Native narrow/100-match behavior is not newly claimed; the prior
  six component captures and budget/notice regressions remain separate evidence.

Actions and bounded real-host status are retained in trace.json. The controller
closes all editors, checks the copied source hash, and exits zero; launcher exits
zero after releasing its native awake request. Source SHA-256 before/after is
`b8ee3eb4f6b3a5310ca094750f82987496faf48f24c0b0187a6d6d8b02850b14`.
The visual host is closed before canonical validation to avoid memory contention.

## Diagnostics (this is not a clean canonical gate)

The renderer-only strict scan reports one approved record:

- VSCODE-HOST-001, severity warning,
  20261021T224935/window1/renderer.log:7, exact message:
  `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.

The visual launch console also contains unapproved tooling diagnostics:

- `Warning: 'remote-debugging-port' is not in the list of known options, but still passed to Electron/Chromium.`
- `Warning: 'remote-debugging-address' is not in the list of known options, but still passed to Electron/Chromium.`
- `[DEP0169] DeprecationWarning: url.parse()` warning; the full original message
  remains in host.log. No cause attribution or warning exception is introduced.

This host is not warning-free and is not used as a passing verify/full gate.
Canonical verification uses the unchanged standard launcher without debugger
switches. These scoped visual observations do not erase any failed validation.

Evidence: out/t026-native-qa/{launch.json,host.log,diagnostics.log,trace.json,
source-safety.json,*.png}; controller/launcher/capture helpers remain ignored.

## Post-review repair recheck

After ASCII-only identifier folding and quoted keyword/punctuation fixes, a new
actual host loads the rebuilt bundle in disposable profile
out/integration-profile-t026-native-unicode-VUPPKN. The copied source has two
tables with different columns, aliased Ä and ä in the same query. At
`SELECT "Ä"."quo" FROM "select" AS "Ä" JOIN composite AS "ä" ON 1`, completion
offers the actual quote"name column from select, not composite. Enter inserts
its escaped name; Run returns exact value quoted. The SQL length changes 64 to
72. Inspected unicode-columns-dark.png and unicode-columns-light.png show readable
positioning and contrast with the distinct Unicode aliases visible.

Evidence is in out/t026-native-unicode-qa. Source hash before/after again matches
b8ee3eb4f6b3a5310ca094750f82987496faf48f24c0b0187a6d6d8b02850b14.
Controller and awake-protected launcher exit zero and are closed before the gate.
The same two debugger-option console warnings and DEP0169 deprecation remain;
this is not a warning-free/canonical run. Its sole approved runtime warning is
VSCODE-HOST-001, exact CloudSandboxApi message above, at
20261021T230754/window1/renderer.log:7. No warning
exception or production launcher change is made.
