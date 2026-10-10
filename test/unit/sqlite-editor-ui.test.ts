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

test('FR-002: Given an opened database, When the browser shell is rendered, Then local assets use a nonce CSP and all browsing controls are accessible', () => {
  const html = sqliteEditorHtml('sample.sqlite', { phase: 'opened', message: 'Read-only' }, {
    scriptUri: 'vscode-webview:/sqlite-browser.js', styleUri: 'vscode-webview:/sqlite-browser.css', nonce: 'test-nonce', cspSource: 'vscode-webview:',
  });
  expect(html).toContain("script-src 'nonce-test-nonce'");
  expect(html).toContain("style-src vscode-webview: 'nonce-test-nonce'");
  expect(html).toContain('nonce="test-nonce"');
  expect(html).toContain('Count rows');
  expect(html).toContain('Rows per page');
  expect(html).toContain('role="grid"');
  expect(html).not.toContain('later release');
  expect(html).not.toMatch(/https?:\/\//u);
});
