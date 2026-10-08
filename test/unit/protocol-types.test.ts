import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { expect, test } from 'vitest';

async function diagnosticsFor(source: string): Promise<readonly ts.Diagnostic[]> {
  const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-types-'));
  try {
    const file = join(directory, 'message.ts');
    const protocolPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/protocol.ts').replaceAll('\\', '/');
    await writeFile(file, `import type { WebviewToHostMessage, HostToWebviewMessage } from ${JSON.stringify(protocolPath)};\n${source}`);
    const program = ts.createProgram([file], {
      strict: true,
      noEmit: true,
      allowImportingTsExtensions: true,
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      types: [],
    });
    return ts.getPreEmitDiagnostics(program);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('T-006: Given matching host and webview messages, When typechecked, Then both compile', async () => {
  const diagnostics = await diagnosticsFor(`
    const ready: WebviewToHostMessage = { type: 'ready' };
    const error: HostToWebviewMessage = { type: 'error', message: 'failed', context: 'open' };
    void ready; void error;
  `);
  expect(diagnostics.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))).toEqual([]);
});

test('T-006: Given messages sent in the wrong direction, When typechecked, Then protocol drift fails compilation', async () => {
  const diagnostics = await diagnosticsFor(`
    const toHost: WebviewToHostMessage = { type: 'error', message: 'failed', context: 'open' };
    const toWebview: HostToWebviewMessage = { type: 'ready' };
    void toHost; void toWebview;
  `);
  expect(diagnostics.filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error)).toHaveLength(2);
});
