import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

export interface ApprovedHostDiagnostic {
  source: string;
  line: number;
  severity: 'warning';
  rule: 'VSCODE-HOST-001' | 'VSCODE-HOST-002';
  message: string;
}

const hostRules = [
  { id: 'VSCODE-HOST-001', message: /^\[CloudSandboxApi\] No 'github' session with scopes \[read:user, user:email, repo, workflow\]$/ },
  { id: 'VSCODE-HOST-002', message: /^Creation of workbench contribution 'workbench\.contrib\.chatLanguageModelsData' took \d+ms\.$/ },
] as const;

function approvedHostDiagnostic(source: string, line: string, number: number): ApprovedHostDiagnostic | undefined {
  if (!/^\d{8}T\d{6}\/window\d+\/renderer\.log$/.test(source)) { return undefined; }
  const message = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3} \[warning\] (.*)$/.exec(line)?.[1];
  if (message === undefined) { return undefined; }
  const rule = hostRules.find((candidate) => candidate.message.test(message));
  return rule === undefined ? undefined : { source, line: number, severity: 'warning', rule: rule.id, message };
}

// Preserve the original severity as structured metadata so the outer console
// gate can distinguish an approved host record from an unclassified diagnostic.
export function formatApprovedHostDiagnostics(diagnostics: readonly ApprovedHostDiagnostic[]): string {
  return diagnostics.length === 0 ? '' : `Approved VS Code host diagnostics:\n${diagnostics.map((item) => JSON.stringify(item)).join('\n')}\n`;
}

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

export async function checkIntegrationLogs(directory: string): Promise<ApprovedHostDiagnostic[]> {
  const files = await logFiles(directory);
  if (files.length === 0) {
    throw new Error('No VS Code log files were produced; runtime diagnostics could not be checked.');
  }
  const diagnostics: string[] = [];
  const approved: ApprovedHostDiagnostic[] = [];
  for (const file of files) {
    const source = relative(directory, file).replaceAll('\\', '/');
    const lines = (await readFile(file, 'utf8')).split(/\r?\n/);
    for (const [index, line] of lines.entries()) {
      if (/\[(?:warning|error)\]/i.test(line)) {
        const known = approvedHostDiagnostic(source, line, index + 1);
        if (known === undefined) {
          diagnostics.push(`${source}:${String(index + 1)}: ${line}`);
        } else {
          approved.push(known);
        }
      }
    }
  }
  if (diagnostics.length > 0) {
    throw new Error(`VS Code runtime logs contain diagnostics:\n${diagnostics.join('\n')}\n${formatApprovedHostDiagnostics(approved)}`);
  }
  return approved;
}
