import { extname } from 'node:path';
import { MAX_PREVIEW_ROWS, type CsvDelimiter, type CsvPreviewResult } from '../protocol';
import { readCsvPreview } from './csv-preview-reader';
import type { LoadOptions } from './file-loader';

/** At most four bounded start-of-file previews; never scan the full source. */
export function detectedPreview(path: string, options: LoadOptions): CsvPreviewResult {
  const clean = { ...(options.header === undefined ? {} : { header: options.header }) };
  if (options.delimiter !== undefined) { return readCsvPreview(path, { ...clean, delimiter: options.delimiter }); }
  const preferred: CsvDelimiter = extname(path).toLowerCase() === '.tsv' ? '\t' : ',';
  const candidates = [preferred, ...([',', '\t', ';', '|'] as const).filter((value) => value !== preferred)];
  const alternatives = candidates.filter((value) => value !== preferred);
  let sawAlternative = false;
  const observe = (record: string): void => { sawAlternative ||= alternatives.some((delimiter) => record.includes(delimiter)); };
  let best: CsvPreviewResult | undefined; let score = -1;
  for (const delimiter of candidates) {
    try {
      const preview = readCsvPreview(path, { ...clean, delimiter }, 65_536, delimiter === preferred ? observe : undefined);
      const consistent = preview.rows.filter((row) => row.every((field) => field !== null)).length;
      const value = (preview.columns.length > 1 ? 10000 : 0) + (preview.rows.length === 0 ? 1 : consistent / preview.rows.length) * 1000 + preview.columns.length;
      if (value > score) { score = value; best = preview; }
      // Without any alternative character in the complete raw sample, another
      // candidate can only tie this one-column result, lose to its multiple
      // columns, or reject its quoted fields. Ties already prefer this delimiter.
      // Partial/budget-limited records cannot establish that equivalence.
      if (delimiter === preferred && !sawAlternative && (preview.reachedEnd || preview.rows.length === MAX_PREVIEW_ROWS)) { break; }
    } catch { /* A candidate's quote boundaries may be invalid for this delimiter. */ }
  }
  if (best === undefined) { return readCsvPreview(path, { ...clean, delimiter: preferred }); }
  best.notice = `${best.notice} Delimiter detected from the bounded preview; review or override it before import.`.trim();
  return best;
}
