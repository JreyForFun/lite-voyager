import type { Clipboard } from 'vscode';

/** Verify one native write without retries or retaining clipboard ownership. */
export async function writeClipboard(clipboard: Clipboard, text: string): Promise<void> {
  await clipboard.writeText(text);
  if (await clipboard.readText() !== text) { throw new Error('Clipboard copy could not be verified.'); }
}
