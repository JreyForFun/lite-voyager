import { expect, test } from 'vitest';
import type { FileLoader, PreviewResult } from '../../src/loaders/file-loader';

test('FR-004: Given the common FileLoader contract, When another format provides a preview, Then CSV-specific metadata is not required', () => {
  // This fixture must also pass strict tooling typechecking: future JSON/XLSX
  // loaders must not invent a delimiter or CSV header flag to implement it.
  const preview: PreviewResult = { columns: ['value'], rows: [['exact']], bytesRead: '10', totalBytes: '10', reachedEnd: true, notice: '', threadId: 1 };
  const loader: FileLoader = { extensions: ['future-format'], preview: () => Promise.resolve(preview),
    import: () => Promise.resolve([{ name: 'table', columns: ['value'], rowCount: '1' }]) };
  expect(loader.extensions).toEqual(['future-format']);
});
