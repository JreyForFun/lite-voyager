import type { EngineName } from '../engine/engine';
import type { CsvDelimiter, CsvLoadOptions, FilePreviewResult } from '../protocol';

export type LoadOptions = CsvLoadOptions;
export type PreviewResult = FilePreviewResult;
export interface Progress { bytes: string; totalBytes: string; rows: string; phase?: 'reading' | 'publishing'; engine?: EngineName; notice?: string; processId?: number; }
export interface ImportedTable { name: string; columns: string[]; rowCount: string; engine?: EngineName; notice?: string; }
/** Internal fresh destination owned by an import worker, never the user's source. */
export interface ImportTarget { path: string; engine: EngineName; }
export interface PreviewLoader<Result extends PreviewResult = PreviewResult> {
  readonly extensions: readonly string[];
  preview(path: string, options?: LoadOptions, signal?: AbortSignal): Promise<Result>;
}
export interface FileLoader extends PreviewLoader {
  import(path: string, target: ImportTarget, options: LoadOptions, onProgress: (progress: Progress) => void, signal: AbortSignal): Promise<ImportedTable[]>;
}

export function previewOptions(value: unknown): CsvLoadOptions {
  if (typeof value !== 'object' || value === null) { throw new Error('Invalid CSV preview options.'); }
  const options = value as Record<string, unknown>;
  if (Object.keys(options).some((key) => key !== 'delimiter' && key !== 'header')
    || (options['delimiter'] !== undefined && (typeof options['delimiter'] !== 'string' || ![',', '\t', ';', '|'].includes(options['delimiter'])))
    || (options['header'] !== undefined && typeof options['header'] !== 'boolean')) {
    throw new Error('Choose comma, tab, semicolon or pipe and a boolean header option.');
  }
  return { ...(options['delimiter'] === undefined ? {} : { delimiter: options['delimiter'] as CsvDelimiter }),
    ...(options['header'] === undefined ? {} : { header: options['header'] }) };
}

export function importOptions(value: unknown): LoadOptions {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) { throw new Error('Invalid CSV import options.'); }
  const options = value as Record<string, unknown>;
  if (Object.keys(options).some((key) => !['delimiter', 'header', 'allText'].includes(key))
    || (options['allText'] !== undefined && typeof options['allText'] !== 'boolean')) { throw new Error('Invalid CSV import options.'); }
  return { ...previewOptions({ ...(options['delimiter'] === undefined ? {} : { delimiter: options['delimiter'] }),
    ...(options['header'] === undefined ? {} : { header: options['header'] }) }),
    ...(options['allText'] === undefined ? {} : { allText: options['allText'] }) };
}
