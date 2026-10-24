import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import ts from 'typescript';
import { expect, test } from 'vitest';

test('NFR-006: Given production host, worker and webview TypeScript, When auditing network imports and browser request APIs, Then extension-owned code uses no network or telemetry entry point', async () => {
  const prohibitedImports = /^(?:node:)?(?:https?|http2|net|tls|dns|dgram)(?:\/|$)|^(?:undici|axios|node-fetch|@vscode\/extension-telemetry)(?:\/|$)/u;
  const prohibitedCalls = new Set(['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'sendBeacon', 'openExternal']);
  const violations: string[] = []; let files = 0;
  async function scan(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) { if (path !== join('src', 'test')) { await scan(path); } continue; }
      if (!entry.name.endsWith('.ts')) { continue; } files++;
      const file = ts.createSourceFile(path, await readFile(path, 'utf8'), ts.ScriptTarget.Latest, true);
      function visit(node: ts.Node): void {
        if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && prohibitedImports.test(node.moduleSpecifier.text)) { violations.push(`${path}: ${node.moduleSpecifier.text}`); }
        if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
          const callee = node.expression;
          const name = ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.text : undefined;
          if (name !== undefined && prohibitedCalls.has(name)) { violations.push(`${path}: ${name}`); }
          if (ts.isCallExpression(node) && (callee.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(callee) && callee.text === 'require')) {
            const name = node.arguments[0]; if (name !== undefined && ts.isStringLiteral(name) && prohibitedImports.test(name.text)) { violations.push(`${path}: ${name.text}`); }
          }
        }
        ts.forEachChild(node, visit);
      }
      visit(file);
    }
  }
  await scan('src'); await scan('webview');
  expect(files).toBeGreaterThan(30); expect(violations).toEqual([]);
});
