import { isHostMessage, type WebviewToHostMessage } from '../src/protocol';

interface WebviewApi {
  postMessage(message: WebviewToHostMessage): void;
}

declare function acquireVsCodeApi(): WebviewApi;

const vscode = acquireVsCodeApi();
vscode.postMessage({ type: 'ready' });

window.addEventListener('message', (event: MessageEvent<unknown>) => {
  if (!isHostMessage(event.data)) {
    return;
  }
  const status = document.getElementById('status');
  if (status !== null) {
    status.textContent = event.data.message;
  }
});
