import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

async function logFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await logFiles(path));
    } else if (entry.isFile() && entry.name.endsWith('.log')) {
      files.push(path);
    }
  }
  return files;
}

export async function checkIntegrationLogs(directory: string): Promise<void> {
  const files = await logFiles(directory);
  if (files.length === 0) {
    throw new Error('No VS Code log files were produced; runtime diagnostics could not be checked.');
  }
  const diagnostics: string[] = [];
  for (const file of files) {
    const lines = (await readFile(file, 'utf8')).split(/\r?\n/);
    for (const [index, line] of lines.entries()) {
      if (/\[(?:warning|error)\]/i.test(line)) {
        diagnostics.push(`${relative(directory, file)}:${String(index + 1)}: ${line}`);
      }
    }
  }
  if (diagnostics.length > 0) {
    throw new Error(`VS Code runtime logs contain diagnostics:\n${diagnostics.join('\n')}`);
  }
}
