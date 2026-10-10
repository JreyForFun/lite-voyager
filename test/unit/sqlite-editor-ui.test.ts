import { expect, test } from 'vitest';
import { sqliteEditorHtml } from '../../src/editor/sqlite-editor-ui';

test('FR-001: Given untrusted file names and errors, When rendered, Then the script-free editor escapes text and blocks remote content', () => {
  const html = sqliteEditorHtml('<script>file</script>', { phase: 'error', message: '<img src=x onerror=alert(1)>' });
  expect(html).toContain('&lt;script&gt;file&lt;/script&gt;');
  expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  expect(html).not.toContain('<script>');
  expect(html).not.toContain('<img');
  expect(html).toContain("default-src 'none'");
  expect(html).toContain("style-src 'none'");
  expect(html).toContain('role="alert"');
  expect(html).not.toMatch(/https?:\/\//);
});

test('FR-001: Given fallback opening or cancellation, When rendered, Then the memory-limit banner remains visible and accessible', () => {
  const mode = { engine: 'sql.js' as const, memoryLimited: true, bytes: '200000001', needsConsent: true, notice: 'Memory-limited mode: the entire file is loaded into memory.' };
  for (const phase of ['opening', 'cancelled'] as const) {
    const html = sqliteEditorHtml('sample.sqlite', { phase, message: 'Opening cancelled', mode });
    expect(html).toContain(mode.notice);
    expect(html).toContain('aria-label="Database engine mode"');
    expect(html).toContain('role="status"');
  }
});
