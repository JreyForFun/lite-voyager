import type { BrowserStatus } from '../protocol';

export function completionReady(status: Pick<BrowserStatus, 'busy' | 'completion'> | undefined, label: string): boolean {
  return status !== undefined && !status.busy && status.completion?.open === true && status.completion.labels.includes(label);
}
