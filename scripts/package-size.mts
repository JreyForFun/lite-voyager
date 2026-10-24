/** NFR-008 uses decimal MB and a strict upper bound. */
export function assertPackageSize(bytes: number): void {
  if (!Number.isSafeInteger(bytes) || bytes <= 0 || bytes >= 10_000_000) {
    throw new Error(`VSIX must be nonempty and under 10,000,000 bytes; received ${String(bytes)} bytes.`);
  }
}
