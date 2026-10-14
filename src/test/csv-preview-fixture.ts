import { execFile } from 'node:child_process';
import { open, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';

/** Disposable host-test data only; never called by the extension. */
export async function createSparseCsv(path: string, contents: string, bytes: number): Promise<void> {
  await writeFile(path, contents, { flag: 'wx' });
  if (process.platform === 'win32') {
    // NTFS otherwise allocates the zero-filled extension on truncate. This
    // built-in tool is used only for disposable tests and is never shipped.
    const output = await promisify(execFile)('fsutil.exe', ['sparse', 'setflag', path], { windowsHide: true });
    if (output.stderr !== '') { throw new Error(`Unable to mark the CSV fixture sparse: ${output.stderr}`); }
  }
  const file = await open(path, 'r+');
  try { await file.truncate(bytes); } finally { await file.close(); }
}
