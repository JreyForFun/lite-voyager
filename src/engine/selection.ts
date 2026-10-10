import { FALLBACK_PROMPT_BYTES, type EngineName } from './engine';

/** The caller uses the real built-in resolver. Other loader errors must surface. */
export function selectBuiltin<T>(load: () => T, forceFlag: string | undefined): T | undefined {
  if (forceFlag === '1') { return undefined; }
  try { return load(); }
  catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ERR_UNKNOWN_BUILTIN_MODULE') { return undefined; }
    throw error;
  }
}

export function needsFallbackConsent(engine: EngineName, bytes: bigint): boolean {
  return engine === 'sql.js' && bytes > BigInt(FALLBACK_PROMPT_BYTES);
}
