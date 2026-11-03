import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { observeProcessLines } from '../../src/test/sqlite-memory-observer';

vi.mock('node:child_process', () => ({ spawn: vi.fn() }));
class NativeChild extends EventEmitter {
  readonly stdout = new PassThrough(); readonly stderr = new PassThrough(); readonly stdin = new PassThrough();
  readonly kill = vi.fn(() => true);
}
let child: NativeChild;
beforeEach(() => {
  vi.useFakeTimers(); child = new NativeChild();
  vi.mocked(spawn).mockReturnValue(child as unknown as ChildProcessWithoutNullStreams);
});
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });
function observe(signal = new AbortController().signal, snapshotMs = 3000, onLine: (line: string) => void = () => {}, retain = true): Promise<Error> {
  return observeProcessLines('native', [], onLine, signal, 20000, snapshotMs, true, retain)
    .then(() => { throw new Error('Expected strict diagnostic failure'); }, (error: unknown) => {
      if (!(error instanceof Error)) { throw error; } return error;
    });
}

test('NFR-003: Given split CLIXML stderr and a zero exit, When optional retention is enabled, Then every byte fails and new snapshots and acknowledgments stop immediately', async () => {
  const onLine = vi.fn(); const result = observe(undefined, 3000, onLine);
  const bytes = Buffer.from('#< CLIXML\nCIM failure: café');
  child.stderr.write(bytes.subarray(0, bytes.length - 1)); child.stdout.write('must not count\n');
  await vi.advanceTimersByTimeAsync(25); child.stderr.write(bytes.subarray(bytes.length - 1));
  child.emit('close', 0, null);
  expect((await result).message).toBe(`OS observer diagnostic: ${bytes.toString('utf8')}`);
  expect(onLine).not.toHaveBeenCalled(); expect(child.stdin.readableLength).toBe(0);
  expect(child.kill).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
});

test('NFR-003: Given diagnostics disabled, When stderr arrives, Then the original immediate termination and first-chunk error remain unchanged', async () => {
  const result = observe(undefined, 3000, undefined, false);
  child.stderr.write('#< CLIXML'); expect(child.kill).toHaveBeenCalledTimes(1);
  child.stderr.write('later body'); child.emit('close', 1, 'SIGKILL');
  expect((await result).message).toBe('OS observer diagnostic: #< CLIXML'); expect(vi.getTimerCount()).toBe(0);
});

test('NFR-003: Given retained stderr that never closes, When later chunks arrive, Then the fixed 100 ms drain cannot be restarted and incomplete output is labelled', async () => {
  const result = observe(); child.stderr.write('first');
  await vi.advanceTimersByTimeAsync(90); child.stderr.write('second');
  await vi.advanceTimersByTimeAsync(9); expect(child.kill).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1); expect(child.kill).toHaveBeenCalledTimes(1); child.emit('close', null, 'SIGKILL');
  expect((await result).message).toMatch(/^OS observer diagnostic: firstsecond.*incomplete/s); expect(vi.getTimerCount()).toBe(0);
});

test('NFR-003: Given the original snapshot watchdog and later stderr, When its deadline precedes draining, Then stderr cannot extend the deadline or become a pass', async () => {
  const result = observe(undefined, 60); child.stdout.write('first\n');
  await vi.advanceTimersByTimeAsync(20); child.stderr.write('native failure');
  await vi.advanceTimersByTimeAsync(39); expect(child.kill).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1); expect(child.kill).toHaveBeenCalledTimes(1); child.emit('close', null, 'SIGKILL');
  expect((await result).message).toMatch(/^OS observer diagnostic: native failure.*incomplete/s); expect(vi.getTimerCount()).toBe(0);
});

test('NFR-003: Given more than 16384 raw diagnostic bytes, When retaining stderr, Then capture is capped, termination is immediate and truncation is explicit', async () => {
  const result = observe(); child.stderr.write(Buffer.alloc(16384, 120)); expect(child.kill).not.toHaveBeenCalled();
  child.stderr.write('PRIVATE OVERFLOW'); expect(child.kill).toHaveBeenCalledTimes(1); child.emit('close', 1, 'SIGKILL');
  const message = (await result).message;
  expect(message).toContain('x'.repeat(16384)); expect(message).not.toContain('PRIVATE OVERFLOW');
  expect(message).toMatch(/truncated at 16384 bytes/); expect(vi.getTimerCount()).toBe(0);
});

test('NFR-003: Given retained stderr before cancellation, When aborted, Then failure still rejects and cancellation clears draining', async () => {
  const abort = new AbortController(); const result = observe(abort.signal); child.stderr.write('native failure');
  abort.abort(); expect(child.kill).toHaveBeenCalledTimes(1); child.emit('close', null, 'SIGKILL');
  expect((await result).message).toMatch(/^OS observer diagnostic: native failure.*incomplete/s); expect(vi.getTimerCount()).toBe(0);
});

test('NFR-003: Given an earlier parser failure followed by stderr, When the child closes, Then the original failure remains primary and native output is supplemental', async () => {
  const result = observe(undefined, 3000, () => { throw new Error('original parser failure'); });
  child.stdout.write('first\n'); child.stderr.write('#< CLIXML'); child.stderr.write('\nnative body'); child.emit('close', 1, 'SIGKILL');
  expect((await result).message).toMatch(/^original parser failure\nOS observer diagnostic: #< CLIXML\nnative body/);
  expect(vi.getTimerCount()).toBe(0);
});
