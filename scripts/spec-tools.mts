import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import ts from 'typescript';

interface MarkdownLine {
  text: string;
  start: number;
  visible: boolean;
}

// Keep source offsets so context excerpts preserve the original wording and CRLF.
function markdownLines(text: string): MarkdownLine[] {
  let offset = 0;
  let fence: string | undefined;
  return text.split(/(?<=\n)/u).map((raw) => {
    const line = raw.trimEnd();
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/u.exec(line);
    const visible = fence === undefined && marker === null;
    if (marker !== null) {
      const token = marker[1];
      if (token !== undefined) {
        if (fence === undefined) {
          fence = token;
        } else if (token[0] === fence[0] && token.length >= fence.length && marker[2]?.trim() === '') {
          fence = undefined;
        }
      }
    }
    const result = { text: line, start: offset, visible };
    offset += raw.length;
    return result;
  });
}

function definitionId(line: string): string | undefined {
  return /^\*\*((?:FR|NFR)-\d{3})\b/u.exec(line)?.[1]
    ?? /^\|\s*((?:FR|NFR)-\d{3})\s*\|/u.exec(line)?.[1];
}

export function parseRequirements(specification: string): Map<string, string> {
  const lines = markdownLines(specification);
  const requirements = new Map<string, string>();
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (line === undefined || !line.visible) { continue; }
    const id = definitionId(line.text);
    if (id === undefined) { continue; }
    if (requirements.has(id)) { throw new Error(`Duplicate requirement ${id} in specs/SPEC.md.`); }
    let end = specification.length;
    if (line.text.startsWith('|')) {
      end = lines[index + 1]?.start ?? end;
    } else {
      for (const next of lines.slice(index + 1)) {
        if (next.visible && (definitionId(next.text) !== undefined || /^#{1,6}\s/u.test(next.text))) {
          end = next.start;
          break;
        }
      }
    }
    requirements.set(id, specification.slice(line.start, end).replace(/(?:\r?\n)+$/u, ''));
  }
  if (requirements.size === 0) { throw new Error('No FR/NFR requirement definitions found in specs/SPEC.md.'); }
  return requirements;
}

function taskRequirements(task: string): string[] {
  const ids = new Set<string>();
  const links = /\b((?:FR|NFR)-\d{3})\b(?:\s*(?:to|[-–—])\s*((?:FR|NFR)-\d{3})\b)?/gu;
  for (const match of task.matchAll(links)) {
    const start = match[1];
    const end = match[2];
    if (start === undefined) { continue; }
    if (end === undefined) {
      ids.add(start);
      continue;
    }
    const prefix = start.slice(0, -3);
    const first = Number(start.slice(-3));
    const last = Number(end.slice(-3));
    if (prefix !== end.slice(0, -3) || last < first) {
      throw new Error(`Invalid requirement range ${start} to ${end}.`);
    }
    for (let number = first; number <= last; number++) {
      ids.add(prefix + String(number).padStart(3, '0'));
    }
  }
  return [...ids];
}

export function buildContext(tasks: string, specification: string, constitution: string, taskId: string): string {
  if (!/^T-\d{3}$/u.test(taskId)) { throw new Error('Usage: npm run ctx -- T-012 (one task ID in T-000 format).'); }
  const matching = markdownLines(tasks).filter((line) => line.visible &&
    /^- \[[ xX]\] \*\*(T-\d{3})\b/u.exec(line.text)?.[1] === taskId);
  const task = matching[0]?.text;
  if (task === undefined) { throw new Error(`Task ${taskId} not found in specs/TASKS.md.`); }
  if (matching.length > 1) { throw new Error(`Duplicate task ${taskId} in specs/TASKS.md.`); }
  const requirements = parseRequirements(specification);
  const blocks = taskRequirements(task).map((id) => {
    const block = requirements.get(id);
    if (block === undefined) { throw new Error(`Requirement ${id} not found in specs/SPEC.md (linked by ${taskId}).`); }
    return block;
  });
  const linked = blocks.length === 0 ? 'No FR/NFR requirements linked by this task.' : blocks.join('\n\n');
  return `# Task\n\n${task}\n\n# Linked requirements\n\n${linked}\n\n# Constitution\n\n${constitution}` +
    (constitution.endsWith('\n') ? '' : '\n');
}

interface TestCall {
  name: string;
  modifiers: string[];
}

function testCall(expression: ts.Expression): TestCall | undefined {
  if (ts.isIdentifier(expression)) { return { name: expression.text, modifiers: [] }; }
  if (ts.isPropertyAccessExpression(expression)) {
    const parent = testCall(expression.expression);
    if (parent !== undefined) { return { name: parent.name, modifiers: [...parent.modifiers, expression.name.text] }; }
  }
  if (ts.isCallExpression(expression) || ts.isTaggedTemplateExpression(expression)) {
    return testCall(ts.isCallExpression(expression) ? expression.expression : expression.tag);
  }
  return undefined;
}

function requirementPrefix(name: ts.Expression): string | undefined {
  if (ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name)) {
    return /^((?:FR|NFR)-\d{3})(?=$|[^\w-])/u.exec(name.text)?.[1];
  }
  if (ts.isTemplateExpression(name)) {
    // The delimiter must precede interpolation: `FR-001${suffix}` could become FR-0010.
    return /^((?:FR|NFR)-\d{3})(?=[^\w-])/u.exec(name.head.text)?.[1];
  }
  return undefined;
}

// Parse declarations without importing/executing test files. TypeScript is already
// a development dependency; comments and strings containing fake calls are not AST calls.
export function testRequirementIds(source: string): Set<string> {
  const file = ts.createSourceFile('test.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const names = new Set(['test', 'it']); // Mocha TDD/BDD globals in src/test.
  const suites = new Set(['describe', 'suite']);
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) ||
        !['vitest', 'mocha'].includes(statement.moduleSpecifier.text)) { continue; }
    const bindings = statement.importClause?.namedBindings;
    if (bindings !== undefined && ts.isNamedImports(bindings)) {
      for (const item of bindings.elements) {
        if (['test', 'it'].includes(item.propertyName?.text ?? item.name.text)) { names.add(item.name.text); }
        if (['describe', 'suite'].includes(item.propertyName?.text ?? item.name.text)) { suites.add(item.name.text); }
      }
    }
  }
  const ids = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const call = testCall(node.expression);
      const disabled = call?.modifiers.some((modifier) => ['skip', 'todo'].includes(modifier)) ?? false;
      if (call !== undefined && disabled && (names.has(call.name) || suites.has(call.name))) { return; }
      const name = node.arguments[0];
      const implementation = node.arguments[1];
      if (call !== undefined && names.has(call.name) &&
          name !== undefined && implementation !== undefined) {
        const id = requirementPrefix(name);
        if (id !== undefined) { ids.add(id); }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return ids;
}

export function findUntestedRequirements(specification: string, sources: readonly string[]): string[] {
  const tested = new Set(sources.flatMap((source) => [...testRequirementIds(source)]));
  return [...parseRequirements(specification).keys()].filter((id) => !tested.has(id));
}

export async function readText(path: string): Promise<string> {
  try { return await readFile(path, 'utf8'); }
  catch (error: unknown) { throw new Error(`Cannot read ${path}: ${error instanceof Error ? error.message : String(error)}`); }
}

async function collectTests(directory: string): Promise<string[]> {
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); }
  catch (error: unknown) { throw new Error(`Cannot read test directory ${directory}: ${error instanceof Error ? error.message : String(error)}`); }
  const sources: string[] = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      sources.push(...await collectTests(path));
    } else if (entry.isFile() && entry.name.endsWith('.test.ts')) {
      sources.push(await readText(path));
    } else if (entry.isSymbolicLink()) {
      throw new Error(`Cannot trace symbolic link ${path}; use regular test files and directories.`);
    }
  }
  return sources;
}

export async function readTestSources(root: string): Promise<string[]> {
  const sources = await Promise.all(['test/unit', 'src/test'].map((directory) => collectTests(join(root, directory))));
  return sources.flat();
}
