import { expect, test } from 'vitest';
import { ProcessMetadataReader } from '../../src/test/csv-memory-metadata';

test('NFR-003: Given a warm persistent metadata reader, When new identities need discovery, Then requests reuse the reader and close confirms process exit', async () => {
  const code = 'const r=require("node:readline").createInterface({input:process.stdin});console.log(JSON.stringify({type:"ready"}));r.on("line",line=>console.log(JSON.stringify({type:"metadata",rows:JSON.parse(line).items})));';
  const reader = new ProcessMetadataReader(process.execPath, ['-e', code]);
  try {
    await reader.ready; expect(await reader.request([{ pid: 3, stamp: '100' }])).toEqual([{ pid: 3, stamp: '100' }]);
    expect(await reader.request([{ pid: 4, stamp: '101' }])).toEqual([{ pid: 4, stamp: '101' }]);
  } finally { await reader.stop(); }
});

test.each(['console.error("unexpected metadata diagnostic")', 'console.log("malformed")'])('NFR-003: Given invalid metadata startup %j, When reading, Then diagnostics and malformed replies fail without being accepted', async (code) => {
  const reader = new ProcessMetadataReader(process.execPath, ['-e', code]);
  try { await expect(reader.ready).rejects.toThrow(/metadata|diagnostic/i); } finally { await reader.stop(); }
});

test('NFR-003: Given a metadata request that never completes, When its strict deadline expires, Then timeout fails and teardown releases the reader', async () => {
  const reader = new ProcessMetadataReader(process.execPath, ['-e', 'process.stdin.resume();console.log(JSON.stringify({type:"ready"}));'], 3000, 50);
  try { await reader.ready; await expect(reader.request([{ pid: 3, stamp: '100' }])).rejects.toThrow(/deadline/i); }
  finally { await reader.stop(); }
});
