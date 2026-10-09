import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { beforeAll, expect, test } from 'vitest';

let matchingDiagnostics: readonly ts.Diagnostic[];
let mismatchedDiagnostics: readonly ts.Diagnostic[];

// Both fixtures use the identical compiler options and full default libraries.
// Compile them in one setup program so helper-process tests do not compete with
// repeated standard-library parsing inside the assertion timeouts.
beforeAll(async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-types-'));
  try {
    const matchingFile = join(directory, 'matching.ts');
    const mismatchedFile = join(directory, 'mismatched.ts');
    const protocolPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/protocol.ts').replaceAll('\\', '/');
    const imports = `import type { WebviewToHostMessage, HostToWebviewMessage } from ${JSON.stringify(protocolPath)};\n`;
    await writeFile(matchingFile, `${imports}
      const ready: WebviewToHostMessage = { type: 'ready' };
      const error: HostToWebviewMessage = { type: 'error', message: 'failed', context: 'open' };
      void ready; void error;
    `);
    await writeFile(mismatchedFile, `${imports}
      const toHost: WebviewToHostMessage = { type: 'error', message: 'failed', context: 'open' };
      const toWebview: HostToWebviewMessage = { type: 'ready' };
      void toHost; void toWebview;
    `);
    const program = ts.createProgram([matchingFile, mismatchedFile], {
      strict: true,
      noEmit: true,
      allowImportingTsExtensions: true,
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      types: [],
    });
    const matching = program.getSourceFile(matchingFile);
    const mismatched = program.getSourceFile(mismatchedFile);
    if (matching === undefined || mismatched === undefined) { throw new Error('The protocol compiler fixtures must be loaded.'); }
    const diagnostics = ts.getPreEmitDiagnostics(program);
    // Each assertion retains diagnostics from the protocol, libraries, and options;
    // only the other fixture's intentional errors are excluded.
    matchingDiagnostics = diagnostics.filter((diagnostic) => diagnostic.file !== mismatched);
    mismatchedDiagnostics = diagnostics.filter((diagnostic) => diagnostic.file !== matching);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 30000);

test('T-006: Given matching host and webview messages, When typechecked, Then both compile', () => {
  expect(matchingDiagnostics.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))).toEqual([]);
});

test('T-006: Given messages sent in the wrong direction, When typechecked, Then protocol drift fails compilation', () => {
  expect(mismatchedDiagnostics.filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error)).toHaveLength(2);
});
