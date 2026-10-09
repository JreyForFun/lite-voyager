import { randomBytes } from 'node:crypto';
import * as vscode from 'vscode';
import { isWebviewMessage, SPIKE_ROW_COUNT, type HostToWebviewMessage, type SpikeStatus } from './protocol';
import { createSpikePage, spikeHtml } from './webview-spike';

export function openWebviewSpike(context: vscode.ExtensionContext): Promise<SpikeStatus | undefined> {
  const assets = vscode.Uri.joinPath(context.extensionUri, 'dist');
  const panel = vscode.window.createWebviewPanel('lite-voyager.webviewSpike', 'T-008 editor & grid spike', vscode.ViewColumn.Active,
    { enableScripts: true, localResourceRoots: [assets] });
  context.subscriptions.push(panel);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (status: SpikeStatus | undefined): void => {
      if (settled) { return; }
      settled = true;
      clearTimeout(timer);
      resolve(status);
    };
    const timer = setTimeout(() => {
      void vscode.window.showErrorMessage('T-008 webview did not initialize. Close it, rebuild with npm run build, and reopen the spike.');
      finish(undefined);
    }, 15000);
    const send = (message: HostToWebviewMessage): void => { void panel.webview.postMessage(message); };
    const listener = panel.webview.onDidReceiveMessage((message: unknown) => {
      if (!isWebviewMessage(message)) { send({ type: 'error', context: 'spike', message: 'Invalid spike message. Close and reopen the panel.' }); return; }
      if (message.type === 'ready') { send({ type: 'spikeInit', rowCount: SPIKE_ROW_COUNT }); }
      if (message.type === 'spikePageRequest') { send(createSpikePage(message)); }
      if (message.type === 'spikeStatus' && message.editorReady && message.cachedRows > 0 && message.renderedRows > 0) { finish(message); }
    });
    const disposed = panel.onDidDispose(() => {
      listener.dispose();
      disposed.dispose();
      finish(undefined);
      const index = context.subscriptions.indexOf(panel);
      if (index !== -1) { context.subscriptions.splice(index, 1); }
    });
    panel.webview.html = spikeHtml(panel.webview.cspSource,
      panel.webview.asWebviewUri(vscode.Uri.joinPath(assets, 'webview.js')).toString(),
      panel.webview.asWebviewUri(vscode.Uri.joinPath(assets, 'webview.css')).toString(), randomBytes(16).toString('hex'));
  });
}
