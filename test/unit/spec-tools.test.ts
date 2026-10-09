import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import { afterEach, expect, test } from 'vitest';
import { buildContext, findUntestedRequirements, parseRequirements, readTestSources, testRequirementIds } from '../../scripts/spec-tools.mts';

const execute = promisify(execFile);
const root = resolve('.');
const temporaryDirectories: string[] = [];
afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

const first = '**FR-001 (P0) Open.** Exact wording: emoji 🧭 and `NULL`.\n- Given a file, when opened, then preserve it.\n- Fallback must explain its limit.';
const second = '**FR-002 (P0) Browse.** Keep empty strings.';
const third = '**FR-003 (P0) Schema.** Keep names.';
const nfr = '| NFR-001 | Preserve source files | Byte-identical |';
const specification = [
  '# Spec', 'Reference only: FR-999.', '### Opening', first, '', second, '', third,
  '### Other section', 'Do not attach this section to FR-003.',
  '## Non-functional', '| ID | Requirement | Target |', '|---|---|---|', nfr,
  '| NFR-002 | Platforms | Windows, macOS, Linux |',
  '## Changelog', '- Mentioned FR-888, not a definition.',
].join('\n');
const constitution = '# Constitution\n\n1. Preserve files.\n2. Stay lite.\n';
const taskLine = '- [ ] **T-012 [AI]** Browse and open. *(FR-001 to FR-003, NFR-001, FR-001)*';
const tasks = '# Tasks\n\n' + taskLine + '\n- [x] **T-051 [AI]** Spec tools. *(CONTEXT.md)*\n';

test('T-051: Given paragraph and table requirements, When parsed, Then full exact blocks are retained without neighboring sections', () => {
  const requirements = parseRequirements(specification);
  expect([...requirements.keys()]).toEqual(['FR-001', 'FR-002', 'FR-003', 'NFR-001', 'NFR-002']);
  expect(requirements.get('FR-001')).toBe(first);
  expect(requirements.get('FR-003')).toBe(third);
  expect(requirements.get('NFR-001')).toBe(nfr);
});

test('T-051: Given CRLF and fenced examples, When parsed, Then line endings survive and example definitions are ignored', () => {
  const text = '```md\r\n**FR-999 example**\r\n```\r\n' + first.replaceAll('\n', '\r\n') + '\r\n';
  expect([...parseRequirements(text)]).toEqual([['FR-001', first.replaceAll('\n', '\r\n')]]);
});

test('T-051: Given duplicate or missing definitions, When parsed, Then ambiguity fails clearly', () => {
  expect(() => parseRequirements(first + '\n\n' + first)).toThrow('Duplicate requirement FR-001');
  expect(() => parseRequirements('# Empty specification')).toThrow('No FR/NFR requirement definitions');
});

test('T-051: Given a task with repeated links and a range, When context is built, Then exact requirements appear once in link order with the complete Constitution', () => {
  expect(buildContext(tasks, specification, constitution, 'T-012')).toBe(
    '# Task\n\n' + taskLine + '\n\n# Linked requirements\n\n' +
    [first, second, third, nfr].join('\n\n') + '\n\n# Constitution\n\n' + constitution,
  );
});

test('T-051: Given a task without FR/NFR links, When context is built, Then it explicitly says so and still includes the Constitution', () => {
  const output = buildContext(tasks, specification, constitution, 'T-051');
  expect(output).toContain('No FR/NFR requirements linked by this task.');
  expect(output.endsWith(constitution)).toBe(true);
  expect(output).not.toContain(first);
});

test('T-051: Given mixed range notation, When context is built, Then hyphen and en-dash ranges include every defined ID', () => {
  const output = buildContext('- [ ] **T-012** Links FR-001–FR-003 and NFR-001 - NFR-002.', specification, constitution, 'T-012');
  for (const text of [first, second, third, nfr, '| NFR-002 | Platforms | Windows, macOS, Linux |']) {
    expect(output).toContain(text);
  }
});

test('T-051: Given malformed unknown duplicate or fenced task IDs, When context is requested, Then it rejects without guessing', () => {
  expect(() => buildContext(tasks, specification, constitution, '../T-012')).toThrow('T-012');
  expect(() => buildContext(tasks, specification, constitution, 'T-999')).toThrow('Task T-999 not found');
  expect(() => buildContext(tasks + taskLine, specification, constitution, 'T-012')).toThrow('Duplicate task T-012');
  expect(() => buildContext('```md\n' + taskLine + '\n```', specification, constitution, 'T-012')).toThrow('Task T-012 not found');
});

test('T-051: Given an undefined requirement or invalid range, When context is requested, Then it fails instead of silently omitting text', () => {
  expect(() => buildContext('- [ ] **T-012** FR-999', specification, constitution, 'T-012')).toThrow('Requirement FR-999 not found');
  expect(() => buildContext('- [ ] **T-012** FR-001 to FR-004', specification, constitution, 'T-012')).toThrow('Requirement FR-004 not found');
  expect(() => buildContext('- [ ] **T-012** FR-003 to FR-001', specification, constitution, 'T-012')).toThrow('Invalid requirement range');
  expect(() => buildContext('- [ ] **T-012** FR-001 to NFR-002', specification, constitution, 'T-012')).toThrow('Invalid requirement range');
});

test('T-051: Given test and it declarations, When tracing, Then literal prefixes including modifiers aliases and parameterized tests count', () => {
  const source = [
    "import { test as check, it } from 'vitest';",
    "test('FR-001: opens', () => {});",
    'it(`FR-002: browses`, () => {});',
    "check.only('NFR-001: preserves', () => {});",
    "test.each([1, 2])('FR-003: example %s', () => {});",
    "test.each`value\n${1}`('NFR-002: tagged example', () => {});",
    "test.concurrent('FR-004: concurrent', async () => {});",
    "it('FR-005', function () {});",
  ].join('\n');
  expect([...testRequirementIds(source)].sort()).toEqual(['FR-001', 'FR-002', 'FR-003', 'FR-004', 'FR-005', 'NFR-001', 'NFR-002']);
});

test('T-051: Given comments fixture strings describe headings and non-prefix names, When tracing, Then none hide a missing test', () => {
  const source = [
    "// test('FR-001: comment', () => {});",
    "/* it('FR-001: block comment', () => {}); */",
    'const fixture = "test(\'FR-001: string\', () => {});";',
    "describe('FR-001: suite', () => {});",
    "test('checks FR-001 somewhere', () => {});",
    "test('FR-0010: wrong ID boundary', () => {});",
    "test('FR-001-extra: wrong ID boundary', () => {});",
    "other.test('FR-001: unrelated object', () => {});",
    "test('FR-001: no implementation');",
  ].join('\n');
  expect([...testRequirementIds(source)]).toEqual([]);
});

test('T-051: Given skipped todo and dynamically named tests, When tracing, Then they do not imply static named coverage', () => {
  const source = [
    "test.skip('FR-001: skipped', () => {});",
    "it.todo('FR-002: todo');",
    "test.skip.each([1])('FR-003: skipped parameter', () => {});",
    "const name = 'NFR-001: dynamic'; test(name, () => {});",
    'test(`${value}: NFR-002 dynamic prefix`, () => {});',
  ].join('\n');
  expect([...testRequirementIds(source)]).toEqual([]);
});

test('T-051: Given interpolated test names with a fixed literal ID prefix, When traced, Then known prefixes count and ambiguous prefixes do not', () => {
  const source = [
    'test(`NFR-002: engine ${engine}`, () => {});',
    'it(`FR-001: example ${value}`, () => {});',
    'test(`FR-002${suffix}`, () => {});',
    'test(`FR-${id}: dynamic ID`, () => {});',
  ].join('\n');
  expect([...testRequirementIds(source)]).toEqual(['NFR-002', 'FR-001']);
});

test('T-051: Given a skipped enclosing suite, When tracing nested test declarations, Then those tests do not hide gaps', () => {
  const source = [
    "describe.skip('disabled suite', () => { test('FR-001: inactive', () => {}); });",
    "suite.skip('disabled integration', () => { test('NFR-001: inactive', () => {}); });",
    "describe('active suite', () => { it('FR-002: active', () => {}); });",
  ].join('\n');
  expect([...testRequirementIds(source)]).toEqual(['FR-002']);
});

test('T-051: Given coverage in unit and integration sources, When gaps are calculated, Then IDs are unique ordered and only uncovered definitions remain', () => {
  const sources = ["test('FR-001: unit', () => {}); test('FR-001: duplicate', () => {});", "test('NFR-001: integration', async () => {});"];
  expect(findUntestedRequirements(specification, sources)).toEqual(['FR-002', 'FR-003', 'NFR-002']);
  expect(findUntestedRequirements(first, ["test('FR-001: complete', () => {});"])).toEqual([]);
});

async function makeTestTree(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-t051-'));
  temporaryDirectories.push(directory);
  for (const child of ['test/unit/nested', 'src/test', 'test/fixtures', 'out/test']) {
    await mkdir(join(directory, child), { recursive: true });
  }
  await writeFile(join(directory, 'test/unit/nested/one.test.ts'), "test('FR-001: unit', () => {});");
  await writeFile(join(directory, 'src/test/two.test.ts'), "test('NFR-001: integration', () => {});");
  await writeFile(join(directory, 'test/unit/helper.ts'), "test('FR-002: helper', () => {});");
  await writeFile(join(directory, 'test/fixtures/example.test.ts'), "test('FR-003: fixture', () => {});");
  await writeFile(join(directory, 'out/test/stale.test.js'), "test('NFR-002: stale build', () => {});");
  return directory;
}

async function makeCliFixture(script: string): Promise<string> {
  const directory = await makeTestTree();
  await mkdir(join(directory, 'scripts'));
  await mkdir(join(directory, 'specs'));
  const source = await readFile(join(root, 'scripts', script), 'utf8');
  // Use the real helper module and a disposable repository for CLI file errors.
  const helper = pathToFileURL(join(root, 'scripts/spec-tools.mts')).href;
  await writeFile(join(directory, 'scripts', script), source.replace('./spec-tools.mts', helper));
  await writeFile(join(directory, 'specs/SPEC.md'), first + '\n' + nfr);
  return directory;
}

test('T-051: Given no uncovered requirements, When trace runs, Then a clear no-gaps message replaces the list', async () => {
  const directory = await makeCliFixture('trace.mts');
  const { stdout, stderr } = await execute(process.execPath, [join(directory, 'scripts/trace.mts')]);
  expect(stdout).toBe('All FR/NFR requirements have a matching named test.\n');
  expect(stderr).toBe('');
});

test('T-051: Given missing spec files, When ctx runs, Then no partial context or raw stack is printed', async () => {
  const directory = await makeCliFixture('ctx.mts');
  let failure: unknown;
  try { await execute(process.execPath, [join(directory, 'scripts/ctx.mts'), 'T-012']); }
  catch (error: unknown) { failure = error; }
  expect(failure).toMatchObject({ code: 1, stdout: '' });
  if (typeof failure !== 'object' || failure === null || !('stderr' in failure) || typeof failure.stderr !== 'string') {
    throw new Error('Expected a file-read failure with stderr.');
  }
  expect(failure.stderr).toContain('Cannot read');
  expect(failure.stderr).not.toMatch(/\n\s+at /);
});

test('T-051: Given nested tests and stale fixture or compiled files, When sources are collected, Then only repository unit and integration test files count', async () => {
  const sources = await readTestSources(await makeTestTree());
  expect(sources).toHaveLength(2);
  expect(findUntestedRequirements(specification, sources)).toEqual(['FR-002', 'FR-003', 'NFR-002']);
});

test('T-051: Given a missing test directory, When sources are collected, Then a clear failure prevents a misleading coverage report', async () => {
  const directory = await makeTestTree();
  await rm(join(directory, 'src/test'), { recursive: true });
  await expect(readTestSources(directory)).rejects.toThrow(join('src', 'test'));
});

test('T-051: Given the real repository, When ctx runs from another directory, Then its root is stable and exact linked blocks appear', async () => {
  const { stdout, stderr } = await execute(process.execPath, [join(root, 'scripts/ctx.mts'), 'T-012'], { cwd: tmpdir() });
  const actualTasks = await readFile(join(root, 'specs/TASKS.md'), 'utf8');
  const actualSpec = await readFile(join(root, 'specs/SPEC.md'), 'utf8');
  const actualConstitution = await readFile(join(root, 'specs/CONSTITUTION.md'), 'utf8');
  expect(stdout).toBe(buildContext(actualTasks, actualSpec, actualConstitution, 'T-012'));
  expect(stderr).toBe('');
  expect(stdout).toContain('**FR-002');
  expect(stdout).not.toContain('**FR-001');
});

test('T-051: Given real requirement definitions, When trace runs, Then it reports precisely the uncovered IDs without claiming passing tests', async () => {
  const { stdout, stderr } = await execute(process.execPath, [join(root, 'scripts/trace.mts')], { cwd: tmpdir() });
  const actualSpec = await readFile(join(root, 'specs/SPEC.md'), 'utf8');
  const gaps = findUntestedRequirements(actualSpec, await readTestSources(root));
  expect(stdout).toBe('Requirements without a matching named test:\n' + gaps.join('\n') + '\n');
  expect(stderr).toBe('');
});

test('T-051: Given every current task, When its context is built, Then each task resolves without missing definitions', async () => {
  const actualTasks = await readFile('specs/TASKS.md', 'utf8');
  const actualSpec = await readFile('specs/SPEC.md', 'utf8');
  const actualConstitution = await readFile('specs/CONSTITUTION.md', 'utf8');
  const taskIds = [...actualTasks.matchAll(/^- \[[ xX]\] \*\*(T-\d{3})\b/gmu)].map((match) => match[1]);
  expect(taskIds.length).toBeGreaterThan(30);
  for (const taskId of taskIds) {
    if (taskId === undefined) { throw new Error('Task ID was missing.'); }
    const output = buildContext(actualTasks, actualSpec, actualConstitution, taskId);
    expect(output).toContain(taskId);
    expect(output.endsWith(actualConstitution)).toBe(true);
  }
});

test.each([
  ['ctx.mts', [], 'Usage:'], ['ctx.mts', ['T-999'], 'Task T-999 not found'],
  ['ctx.mts', ['../T-012'], 'Usage:'], ['ctx.mts', ['T-012', 'extra'], 'Usage:'],
  ['trace.mts', ['extra'], 'Usage:'],
])('T-051: Given invalid CLI input %s %j, When invoked, Then it exits nonzero with a concise message and no stack trace', async (script, args, message) => {
  let failure: unknown;
  try { await execute(process.execPath, [join(root, 'scripts', script), ...args]); }
  catch (error: unknown) { failure = error; }
  expect(failure).toMatchObject({ code: 1, stdout: '' });
  if (typeof failure !== 'object' || failure === null || !('stderr' in failure) || typeof failure.stderr !== 'string') {
    throw new Error('Expected a CLI failure with stderr.');
  }
  expect(failure.stderr).toContain(message);
  expect(failure.stderr).not.toMatch(/\n\s+at /);
});
