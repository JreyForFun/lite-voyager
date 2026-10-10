import { spawn } from 'node:child_process';
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
}

const warningPattern = /(?:^|\s|\[)warn(?:ing)?\b[\s:\]]|\b[a-z]+Warning:/im;
const errorPattern = /(?:^|\s|\[)error\b[\s:\]]|\b[a-z]+Error:|:ERROR:/im;

export function runCheck(check: Check, options: CheckOptions = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(check.command, [...check.args], {
      cwd: options.cwd,
      env: options.env,
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    const capture = (chunk: Buffer, destination: NodeJS.WriteStream): void => {
      const text = chunk.toString();
      output += text;
      if (options.echo !== false) {
        destination.write(text);
      }
    };
    child.stdout.on('data', (chunk: Buffer) => capture(chunk, process.stdout));
    child.stderr.on('data', (chunk: Buffer) => capture(chunk, process.stderr));
    child.on('error', (error) => reject(new Error(`${check.name} could not start: ${error.message}`)));
    child.on('close', (code, signal) => {
      // Scan assembled text so terminal formatting (even across chunks) cannot hide severity.
      // Keep the captured and echoed output intact for diagnosis.
      const diagnostics = stripVTControlCharacters(output);
      if (code !== 0) {
        reject(new Error(`${check.name} failed with ${signal === null ? `exit code ${String(code)}` : `signal ${signal}`}.`));
      } else if (errorPattern.test(diagnostics)) {
        reject(new Error(`${check.name} emitted an error; verification requires zero errors.`));
      } else if (warningPattern.test(diagnostics)) {
        reject(new Error(`${check.name} emitted a warning; verification requires zero warnings.`));
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
