import { mkdtemp, rm, truncate, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, vi } from 'vitest';
import { XlsxReadConsent } from '../../src/loaders/xlsx-consent';

test('FR-006: Given the exact XLSX warning boundary and a changed source, When requesting read consent, Then only explicit approval authorizes that snapshot', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lv-xlsx-consent-')); const path = join(directory, 'large.xlsx');
  try {
    await writeFile(path, ''); await truncate(path, 100_000_000); const ask = vi.fn<() => Promise<boolean>>().mockResolvedValue(false); const consent = new XlsxReadConsent(ask); const signal = new AbortController().signal;
    await consent.approve(path, signal); expect(ask).not.toHaveBeenCalled(); await truncate(path, 100_000_001);
    await expect(consent.approve(path, signal)).rejects.toThrow(/declin|cancel/i); expect(ask).toHaveBeenCalledTimes(1);
    ask.mockResolvedValue(true); await consent.approve(path, signal); await consent.approve(path, signal); expect(ask).toHaveBeenCalledTimes(2);
    await truncate(path, 100_000_002); await consent.approve(path, signal); expect(ask).toHaveBeenCalledTimes(3);
    const abort = new AbortController(); ask.mockImplementation(() => { abort.abort(); return Promise.resolve(true); }); await truncate(path, 100_000_003);
    await expect(consent.approve(path, abort.signal)).rejects.toThrow(/cancel/i);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('FR-006: Given a pending memory dialog, When the session cancels, Then read consent settles immediately and late approval cannot authorize a future read', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lv-xlsx-pending-')); const path = join(directory, 'large.xlsx');
  try {
    await writeFile(path, ''); await truncate(path, 100_000_001); let answer: (value: boolean) => void = () => {}; let shown: () => void = () => {};
    const opened = new Promise<void>((accept) => { shown = accept; }); const ask = vi.fn(() => new Promise<boolean>((accept) => { answer = accept; shown(); }));
    const consent = new XlsxReadConsent(ask); const abort = new AbortController(); const pending = consent.approve(path, abort.signal); await opened; abort.abort();
    await expect(pending).rejects.toThrow(/cancel/i); answer(true);
    ask.mockResolvedValueOnce(false); await expect(consent.approve(path)).rejects.toThrow(/declin/i); expect(ask).toHaveBeenCalledTimes(2);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
