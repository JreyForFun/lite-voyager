# T-050 dependency and license review

Assessed on 2026-10-09. The owner delegated review decisions and routine fixes to
the assistant in this session; the owner handles pushing. D-4 in PLAN.md defines
the acceptance criteria. This report concerns the current dependency tree, not a
release or the foundation milestone gate.

## Decision

Retain the current dependencies and overrides. No known vulnerability was
reported, and no dependency change or fixture correction is needed. Resolve the
missing memorystream license as MIT using its shipped license. Retain VSCE signing
packages only as development tooling for this VS Code extension, under their
Microsoft-specific terms; exclude them from the VSIX. Choose JSZip's MIT option.
Keep the MPL-2.0 Lightning CSS tooling out of the distributed extension.

For future XLSX work, use SheetJS Community Edition from its official CDN,
preferably as an integrity-checked, committed vendor tarball. Recheck the current
version and advisories when implementing that task. No XLSX dependency is added
by T-050. SheetJS CE's Apache-2.0 attribution and notice requirements must be
included when it is distributed.

## Inventory and scope

[dependency-licenses.json](dependency-licenses.json) lists **576 non-root locked
package paths**, with exact name, version, declared and resolved license,
direct/development/optional/peer flags, and evidence sources. All 21 direct
dependencies and the entire transitive tree are included, including optional
packages for other operating systems. There were 507 installed package manifests
on this Windows machine; their versions and populated license fields matched
the lockfile. This is not an installation test of the other platforms.

The evidence fingerprint is SHA-256 of UTF-8
`JSON.stringify(JSON.parse(package-lock.json))`, so whitespace and checkout line
endings do not invalidate it:

`65c6a5a55c72e953c236cdd9a154d3dfe1084e979935be41c25c54d525605890`

Resolved license counts, counting paths rather than distinct package names:

- MIT: 459; ISC: 36; Apache-2.0: 19.
- BSD-2-Clause: 10; BSD-3-Clause: 10; BlueOak-1.0.0: 9; 0BSD: 1.
- MPL-2.0: 12; Artistic-2.0: 5; Python-2.0: 1.
- Microsoft VSCE-Sign terms: 10.
- `(MIT OR GPL-3.0-or-later)`: 1; `(MIT AND Zlib)`: 1.
- CC-BY-3.0: 1; CC0-1.0: 1.

Direct dependencies, using their locked versions:

- `sql.js` 1.14.2: MIT, runtime.
- `@codemirror/commands` 6.11.1, `@codemirror/lang-sql` 6.10.0,
  `@codemirror/language` 6.13.1, `@codemirror/state` 6.7.6,
  `@codemirror/view` 6.43.14, `@lezer/highlight` 1.2.5: MIT, development.
- `@types/mocha` 10.0.10, `@types/node` 24.19.1,
  `@types/papaparse` 5.5.2, `@types/vscode` 1.140.0: MIT, development.
- `@vscode/test-cli` 0.0.15, `@vscode/test-electron` 3.1.0,
  `@vscode/vsce` 4.0.0: MIT, development. VSCE's signing dependencies have
  separate Microsoft terms.
- `esbuild` 0.28.2, `eslint` 10.12.0, `npm-run-all` 4.1.5,
  `papaparse` 5.7.0, `typescript-eslint` 8.71.1, `vitest` 5.0.3: MIT, development.
- `typescript` 6.0.3: Apache-2.0, development.

CodeMirror's development classification does not exclude it from the extension:
it is bundled for the webview and is covered by the full audit and notices below.
An audit that omits development dependencies would miss that code.

## License exceptions and evidence

Standard license declarations come from exact locked package metadata. Standard
off-platform tarball license texts were not individually downloaded. The following
special cases were inspected rather than inferred from package-manager labels:

- `memorystream` 0.3.1, brought in by `npm-run-all`, has no lockfile license field.
  Its installed `LICENSE` is MIT, consistent with its legacy `licenses` array and
  [upstream license](https://github.com/JSBizon/node-memorystream/blob/master/LICENSE).
  The inventory preserves the missing declaration and records the resolved license,
  source and SHA-256; the lockfile is not hand-edited.
- `@vscode/vsce-sign` 2.1.0 and nine platform packages at 2.0.6 declare
  `SEE LICENSE IN LICENSE.txt`. All ten exact registry tarballs were downloaded,
  checked against their lockfile integrity, and read without extraction or
  executing package code. Each contains identical Microsoft VSCE-Sign terms,
  with license SHA-256
  `80780388a077c74609a5fc7ee1cc3d382740a5e48d87f7aac5a20cbddef3e91c`.
  Installation/use is limited to the listed Microsoft development products;
  sharing and redistribution are restricted. Our decision retains them for
  development of this VS Code extension and excludes them from the shipped
  extension. `LicenseRef-Microsoft-VSCE-Sign` is this inventory's label for those
  terms, not a claim that they are open source. Sources are each locked registry
  tarball's `package/LICENSE.txt`, recorded in the inventory.
- `jszip` 3.10.2 explicitly permits choosing MIT or GPL; choose MIT. Its transitive
  `pako` 1.0.11 declares MIT AND Zlib, which remains recorded as both licenses.
  Both are integration-download tooling, not extension code.
- `lightningcss` 1.33.0 and eleven platform packages use MPL-2.0 via Vite/Vitest.
  They are development-only. If redistributed in future, review the file-level
  source/notice requirements described by [Mozilla](https://www.mozilla.org/en-US/MPL/2.0/FAQ/).
- Other less common development licenses remain explicit: Artistic-2.0 in five
  Bevry packages, Python-2.0 in argparse, CC-BY-3.0 in spdx-exceptions, and
  CC0-1.0 in spdx-license-ids. No unknown license remains in this inventory.

## Audit evidence

[dependency-audit.json](dependency-audit.json) preserves the complete result of
`npm audit --json`, exit **0**, against `https://registry.npmjs.org/` on
2026-10-09, with Node v26.5.0 and npm 12.2.0 on Windows x64. Both observed runs
reported **zero known vulnerabilities at every severity**. npm's own dependency
counts are preserved verbatim rather than treated as disjoint license categories.

Audit is a registry advisory check, not proof that dependencies contain no defects
or that future versions remain safe. It does not establish runtime network/privacy
behavior or cover a future vendored SheetJS release. Development-time audit and
source lookups do not add network calls to the extension. See the
[npm audit documentation](https://docs.npmjs.com/cli/npm-audit/).

## SheetJS installation and advisory check

The [official NodeJS installation page](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/)
currently identifies CDN version **0.20.3** and npm registry version **0.18.5** as
outdated. It recommends vendoring for stability. For the future XLSX task, download
the official tarball, verify its contents/integrity, and install the committed
tarball with `npm install --save file:vendor/xlsx-0.20.3.tgz`, after rechecking the
then-current release. This command has not been run in T-050.

The [official advisory index](https://cdn.sheetjs.com/advisories/) lists:

- [CVE-2023-30533](https://cdn.sheetjs.com/advisories/CVE-2023-30533): prototype
  pollution when reading crafted files; fixed in 0.19.3.
- [CVE-2024-22363](https://cdn.sheetjs.com/advisories/CVE-2024-22363): regular
  expression denial of service; fixed in 0.20.2.

Inference from those affected-version ranges: 0.20.3 is beyond both fixes; npm's
0.18.5 is affected by both. This is not a guarantee against other vulnerabilities.
The [official CE license page](https://docs.sheetjs.com/docs/miscellany/license/)
specifies Apache-2.0, required attribution, preservation of copyright/license
notices and documentation of source modifications. Pro has separate terms.

## Distribution and validation

Esbuild input metadata finds fourteen embedded editor packages, all MIT. The host
and helper/worker bundles embed no npm package; sql.js's loader and WASM are copied
separately. `shippedPackages` in the inventory records all fifteen package names
and their notice paths. Existing `dist/codemirror-LICENSES.txt` contains the full
fourteen editor licenses, and `dist/sql.js-LICENSE` contains sql.js's license.
The VSIX allowlist includes both notices and excludes `node_modules`.

Three Given/When/Then tests in `test/unit/dependency-audit.test.ts` failed before
the inventory existed, then passed. They cover exact inventory completeness and
scope, the missing/custom license resolutions, and the production dependency
graph with complete notices and packaging allowlist. The production build runs
inside the notice test; the normal verification gate also packages a VSIX.
External registry/advisory findings are dated command/source evidence, not
simulated by unit tests.

`npm run verify` passes with **179 unit tests**, strict host/webview/tooling types,
lint, production builds and VSIX packaging, with **zero errors and warnings**.
The package file listing includes both complete third-party notice artifacts and
no development tools. No new integration/full-gate or three-platform CI evidence
is claimed for T-050; the existing foundation gate remains open.

Recheck with:

```powershell
npm audit --json
npm test -- test/unit/dependency-audit.test.ts
npm run verify
```

Dependency changes require refreshing the inventory and audit fingerprint/result;
the completeness test intentionally rejects stale evidence. No new dependency,
source-feature change or fixture edit was necessary.
