import { expect, test } from 'vitest';
import { completionReady } from '../../src/test/completion-readiness';

test('FR-012: Given retained completion labels while CodeMirror is pending or closed, When the host test prepares a keypress, Then only an active matching popup on an idle host is ready', () => {
  const completion = { open: true, labels: ['quote"name'], selected: 'quote"name', notice: '' };
  const ready = { busy: false, completion };
  expect(completionReady(ready, 'quote"name')).toBe(true);
  for (const status of [undefined, { busy: false }, { ...ready, busy: true },
    { ...ready, completion: { ...completion, open: false } },
    { ...ready, completion: { ...completion, labels: ['other'] } }]) {
    expect(completionReady(status, 'quote"name')).toBe(false);
  }
});
