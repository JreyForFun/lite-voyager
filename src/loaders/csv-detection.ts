import { extname } from 'node:path';
import type { CsvDelimiter, CsvPreviewResult } from '../protocol';
import { readCsvPreview } from './csv-preview-reader';
import type { LoadOptions } from './file-loader';

/** At most four bounded start-of-file previews; never scan the full source. */
export function detectedPreview(path: string, options: LoadOptions): CsvPreviewResult {
  const clean = { ...(options.header === undefined ? {} : { header: options.header }) };
  if (options.delimiter !== undefined) { return readCsvPreview(path, { ...clean, delimiter: options.delimiter }); }
  const preferred: CsvDelimiter = extname(path).toLowerCase() === '.tsv' ? '\t' : ',';
  const candidates = [preferred, ...([',', '\t', ';', '|'] as const).filter((value) => value !== preferred)];
  let best: CsvPreviewResult | undefined; let score = -1;
  for (const delimiter of candidates) {
    try {
      const preview = readCsvPreview(path, { ...clean, delimiter });
      const consistent = preview.rows.filter((row) => row.every((field) => field !== null)).length;
      const value = (preview.columns.length > 1 ? 10000 : 0) + (preview.rows.length === 0 ? 1 : consistent / preview.rows.length) * 1000 + preview.columns.length;
      if (value > score) { score = value; best = preview; }
    } catch { /* A candidate's quote boundaries may be invalid for this delimiter. */ }
  }
  if (best === undefined) { return readCsvPreview(path, { ...clean, delimiter: preferred }); }
  best.notice = `${best.notice} Delimiter detected from the bounded preview; review or override it before import.`.trim();
  return best;
}
