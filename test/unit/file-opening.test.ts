import { readFile } from 'node:fs/promises';
import { expect, test, vi } from 'vitest';
import { associationPlan, fileFormat, type AssociationState } from '../../src/editor/file-opening';
vi.mock('vscode', () => ({}));

test.each([['a.csv', 'csv'], ['a.TSV', 'csv'], ['a.json', 'json'], ['a.jsonl', 'json'], ['a.XLSX', 'xlsx'], ['a.db', undefined], ['a.csv.txt', undefined]])(
  'D-5: Given %s, When routing a saved filename, Then its existing loader is %s', (name, format) => { expect(fileFormat(name)).toBe(format); });

const empty: AssociationState = { enabled: false, owned: [] };
test('D-5: Given default-off and unrelated associations, When enabling all formats, Then only missing tabular defaults are added', () => {
  const global = { '*.db': 'lite-voyager.sqlite', '*.md': 'default' };
  expect(associationPlan(false, empty, global, [global])).toEqual({ state: empty, associations: global });
  const enabled = associationPlan(true, empty, global, [global]);
  expect(enabled.state).toEqual({ enabled: true, owned: ['*.csv', '*.tsv', '*.json', '*.jsonl', '*.xlsx'] });
  expect(enabled.associations).toEqual({ ...global, '*.csv': 'lite-voyager.sqlite', '*.tsv': 'lite-voyager.sqlite', '*.json': 'lite-voyager.sqlite', '*.jsonl': 'lite-voyager.sqlite', '*.xlsx': 'lite-voyager.sqlite' });
});
test('D-5: Given explicit user/workspace/folder choices, When enabling, Then broad, path-specific, case-insensitive and complex patterns remain authoritative', () => {
  for (const pattern of ['*', '**/*', '**/special.csv', '*.CSV', '*.{csv,tsv}', '[a-z]*.csv']) {
    expect(associationPlan(true, empty, {}, [{ [pattern]: 'default' }]).state.owned).not.toContain('*.csv');
  }
  const result = associationPlan(true, empty, { '*.csv': 'another' }, [{ '*.csv': 'another' }, { '*.json': 'default' }]);
  expect(result.associations['*.csv']).toBe('another'); expect(result.associations['*.json']).toBeUndefined();
  expect(result.state.owned).toEqual(['*.tsv', '*.jsonl', '*.xlsx']);
});
test('D-5: Given owned defaults then user edits/removals and reload, When reconciling and disabling, Then only unchanged owned entries are removed', () => {
  const first = associationPlan(true, empty, {}, []);
  const edited: Record<string, string> = { ...first.associations, '*.csv': 'default', '*.db': 'mine' }; delete edited['*.json'];
  const reload = associationPlan(true, first.state, edited, [edited]);
  expect(reload.associations).toEqual(edited); expect(reload.state.owned).not.toContain('*.csv'); expect(reload.state.owned).not.toContain('*.json');
  expect(associationPlan(false, reload.state, edited, [edited])).toEqual({ state: empty, associations: { '*.csv': 'default', '*.db': 'mine' } });
});
test('D-5: Given a preexisting Lite Voyager association, When enabling then disabling, Then the feature never claims or removes it', () => {
  const original = { '*.csv': 'lite-voyager.sqlite' }; const on = associationPlan(true, empty, original, [original]);
  expect(on.state.owned).not.toContain('*.csv'); expect(associationPlan(false, on.state, on.associations, []).associations).toEqual(original);
});
test('D-5: Given package contributions, When discovering opening controls, Then one optional editor, local-file menus and default-off application setting are present', async () => {
  const manifest = JSON.parse(await readFile('package.json', 'utf8')) as { contributes: { commands: { command: string; title: string; icon?: string }[];
    menus: Record<string, { command: string; when: string; group: string }[]> } };
  expect(manifest).toMatchObject({ contributes: { configuration: { properties: { 'liteVoyager.openCsvByDefault': { type: 'boolean', default: false, scope: 'application' } } } } });
  expect(manifest.contributes.commands.find((item) => item.command === 'lite-voyager.open')).toEqual({ command: 'lite-voyager.open', title: 'Open in Lite Voyager', icon: '$(table)' });
  for (const menu of ['explorer/context', 'editor/title']) {
    const entry = manifest.contributes.menus[menu]?.find((item) => item.command === 'lite-voyager.open'); expect(entry).toBeDefined();
    expect(entry?.when).toContain('resourceScheme == file'); expect(entry?.group).toBe('navigation');
  }
});
