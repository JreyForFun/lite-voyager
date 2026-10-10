const esbuild = require('esbuild');
const { copyFile, mkdir, readFile, writeFile } = require('node:fs/promises');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/** @type {import('esbuild').Plugin} */
const diagnostics = {
  name: 'diagnostics',
  setup(build) {
    build.onStart(() => console.log('[watch] build started'));
    build.onEnd(async (result) => {
      for (const text of await esbuild.formatMessages(result.errors, { kind: 'error', color: false })) {
        console.error(text);
      }
      if (result.warnings.length > 0) {
        for (const text of await esbuild.formatMessages(result.warnings, { kind: 'warning', color: false })) {
          console.error(text);
        }
        return { errors: [{ text: 'Build warnings are failures.' }] };
      }
      if (result.errors.length === 0) {
        console.log('[watch] build finished');
      }
      return undefined;
    });
  },
};

async function buildBundle(options) {
  const context = await esbuild.context({
    bundle: true,
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    logLevel: 'silent',
    plugins: [diagnostics],
    ...options,
  });
  if (watch) {
    await context.watch();
  } else {
    try {
      await context.rebuild();
    } finally {
      await context.dispose();
    }
  }
}

async function main() {
  await buildBundle({
    entryPoints: ['src/extension.ts'],
    platform: 'node',
    format: 'cjs',
    target: 'es2022',
    outfile: 'dist/extension.js',
    external: ['vscode'],
  });
  await buildBundle({
    entryPoints: ['src/worker/sqlite-spike-process.ts'],
    platform: 'node',
    format: 'cjs',
    target: 'es2022',
    outfile: 'dist/sqlite-spike-process.js',
  });
  await buildBundle({
    entryPoints: ['src/worker/sqlite-spike-worker.ts'],
    platform: 'node',
    format: 'cjs',
    target: 'es2022',
    outfile: 'dist/sqlite-spike-worker.js',
    external: ['node:sqlite'],
  });
  await mkdir('dist', { recursive: true });
  for (const name of ['db-process', 'db-worker']) {
    await buildBundle({
      entryPoints: [`src/worker/${name}.ts`],
      platform: 'node', format: 'cjs', target: 'es2022',
      outfile: `dist/${name}.js`, external: ['node:sqlite'],
    });
  }
  await copyFile('node_modules/sql.js/dist/sql-wasm.js', 'dist/sql-wasm.cjs');
  await copyFile('node_modules/sql.js/dist/sql-wasm.wasm', 'dist/sql-wasm.wasm');
  await copyFile('node_modules/sql.js/LICENSE', 'dist/sql.js-LICENSE');
  const editorLicenses = [];
  for (const name of ['@codemirror/state', '@codemirror/view', '@codemirror/commands', '@codemirror/lang-sql', '@codemirror/language', '@codemirror/autocomplete', '@codemirror/streamparser', '@marijn/find-cluster-break', '@lezer/common', '@lezer/highlight', '@lezer/lr', 'style-mod', 'w3c-keyname', 'crelt']) {
    editorLicenses.push(`${name}\n${await readFile(`node_modules/${name}/LICENSE`, 'utf8')}`);
  }
  await writeFile('dist/codemirror-LICENSES.txt', editorLicenses.join('\n\n'));
  await buildBundle({
    entryPoints: ['webview/main.ts'],
    platform: 'browser',
    format: 'iife',
    target: 'es2022',
    outfile: 'dist/webview.js',
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
