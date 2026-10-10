import { expect, test } from 'vitest';
import { fallbackPrompt, engineHtml } from '../../src/fallback-ui';
import { needsFallbackConsent } from '../../src/engine/selection';

test('FR-001: Given the decimal 200 MB threshold, When evaluated, Then only larger fallback files require consent', () => {
  expect(needsFallbackConsent('sql.js', 199_999_999n)).toBe(false);
  expect(needsFallbackConsent('sql.js', 200_000_000n)).toBe(false);
  expect(needsFallbackConsent('sql.js', 200_000_001n)).toBe(true);
  expect(needsFallbackConsent('node:sqlite', 5_000_000_000n)).toBe(false);
});

test('FR-001: Given memory-limited mode, When rendered, Then its persistent accessible banner and prompt explain limits and recovery', () => {
  const mode = { engine: 'sql.js' as const, memoryLimited: true, bytes: '200000001', needsConsent: true, notice: 'Memory-limited mode: the entire file is loaded into memory.' };
  const html = engineHtml(mode, 'Opening <script>bad</script>');
  expect(html).toContain('role="status"');
  expect(html).toContain(mode.notice);
  expect(html).toContain('&lt;script&gt;bad&lt;/script&gt;');
  expect(html).not.toContain('<script>');
  expect(html).toContain("default-src 'none'");
  expect(fallbackPrompt(mode)).toContain('200 MB');
  expect(fallbackPrompt(mode)).toContain('update VS Code');
  expect(fallbackPrompt(mode)).toContain('Node 22+');
  expect(fallbackPrompt(mode)).toContain('memory');
  expect(fallbackPrompt(mode)).toContain('200000001');
});

test('FR-001: Given the primary engine, When rendered, Then the panel reports disk-backed mode', () => {
  const mode = { engine: 'node:sqlite' as const, memoryLimited: false, bytes: '5000000000', needsConsent: false, notice: 'Primary engine reads from disk.' };
  expect(engineHtml(mode, 'Opened')).toContain('Primary engine reads from disk.');
});
