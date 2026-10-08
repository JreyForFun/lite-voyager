// Extend these message types as later tasks add requests and responses.
export interface WebviewToHostMessage {
  type: 'ready';
}

export interface HostToWebviewMessage {
  type: 'error';
  message: string;
  context: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isWebviewMessage(value: unknown): value is WebviewToHostMessage {
  return isRecord(value) && value['type'] === 'ready';
}

export function isHostMessage(value: unknown): value is HostToWebviewMessage {
  return isRecord(value)
    && value['type'] === 'error'
    && typeof value['message'] === 'string'
    && typeof value['context'] === 'string';
}
