import * as vscode from 'vscode';

export async function approveXlsxMemory(bytes: string): Promise<boolean> {
  const proceed: vscode.MessageItem = { title: 'Proceed' }; const cancel: vscode.MessageItem = { title: 'Cancel', isCloseAffordance: true };
  return await vscode.window.showWarningMessage(`This XLSX is ${bytes} bytes, above 100 MB (100,000,000 bytes). XLSX must be expanded into memory; XML and cells can use much more memory than its compressed size. Loading may exhaust memory. The source stays unchanged. Proceed with the memory-bound workbook read?`, { modal: true }, proceed, cancel) === proceed;
}
