# Lite Voyager

A VS Code extension in development for browsing SQLite, CSV, JSON, and XLSX
files and querying them with SQL in an editor tab.

## Current status

This is the foundation scaffold. It provides the **Hello World** command;
data browsing and querying are planned and are not implemented yet.
See [PROGRESS.md](PROGRESS.md) and [specs/TASKS.md](specs/TASKS.md).

## Development

Use Node.js 25.7 or newer for the development tools and SQLite fixture tests,
then run (Node 26.5.0 was tested):

```sh
npm ci
npm run verify
npm run verify:full
```

`verify` checks strict TypeScript for the host, webview, and tooling, runs lint
and unit tests, builds both bundles, and creates then removes a local VSIX as
a packaging check. Any failed command or warning fails verification.

`verify:full` adds the integration tests in an isolated VS Code instance and
checks its structured runtime logs for warnings and errors.
The test runner downloads VS Code when it is not already cached. Development
tool downloads are separate from the extension, which makes no network calls.

Press **F5** to build and open an Extension Development Host. Run **Hello World**
from its Command Palette. The expected message is **Hello World from Lite Voyager!**

Useful individual checks:

```sh
npm run check-types
npm run lint
npm test
npm run test:integration
npm run package
```

`npm run package` performs a local packaging check; it does not publish.
The manifest's VS Code minimum is provisional until compatibility spike T-002.

## Continuous integration

[CI](.github/workflows/ci.yml) runs on every push and pull request, with a manual
run option. Each Windows, macOS, and Linux job installs the lockfile with `npm ci`
using Node 26.5.0 and runs `npm run verify:full`. Linux uses `xvfb-run -a` for the
VS Code window. All three jobs report results even if one fails; errors and
warnings fail the existing verification gate. CI does not generate the large
10-million-row datasets.

After pushing the T-007 commit, open the repository's **Actions** tab and select
**CI** for that commit. Paste the run URL, commit SHA, and the conclusion for all
three **Full verification** jobs. For a failed job, paste its failing step's log
including the first error or warning. Local workflow tests check its wiring;
T-007 stays open until the actual three-platform run is green.

## Test fixtures

Small SQLite, CSV/TSV, JSON/JSONL, and XLSX inputs are committed in
[test/fixtures](test/fixtures/README.md), including malformed and empty cases.
The inventory records exact bytes/hashes and runtime scenario instructions.

```sh
npm run fixtures -- small
npm run fixtures -- stress
npm run fixtures -- large --rows 10000000
```

The generator writes a new directory under the git-ignored
`test/fixtures/generated/`. It refuses existing destinations. The large profile
creates CSV and SQLite with matching rows; `--csv-bytes` requests a minimum CSV
size and `--payload-bytes` changes record width. See the fixture guide for all
options, format limits, and what to paste back from a local generation run.

## Credits and license

The query-a-file-with-SQL idea is inspired by
[nao1215/filesql](https://github.com/nao1215/filesql). Lite Voyager is an
independent TypeScript implementation and shares no code with it.

Licensed under the [MIT License](LICENSE).
