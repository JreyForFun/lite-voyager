# T-005 test fixtures

These are synthetic inputs, not examples of implemented extension behavior.
`manifest.json` inventories all 27 small assets with byte counts and SHA-256
hashes, and maps every category in `specs/VALIDATION.md` section 5 to static
files, generated data, or a runtime setup. Tests check the assets and hashes.
`.gitattributes` preserves their intentional bytes on every Git checkout.

## Small inputs

- `sample.sqlite`: BLOB `0001FF`; table `no_primary_key`; composite primary key
  in the `WITHOUT ROWID` table `composite`; view and index; column default and
  NOT NULL metadata; int64 extrema; REAL extremes; NULL/empty/text NULL; names
  with spaces, quotes, emoji and SQL keywords. `empty.sqlite` is a valid
  database without tables; `zero-byte.sqlite` is a different input.
- `sample.csv`, `sample.tsv`: exact large-integer decimal text and special
  values. `bom-crlf.csv` has a UTF-8 BOM, CRLF, quoted commas, multiline fields,
  and escaped quotes. Other CSVs cover header-only, ragged records, duplicate
  and blank headers, unterminated quotes, Windows-1252, and binary bytes.
- `sample.json`, `sample.jsonl`: heterogeneous keys, nested objects, NULL,
  empty strings, text NULL, unsafe integer tokens, REAL extremes, and awkward
  keys. Read raw numeric tokens before coercing to JavaScript Number; a plain
  JSON.parse cannot preserve these unsafe numeric integers. `unsupported.json`
  is a scalar. Malformed/truncated files are intentionally invalid.
- `sample.xlsx`: `Data`, `Totals`, and `Empty` sheets. Large integers are text
  cells; `Totals!B2` contains `SUM(Data!D2:D4)` with a cached value of 6.25.
  Blank XLSX cells do not imply a universal SQL NULL/empty-string convention.
  This curated asset was authored with the external artifact tool, inspected,
  and independently checked using openpyxl. Project commands copy it and do
  not require those authoring tools. The renderer formats numeric-looking
  strings scientifically; independent ZIP/XML checks verify exact text storage.
- `empty.*`, `corrupt.*`, and `truncated.*`: format-appropriate empty or bad
  inputs. An empty JSON file is intentionally not valid JSON.

## Generate datasets

Use Node 25.7+; Node 26.5.0 was tested. Earlier Node versions emit experimental
SQLite warnings and cannot satisfy the zero-warning verification gate.
No project dependency was added for fixture generation.

```sh
npm run fixtures -- small
npm run fixtures -- stress
npm run fixtures -- large --rows 10000000
npm run fixtures -- large --rows 1 --csv-bytes 1073741824
```

Every run defaults to a unique directory under `test/fixtures/generated/`,
which Git ignores. `--output <new-directory>` selects another destination;
existing directories and files are always refused, including an empty directory.
Small regeneration copies the committed curated XLSX and regenerates the other
assets plus a new manifest. SQLite bytes/hashes may differ across SQLite versions.
Generated manifests describe that run, not a promise of identical SQLite bytes.

The large profile defaults to 10 million rows and 96 ASCII payload bytes per
row. `--rows`, `--payload-bytes`, and optional `--csv-bytes` must be positive
safe integers. The CSV contains at least the requested rows AND bytes; the
last complete record may exceed the byte target. SQLite contains the same
rows and exact BigInt IDs, starting at 9007199254740993. `generation.json`
records row count and actual CSV/database sizes. Timing describes generation,
not extension import performance or T-004 benchmark results.
For a local run, paste the JSON row/byte report and the completion line containing
the output directory and elapsed milliseconds. If it fails, paste stderr and
the command used; do not upload or commit the large datasets.

CSV writes are batched with backpressure; SQLite inserts run in a worker with
1,000-row transactions. Memory is proportional to one record and the fixed
write batch, not the number of rows. Disk usage grows with the dataset. If a
run fails or is interrupted, partial outputs may remain in its new directory;
no completion report is emitted. Choose a new destination for the next run.

The stress profile creates `large-cell.csv`, `.json`, `.jsonl` and
`stress.sqlite` with a 1,048,577-byte ASCII cell; `wide.csv` and the SQLite
`wide` table have 1,000 columns. Ten-million-row datasets and greater-than-1-MB
cells are not valid Excel worksheets/cells: Excel permits 1,048,576 rows and
32,767 characters per cell. These limits must be explained by the future XLSX
loader, not silently truncated. See [Microsoft's Excel limits](https://support.microsoft.com/en-us/excel/excel-specifications-and-limits).

## T-004 streaming import benchmark

Install locked development dependencies with `npm ci`, then run `npm run verify`.
The spike uses `papaparse` 5.7.0 and `@types/papaparse` 5.5.2 (both MIT), as
development-only dependencies. No parser code is added to the extension bundle.
DOM types in the tooling tsconfig satisfy the parser declarations' browser
options; the spike uses only local Node streams.

Reuse the existing T-005 10-million-row dataset if it is available:

```sh
npm run spike:csv -- --input test/fixtures/generated/t005-10m-validation/large.csv
```

Otherwise, generate a fresh dataset of at least 1 GB (decimal bytes):

```sh
npm run fixtures -- large --rows 1 --csv-bytes 1000000000 --output test/fixtures/generated/t004-input-1gb
npm run spike:csv -- --input test/fixtures/generated/t004-input-1gb/large.csv
```

Generation also creates a reference SQLite file; allow disk space for the CSV,
the reference database and the imported database (roughly 3-4 GB for this
profile, plus free headroom). Choose a new generation directory on each run.
Run the benchmark after verification finishes, with other heavy jobs idle.
The import command defaults to a unique ignored output directory. Optional
`--output FRESH_DIRECTORY`, `--batch-rows 1000` and `--chunk-bytes 65536` control
the destination and bounded processing settings. Existing destinations are
refused. Ctrl+C cancels, waits for worker exit and removes partial database files.
Unknown files in the reserved directory are never recursively deleted.

Paste the full final JSON report and generation report, or the first failure
message. `report.json` is retained beside `import.sqlite` on success. The report
contains import/verification/total elapsed milliseconds, up to 100 parsed-row
preview latency, source and stored-value SHA-256 checks, verified row count,
transaction count, file sizes, runtime/platform/SQLite version and peak RSS.
Import timing includes streamed source hashing and inserted-value hashing;
the separate verification phase rehashes the source, reads every stored row
in order and runs SQLite integrity checking. Source hashes compare the bytes
read during import with a second read afterward, with size/mtime checks too.
No field contents or preview values are printed.

RSS includes the whole standalone process and its worker, native SQLite and
verification. The reported peak is the greater of Node's OS lifetime maximum
RSS (KiB converted to bytes) and samples every 10 ms. The sampler alone can
miss brief peaks. Tests invoking the API inside Vitest include that harness in
RSS; use the fresh CLI process for performance evidence. Parsed preview time
includes reading/parsing/inserts and excludes worker startup; it is not visible
first paint. A 1 GB run establishes neither the 5 GB extension-memory target
nor the under-two-second visible-UI target. Those NFR targets remain open.

This spike accepts comma-delimited UTF-8 CSV with a required nonblank, unique
header and consistent LF or CRLF record endings. BOM, quoted commas, multiline
fields, escaped quotes and large/wide records are supported. Every value is
stored as TEXT: unsafe integers, REAL spellings, empty strings and `NULL` text
remain exact. CSV does not define a SQL NULL convention. Blank records, ragged
rows, duplicate/blank headers, malformed quotes, invalid UTF-8/NUL bytes and
mixed or bare-CR endings are rejected clearly. Delimiter/encoding selection,
type inference, UI preview and production temp-storage management belong to
later tasks. Memory is bounded relative to row count, but necessarily depends
on the largest record/header; there is no arbitrary file-size cap.
The SQLite table also has a generated INTEGER PRIMARY KEY for original row
order, named by `rowOrderColumn` in the report. Its name is chosen to avoid
collisions with CSV headers, including the three SQLite rowid aliases. This
metadata key is excluded from the parsed/stored CSV-value digest.

Optional later 5 GB evidence needs substantially more disk space (roughly
15-20 GB including all three files, plus headroom):

```sh
npm run fixtures -- large --rows 1 --csv-bytes 5000000000 --output test/fixtures/generated/t004-input-5gb
npm run spike:csv -- --input test/fixtures/generated/t004-input-5gb/large.csv
```

This remains a standalone test; extension memory and visible first paint must
be measured when the production importer and webview exist.

## Runtime scenarios

Run from the repository root. Use disposable copies under `out`, not committed
fixtures. The setups are supplied now; extension behavior assertions belong
to the later tasks that implement browsing, imports, cancellation, and recovery.

### Read-only

Create a new copy, then make only that copy read-only (PowerShell):

```powershell
node -e "const fs=require('node:fs'); fs.mkdirSync('out',{recursive:true}); fs.copyFileSync('test/fixtures/sample.sqlite','out/scenario-read-only.sqlite',fs.constants.COPYFILE_EXCL)"
(Get-Item -LiteralPath out/scenario-read-only.sqlite).IsReadOnly = $true
```

On macOS/Linux, use `chmod 444 out/scenario-read-only.sqlite` after the copy.
Run as an ordinary user. Later FR-016/FR-020 tests must confirm browsing works
and saving a prohibited write produces a clear error without modifying bytes.

### Locked file

Create a separate copy and keep an exclusive transaction open in a second terminal:

```sh
node -e "const fs=require('node:fs'); fs.mkdirSync('out',{recursive:true}); fs.copyFileSync('test/fixtures/sample.sqlite','out/scenario-lock.sqlite',fs.constants.COPYFILE_EXCL)"
node --input-type=module -e "import { DatabaseSync } from 'node:sqlite'; const db=new DatabaseSync('out/scenario-lock.sqlite'); db.exec('BEGIN EXCLUSIVE'); console.log('Exclusive transaction held; press Ctrl+C to release.'); setInterval(()=>{},1000);"
```

Try opening/querying the copy when the engine exists. It must report the busy
condition clearly. Ctrl+C releases the lock. File-sharing behavior must also
be checked on each platform; an SQLite lock does not simulate every OS lock.

### Deleted file

Create another copy with COPYFILE_EXCL, replacing the destination name in the
copy command with `out/scenario-delete.sqlite`. Browse it, then in PowerShell:

```powershell
Remove-Item -LiteralPath out/scenario-delete.sqlite
```

On macOS/Linux use `rm out/scenario-delete.sqlite`. If Windows prevents deletion
while open, record that outcome and test deletion after closing the handle.
Later file-access tests must handle missing paths without silently modifying data.

### Cancel query

With `sample.sqlite` open once queries are implemented, run and cancel:

```sql
WITH RECURSIVE numbers(n) AS (
  VALUES(1) UNION ALL SELECT n + 1 FROM numbers WHERE n < 1000000000
) SELECT sum(n) FROM numbers;
```

FR-015/NFR-005 must verify cancellation, responsive UI, and a working next query.

### Cancel import

Generate `large.csv` with the large profile. Open it once import exists, cancel
partway through, then inspect temporary storage and confirm source bytes did
not change. FR-004/FR-007 tests must verify recovery and cleanup.

### Worker crash

Once T-002/the database worker exists, attach the debugger, select the database
worker thread, pause it, and evaluate `process.exit(1)` in that worker's context.
Do not evaluate it in the extension host's main thread. The worker's exit should
produce a clear message and permit reopening/retry; later recovery tests must
exercise this automatically using the real worker handle.
