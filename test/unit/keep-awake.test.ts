import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { expect, test } from 'vitest';
import { acquireWindowsAwake, withSystemAwake } from '../../scripts/keep-awake.mts';

test('NFR-003: Given Windows verification, When checks succeed or fail, Then an acknowledged awake lease covers only the checks and always releases', async () => {
  for (const fail of [false, true]) {
    const events: string[] = []; const original = new Error('original check failure');
    const result = withSystemAwake(() => { events.push('checks'); return fail ? Promise.reject(original) : Promise.resolve(42); }, {
      platform: 'win32', acquire: () => { events.push('acquired'); return Promise.resolve({ release: () => { events.push('released'); return Promise.resolve(); } }); },
    });
    if (fail) { await expect(result).rejects.toBe(original); } else { await expect(result).resolves.toBe(42); }
    expect(events).toEqual(['acquired', 'checks', 'released']);
  }
});

test('NFR-003: Given unavailable Windows wake protection, When starting verification, Then checks never start', async () => {
  let ran = false;
  await expect(withSystemAwake(() => { ran = true; return Promise.resolve(); }, {
    platform: 'win32', acquire: () => Promise.reject(new Error('acquisition refused')),
  })).rejects.toThrow('acquisition refused');
  expect(ran).toBe(false);
});

test.each(['linux', 'darwin'] as const)('NFR-003: Given %s verification, When running checks, Then no Windows power helper starts', async (platform) => {
  await expect(withSystemAwake(() => Promise.resolve('checked'), {
    platform, acquire: () => { throw new Error('Windows helper must not start'); },
  })).resolves.toBe('checked');
});

test('NFR-003: Given a failed check and failed wake cleanup, When releasing, Then both failures are retained', async () => {
  const check = new Error('check failed'); const cleanup = new Error('cleanup failed');
  try {
    await withSystemAwake(() => Promise.reject(check), { platform: 'win32', acquire: () => Promise.resolve({ release: () => Promise.reject(cleanup) }) });
    expect.unreachable('Both failures must reject');
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(AggregateError);
    if (!(error instanceof AggregateError)) { throw error; }
    expect(error.errors).toEqual([check, cleanup]);
    expect(error.message).toContain('check failed');
    expect(error.message).toContain('cleanup failed');
  }
});

const helper = (source: string) => ({ command: process.execPath, args: ['-e', source] });

test('NFR-003: Given an acknowledged child awake request, When releasing, Then stdin closes and the owned helper exits cleanly', async () => {
  const lease = await acquireWindowsAwake({ helper: helper("console.log('lite-voyager-awake-ready'); process.stdin.resume(); process.stdin.on('end',()=>console.log('lite-voyager-awake-released'));") });
  await expect(lease.release()).resolves.toBeUndefined();
});

test('NFR-003: Given readiness split across native CRLF chunks, When acquiring, Then the actual stream acknowledgement is recognized', async () => {
  const lease = await acquireWindowsAwake({ helper: helper("process.stdout.write('lite-voyager-awake-ready\\r'); setTimeout(()=>process.stdout.write('\\n'),10); process.stdin.resume(); process.stdin.on('end',()=>console.log('lite-voyager-awake-released'));") , startupMs: 500 });
  await expect(lease.release()).resolves.toBeUndefined();
});

test.runIf(process.platform === 'win32')('NFR-003: Given an owner process exiting without cleanup, When the owner exits, Then its native request helper also exits', async () => {
  let helperPid: number | undefined;
  const gone = (): boolean => {
    if (helperPid === undefined) { return true; }
    try { process.kill(helperPid, 0); return false; }
    catch (error: unknown) {
      if (error instanceof Error && 'code' in error && error.code === 'ESRCH') { return true; }
      throw error;
    }
  };
  try {
    const module = pathToFileURL(resolve('scripts/keep-awake.mts')).href;
    const owner = `import {acquireWindowsAwake} from ${JSON.stringify(module)}; const lease=await acquireWindowsAwake(); console.log(lease.pid); process.exit(0);`;
    const output = await promisify(execFile)(process.execPath, ['--input-type=module', '-e', owner], { timeout: 20000 });
    helperPid = Number(output.stdout.trim()); expect(Number.isSafeInteger(helperPid) && helperPid > 0).toBe(true);
    await expect.poll(gone, { timeout: 3000 }).toBe(true);
  } finally { if (helperPid !== undefined && !gone()) { process.kill(helperPid); } }
}, 30000);

test('NFR-003: Given an awake helper exiting before checks finish, When releasing, Then verification cannot pass', async () => {
  const lease = await acquireWindowsAwake({ helper: helper("console.log('lite-voyager-awake-ready'); setTimeout(()=>process.exit(7),25);") });
  await lease.exited;
  await expect(lease.release()).rejects.toThrow('awake helper');
});

test('NFR-003: Given a failed or unacknowledged awake helper, When acquiring, Then startup fails within its bound', async () => {
  await expect(acquireWindowsAwake({ helper: helper('process.exit(9)') })).rejects.toThrow('awake helper');
  await expect(acquireWindowsAwake({ helper: helper('setInterval(()=>{},1000)'), startupMs: 100 })).rejects.toThrow('acknowledgement');
});

test.runIf(process.platform === 'win32')('NFR-003: Given the actual Windows native helper, When acquiring and releasing, Then the same thread acknowledges its active system requirement and clears it', async () => {
  const lease = await acquireWindowsAwake();
  await expect(lease.release()).resolves.toBeUndefined();
  const script = await readFile(resolve('scripts/windows-awake.ps1'), 'utf8');
  expect(script).not.toContain('powercfg');
}, 30000);
