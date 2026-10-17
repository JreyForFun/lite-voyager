import { realpath, stat } from 'node:fs/promises';

export interface XlsxSnapshot { path: string; dev: string; ino: string; size: string; mtimeNs: string; ctimeNs: string; }
export const XLSX_WARNING_BYTES = 100_000_000n;
export async function xlsxSnapshot(path: string): Promise<XlsxSnapshot> {
  const canonical = await realpath(path); const metadata = await stat(canonical, { bigint: true });
  if (!metadata.isFile()) { throw new Error('Choose a saved regular XLSX file.'); }
  return { path: canonical, dev: String(metadata.dev), ino: String(metadata.ino), size: String(metadata.size), mtimeNs: String(metadata.mtimeNs), ctimeNs: String(metadata.ctimeNs) };
}
export function sameXlsxSnapshot(a: XlsxSnapshot, b: XlsxSnapshot): boolean {
  // Both readers use native realpath. Normalize URI drive-letter spelling only;
  // preserve canonical component casing and every identity/timestamp check,
  // including on case-sensitive Windows directories.
  const spelling = (path: string): string => process.platform === 'win32' ? path.replace(/^[A-Z]:/iu, (drive) => drive.toLowerCase()) : path;
  return spelling(a.path) === spelling(b.path) && a.dev === b.dev && a.ino === b.ino && a.size === b.size && a.mtimeNs === b.mtimeNs && a.ctimeNs === b.ctimeNs;
}
export type XlsxApproval = (bytes: string) => Promise<boolean>;
export class XlsxReadConsent {
  private approved: XlsxSnapshot | undefined;
  constructor(private readonly ask: XlsxApproval = () => Promise.resolve(false)) {}
  async approve(path: string, signal?: AbortSignal): Promise<XlsxSnapshot> {
    if (signal?.aborted === true) { throw new Error('XLSX read cancelled. Reopen to retry.'); }
    const snapshot = await xlsxSnapshot(path);
    if (BigInt(snapshot.size) > XLSX_WARNING_BYTES && (this.approved === undefined || !sameXlsxSnapshot(snapshot, this.approved))) {
      let abort: () => void = () => {};
      const decision = await new Promise<boolean>((accept, reject) => {
        abort = () => { reject(new Error('XLSX read cancelled. Reopen to retry.')); };
        signal?.addEventListener('abort', abort, { once: true });
        void this.ask(snapshot.size).then(accept, reject);
        if (signal?.aborted === true) { abort(); }
      }).finally(() => { signal?.removeEventListener('abort', abort); });
      if (!decision) { throw new Error('XLSX memory warning declined. Nothing was loaded; retry preview to choose again.'); }
      if (!sameXlsxSnapshot(snapshot, await xlsxSnapshot(path))) { throw new Error('The XLSX source changed during consent. Retry preview for the current file.'); }
    }
    // Read after awaits: late consent cannot revive a disposed/cancelled session.
    if (signal?.aborted) { throw new Error('XLSX read cancelled. Reopen to retry.'); }
    this.approved = snapshot; return snapshot;
  }
}
