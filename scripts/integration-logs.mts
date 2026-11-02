import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

export interface ApprovedHostDiagnostic {
  source: string;
  line: number;
  severity: 'warning';
  rule: 'VSCODE-HOST-001' | 'VSCODE-HOST-002' | 'VSCODE-HOST-003' | 'VSCODE-HOST-004' | 'VSCODE-HOST-005' | 'VSCODE-HOST-006' | 'VSCODE-HOST-007';
  message: string;
}

const hostRules = [
  { id: 'VSCODE-HOST-001', message: /^\[CloudSandboxApi\] No 'github' session with scopes \[read:user, user:email, repo, workflow\]$/ },
  { id: 'VSCODE-HOST-002', message: /^Creation of workbench contribution 'workbench\.contrib\.chatLanguageModelsData' took \d+ms\.$/ },
  // Owner-approved T-019 vendor startup families; retain renderer/severity guards.
  { id: 'VSCODE-HOST-003', message: /^Creation of workbench contribution 'workbench\.contrib\.preferencesActions' took \d+ms\.$/ },
  { id: 'VSCODE-HOST-004', message: /^Creation of workbench contribution 'workbench\.contrib\.chatPetContext' took \d+ms\.$/ },
  // Owner-authorized T-020 startup family; retain all source/severity guards.
  { id: 'VSCODE-HOST-005', message: /^Creation of workbench contribution 'workbench\.contrib\.remoteStatusIndicator' took \d+ms\.$/ },
  // Owner-approved T-027 constructor timing family; all source/severity guards remain.
  { id: 'VSCODE-HOST-006', message: /^Creation of workbench contribution 'chat\.builtinTools' took \d+ms\.$/ },
  // Owner-authorized exact T-030 constructor timing; retain source/severity/reporting guards.
  { id: 'VSCODE-HOST-007', message: /^Creation of workbench contribution 'workbench\.contrib\.dynamicWindowConfiguration' took \d+ms\.$/ },
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

function appendWatcherContext(record: string, context: string[]): boolean {
  const truncated = '[truncated: watcher context capacity reached]';
  if (context.at(-1) === truncated) { return false; }
  // Reserve space for the explicit truncation marker within both bounds.
  if (context.length >= 63 || context.reduce((total, item) => total + item.length + 1, 0) + record.length + 1 > 16300) {
    context.push(truncated); return false;
  }
  context.push(record); return true;
}

/** Bounded evidence only: the complete severity scan below always runs. */
function collectWatcherContext(source: string, lines: readonly string[], context: string[]): void {
  if (context.at(-1) === '[truncated: watcher context capacity reached]' || !/^\d{8}T\d{6}\/window\d+\/fileWatcher\.log$/.test(source)) { return; }
  let visited = -1; let affected = false; let found = false;
  for (const [index, line] of lines.entries()) {
    if (!line.endsWith('[warning] [File Watcher (node.js)] Watcher shutdown because watched path got deleted')) { continue; }
    affected = true;
    const end = Math.min(lines.length - 1, index + 16);
    for (let nearby = Math.max(visited + 1, index - 16, 0); nearby <= end; nearby++) {
      const text = lines[nearby];
      if (text === undefined || !/^\d{4}-\d{2}-\d{2} .* \[trace\] \[File Watcher /u.test(text)) { continue; }
      found = true;
      const record = JSON.stringify({ source, line: nearby + 1, text: text.length <= 1024 ? text : `${text.slice(0, 1012)} [truncated]` });
      if (!appendWatcherContext(record, context)) { return; }
    }
    visited = end;
  }
  if (affected && !found) { appendWatcherContext(JSON.stringify({ source, message: 'No adjacent watcher trace records; watched path remains unknown.' }), context); }
}

export async function checkIntegrationLogs(directory: string): Promise<ApprovedHostDiagnostic[]> {
  const files = await logFiles(directory);
  if (files.length === 0) {
    throw new Error('No VS Code log files were produced; runtime diagnostics could not be checked.');
  }
  const diagnostics: string[] = [];
  const approved: ApprovedHostDiagnostic[] = [];
  const watcherContext: string[] = [];
  for (const file of files) {
    const source = relative(directory, file).replaceAll('\\', '/');
    const lines = (await readFile(file, 'utf8')).split(/\r?\n/);
    collectWatcherContext(source, lines, watcherContext);
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
    const context = watcherContext.length === 0 ? '' : `VS Code watcher context (adjacent trace; bounded to64 records/16384 characters, lines to1024 characters):\n${watcherContext.join('\n')}\n`;
    throw new Error(`VS Code runtime logs contain diagnostics:\n${diagnostics.join('\n')}\n${formatApprovedHostDiagnostics(approved)}${context}`);
  }
  return approved;
}
