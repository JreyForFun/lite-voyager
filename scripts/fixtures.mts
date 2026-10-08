import { createHash } from 'node:crypto';
import { copyFile, mkdir, open, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';

const fixtureRoot = fileURLToPath(new URL('../test/fixtures/', import.meta.url));
const firstId = 9007199254740993n;

export const fixtureNames = [
  'sample.sqlite', 'empty.sqlite', 'zero-byte.sqlite', 'corrupt.sqlite', 'truncated.sqlite',
  'sample.csv', 'sample.tsv', 'bom-crlf.csv', 'ragged.csv', 'duplicate-blank-headers.csv',
  'header-only.csv', 'non-utf8.csv', 'binary.csv', 'unterminated.csv', 'empty.csv', 'empty.tsv',
  'sample.json', 'sample.jsonl', 'unsupported.json', 'corrupt.json', 'truncated.jsonl',
  'empty.json', 'empty.jsonl', 'sample.xlsx', 'corrupt.xlsx', 'truncated.xlsx', 'empty.xlsx',
] as const;

export const fixtureCases = [
  { id: 'empty', kind: 'static', files: ['empty.sqlite', 'zero-byte.sqlite', 'empty.csv', 'empty.tsv', 'empty.json', 'empty.jsonl', 'empty.xlsx', 'header-only.csv'], expected: 'Valid no-table database, zero-byte inputs, header-only CSV; XLSX includes an Empty sheet.' },
  { id: 'invalid', kind: 'static', files: ['corrupt.sqlite', 'truncated.sqlite', 'corrupt.json', 'truncated.jsonl', 'unterminated.csv', 'corrupt.xlsx', 'truncated.xlsx'], expected: 'Reject malformed or incomplete inputs without modifying them.' },
  { id: 'encoding', kind: 'static', files: ['bom-crlf.csv', 'non-utf8.csv', 'binary.csv'], expected: 'UTF-8 BOM/CRLF, Windows-1252 cafe, NUL and invalid UTF-8 bytes.' },
  { id: 'large-cell', kind: 'generated', command: 'npm run fixtures -- stress', expected: '1,048,577-byte text cell in CSV, JSON, JSONL, SQLite. Excel cannot represent such a cell; announce its format limit.' },
  { id: 'wide-table', kind: 'generated', command: 'npm run fixtures -- stress', expected: '1,000 columns in CSV and SQLite.' },
  { id: 'many-rows', kind: 'generated', command: 'npm run fixtures -- large --rows 10000000', expected: '10 million rows in CSV and SQLite. XLSX has a lower format row limit.' },
  { id: 'awkward-names', kind: 'static', files: ['sample.sqlite', 'sample.csv', 'sample.json'], expected: 'Spaces, embedded double quotes, emoji, and SQL keywords.' },
  { id: 'null-empty-text', kind: 'static', files: ['sample.sqlite', 'sample.json', 'sample.jsonl', 'sample.xlsx', 'sample.csv'], expected: 'NULL, empty string, text NULL; CSV empty fields do not define a SQL NULL convention.' },
  { id: 'numeric-fidelity', kind: 'static', files: ['sample.sqlite', 'sample.csv', 'sample.json', 'sample.jsonl', 'sample.xlsx'], expected: 'Signed int64 extremes, integers beyond 2^53, REAL extremes. XLSX unsafe integers are text, never rounded numeric cells.' },
  { id: 'headers', kind: 'static', files: ['duplicate-blank-headers.csv', 'ragged.csv'], expected: 'Duplicate and blank headers, short and long records.' },
  { id: 'read-only', kind: 'runtime', setup: 'README.md#runtime-scenarios', expected: 'Copy any fixture into out; make the copy read-only; never change a committed fixture permission.' },
  { id: 'locked-file', kind: 'runtime', setup: 'README.md#runtime-scenarios', expected: 'Hold an exclusive SQLite transaction on an out copy from another process.' },
  { id: 'deleted-file', kind: 'runtime', setup: 'README.md#runtime-scenarios', expected: 'Browse an out copy, then delete it externally; run on each OS.' },
  { id: 'cancel-query', kind: 'runtime', setup: 'README.md#runtime-scenarios', expected: 'Cancel the documented recursive query when the query engine exists.' },
  { id: 'cancel-import', kind: 'runtime', setup: 'README.md#runtime-scenarios', expected: 'Cancel importing generated large.csv when import exists.' },
  { id: 'worker-crash', kind: 'runtime', setup: 'README.md#runtime-scenarios', expected: 'Terminate the database worker under a debugger when the worker feature exists.' },
] as const;

export interface SqliteFixtureJob {
  mode: 'small' | 'large' | 'stress';
  directory: string;
  rows?: number;
  payloadBytes?: number;
}

async function freshDirectory(directory: string): Promise<void> {
  await mkdir(dirname(directory), { recursive: true });
  try { await mkdir(directory); } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'EEXIST') {
      throw new Error(`Fixture output already exists: ${directory}. Choose a new directory; existing data is never replaced.`);
    }
    throw error;
  }
}

function sqliteFixtures(job: SqliteFixtureJob): Promise<void> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./fixture-sqlite-worker.mts', import.meta.url), { workerData: job });
    worker.once('error', reject);
    worker.once('exit', (code) => {
      if (code === 0) { resolve(); } else { reject(new Error(`SQLite fixture worker exited with code ${String(code)}; partial outputs remain in ${job.directory}.`)); }
    });
  });
}

async function manifest(directory: string): Promise<void> {
  const files: Record<string, { bytes: number; sha256: string }> = {};
  for (const name of fixtureNames) {
    const bytes = await readFile(join(directory, name));
    files[name] = { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  }
  await writeFile(join(directory, 'manifest.json'), `${JSON.stringify({ task: 'T-005', files, cases: fixtureCases }, null, 2)}\n`, { flag: 'wx' });
}

export async function createSmallFixtures(directory: string): Promise<void> {
  await freshDirectory(directory);
  await sqliteFixtures({ mode: 'small', directory });
  const json = '[{"id":9007199254740993,"name":"comma, value","missing":null,"nested":{"active":true},"first name":"space","quote\\\"name":"quote","😀":"emoji","select":"keyword","real":1e300},{"id":9223372036854775807,"name":"two\\nlines","missing":"","extra":"union key","real":1e-300},{"id":-9223372036854775808,"name":"emoji 😀","missing":"NULL","real":-1e300}]';
  const jsonLines = json.slice(1, -1).replaceAll('},{"id"', '}\n{"id"');
  const text: Record<string, string | Buffer> = {
    'sample.csv': 'id,name,value,real,"first name","quote""name",😀,select\n9007199254740993,"comma, value",,1e300,space,quote,emoji,keyword\n9223372036854775807,"two\nlines",NULL,1e-300,,,,\n-9223372036854775808,"emoji 😀","",-1e300,,,,\n',
    'sample.tsv': 'id\tname\tvalue\n9007199254740993\tspace name\tNULL\n9223372036854775807\temoji 😀\t\n',
    'bom-crlf.csv': '\ufeffid,name\r\n1,"comma, value"\r\n2,"two\r\nlines"\r\n3,"a ""quote"""\r\n',
    'ragged.csv': 'a,b,c\n1,2\n3,4,5,6\n',
    'duplicate-blank-headers.csv': 'id,id,,select\n1,2,3,4\n',
    'header-only.csv': 'id,name\n',
    'non-utf8.csv': Buffer.from('id,name\n1,caf\xe9\n', 'latin1'),
    'binary.csv': Buffer.from([0x69, 0x64, 0x2c, 0x76, 0x0a, 0x31, 0x2c, 0x00, 0xff, 0x0a]),
    'unterminated.csv': 'id,name\n1,"unfinished',
    'sample.json': `${json}\n`, 'sample.jsonl': `${jsonLines}\n`,
    'unsupported.json': '42\n', 'corrupt.json': '{"unfinished":',
    'truncated.jsonl': '{"id":1}\n{"id":',
    'corrupt.xlsx': 'This is not an XLSX ZIP file.\n',
  };
  for (const [name, contents] of Object.entries(text)) {
    await writeFile(join(directory, name), contents, { flag: 'wx' });
  }
  for (const name of ['zero-byte.sqlite', 'empty.csv', 'empty.tsv', 'empty.json', 'empty.jsonl', 'empty.xlsx']) {
    await writeFile(join(directory, name), '', { flag: 'wx' });
  }
  // Curated XLSX was authored and independently checked; regeneration copies it.
  await copyFile(join(fixtureRoot, 'sample.xlsx'), join(directory, 'sample.xlsx'));
  const xlsx = await readFile(join(directory, 'sample.xlsx'));
  await writeFile(join(directory, 'truncated.xlsx'), xlsx.subarray(0, 64), { flag: 'wx' });
  await manifest(directory);
}

export interface LargeFixtureOptions {
  rows: number;
  payloadBytes: number;
  csvBytes?: number;
}

export function positiveInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive safe integer.`);
  }
}

async function largeCsv(path: string, options: LargeFixtureOptions): Promise<{ rows: number; bytes: number }> {
  const handle = await open(path, 'wx');
  const header = 'id,name,payload\n';
  let bytes = Buffer.byteLength(header);
  let rows = 0;
  let chunk = '';
  const payload = 'x'.repeat(options.payloadBytes);
  try {
    await handle.writeFile(header);
    while (rows < options.rows || bytes < (options.csvBytes ?? 0)) {
      if (rows >= Number.MAX_SAFE_INTEGER) { throw new Error('Generated row count exceeds the safe counter range.'); }
      const line = `${String(firstId + BigInt(rows))},row ${String(rows)},${payload}\n`;
      chunk += line;
      bytes += Buffer.byteLength(line);
      rows += 1;
      if (chunk.length >= 65_536) { await handle.writeFile(chunk); chunk = ''; }
    }
    if (chunk !== '') { await handle.writeFile(chunk); }
  } finally { await handle.close(); }
  return { rows, bytes };
}

export async function generateLargeFixtures(directory: string, options: LargeFixtureOptions): Promise<{ rows: number; csvBytes: number; sqliteBytes: number }> {
  positiveInteger(options.rows, 'rows');
  positiveInteger(options.payloadBytes, 'payloadBytes');
  if (options.csvBytes !== undefined) { positiveInteger(options.csvBytes, 'csvBytes'); }
  await freshDirectory(directory);
  const csv = await largeCsv(join(directory, 'large.csv'), options);
  await sqliteFixtures({ mode: 'large', directory, rows: csv.rows, payloadBytes: options.payloadBytes });
  const result = { rows: csv.rows, csvBytes: csv.bytes, sqliteBytes: (await stat(join(directory, 'large.sqlite'))).size };
  await writeFile(join(directory, 'generation.json'), `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
  return result;
}

export async function generateStressFixtures(directory: string): Promise<void> {
  await freshDirectory(directory);
  const value = 'x'.repeat(1_048_577);
  await writeFile(join(directory, 'large-cell.csv'), `value\n${value}\n`, { flag: 'wx' });
  const json = JSON.stringify({ value });
  await writeFile(join(directory, 'large-cell.json'), `[${json}]\n`, { flag: 'wx' });
  await writeFile(join(directory, 'large-cell.jsonl'), `${json}\n`, { flag: 'wx' });
  const names = Array.from({ length: 1000 }, (_, index) => `column_${String(index)}`);
  await writeFile(join(directory, 'wide.csv'), `${names.join(',')}\n${names.map((_, index) => String(index)).join(',')}\n`, { flag: 'wx' });
  await sqliteFixtures({ mode: 'stress', directory });
}
