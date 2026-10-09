import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { readTestSources, testRequirementIds } from '../../scripts/spec-tools.mts';

test('T-052: Given the foundation task requirements, When traced against real test declarations, Then every linked spike requirement has coverage', async () => {
  const tasks = await readFile('specs/TASKS.md', 'utf8');
  const foundation = tasks.split('## Milestone 0B:')[1]?.split('## Milestone 1:')[0];
  expect(foundation).toBeDefined();
  if (foundation === undefined) { throw new Error('Missing foundation task section.'); }
  const taskLines = foundation.split(/\r?\n/u).filter((line) => /^- \[[ xX]\] \*\*T-\d{3}\b/u.test(line));
  const required = [...new Set(taskLines.flatMap((line) => line.match(/\b(?:FR|NFR)-\d{3}\b/gu) ?? []))].sort();
  // This is the spike scope, not a claim that its production requirements pass.
  expect(required).toEqual(['FR-004', 'FR-015', 'FR-016', 'NFR-001', 'NFR-002', 'NFR-003', 'NFR-004', 'NFR-005', 'NFR-009']);
  const sources = await readTestSources(resolve('.'));
  const tested = new Set(sources.flatMap((source) => [...testRequirementIds(source)]));
  expect(required.filter((id) => !tested.has(id))).toEqual([]);
});
