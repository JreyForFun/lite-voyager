import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { stripVTControlCharacters } from 'node:util';

export interface Check {
  name: string;
  command: string;
  args: readonly string[];
}

interface CheckOptions {
  cwd?: string;
  echo?: boolean;
  env?: NodeJS.ProcessEnv;
  failureLogPath?: string | undefined;
}

const warningPattern = /(?:^|\s|\[)warn(?:ing)?\b[\s:\]]|\b[a-z]+Warning:/im;
const errorPattern = /(?:^|\s|\[)error\b[\s:\]]|\b[a-z]+Error:|:ERROR:/im;

export function runCheck(check: Check, options: CheckOptions = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    let output = '';
    let finishing = false;
    const fail = (failure: Error): void => {
      if (finishing) { return; } finishing = true;
      if (options.failureLogPath === undefined) { reject(failure); return; }
      // Persist only after rejection is determined. Keep the captured decoded
      // text intact, and never overwrite existing evidence or clear a failure.
      void writeFile(options.failureLogPath, output, { flag: 'wx' }).then(() => { reject(failure); }, (error: unknown) => {
        reject(new AggregateError([failure, error], `${failure.message}\nFailure transcript could not be retained: ${error instanceof Error ? error.message : String(error)}`));
      });
    };
    const launch = () => {
      try {
        return spawn(check.command, [...check.args], {
          cwd: options.cwd, env: options.env, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
        });
      } catch (error: unknown) { fail(error instanceof Error ? error : new Error(String(error))); return undefined; }
    };
    const child = launch(); if (child === undefined) { return; }
    const capture = (chunk: Buffer, destination: NodeJS.WriteStream): void => {
      const text = chunk.toString();
      output += text;
      if (options.echo !== false) {
        destination.write(text);
      }
    };
    child.stdout.on('data', (chunk: Buffer) => capture(chunk, process.stdout));
    child.stderr.on('data', (chunk: Buffer) => capture(chunk, process.stderr));
    child.on('error', (error) => { fail(new Error(`${check.name} could not start: ${error.message}`)); });
    child.on('close', (code, signal) => {
      if (finishing) { return; }
      // Scan assembled text so terminal formatting (even across chunks) cannot hide severity.
      // Keep the captured and echoed output intact for diagnosis.
      const diagnostics = stripVTControlCharacters(output);
      if (code !== 0) {
        fail(new Error(`${check.name} failed with ${signal === null ? `exit code ${String(code)}` : `signal ${signal}`}.`));
      } else if (errorPattern.test(diagnostics)) {
        fail(new Error(`${check.name} emitted an error; verification requires zero errors.`));
      } else if (warningPattern.test(diagnostics)) {
        fail(new Error(`${check.name} emitted a warning; verification requires zero warnings.`));
      } else {
        resolve();
      }
    });
  });
}

export async function runChecks(checks: readonly Check[], options: CheckOptions = {}): Promise<void> {
  for (const check of checks) {
    if (options.echo !== false) {
      process.stdout.write(`\nChecking ${check.name}...\n`);
    }
    await runCheck(check, options);
  }
}
