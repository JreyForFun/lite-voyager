// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { join } from 'node:path';
import { SqliteSpike } from './worker/sqlite-spike';
import { openWebviewSpike } from './webview-spike-panel';
import { openEngineCheck } from './engine-panel';
import { SqliteEditorProvider, SQLITE_EDITOR_VIEW_TYPE } from './editor/sqlite-editor';

async function runSqliteSpike(context: vscode.ExtensionContext, output: vscode.OutputChannel, simulateUnavailable: boolean): Promise<void> {
	const selection = await vscode.window.showOpenDialog({ canSelectMany: false, canSelectFolders: false, filters: { SQLite: ['sqlite', 'sqlite3', 'db'] }, title: 'T-002: Choose a small SQLite fixture' });
	const file = selection?.[0];
	if (file === undefined) { return; }
	if (file.scheme !== 'file') { await vscode.window.showErrorMessage('The SQLite spike needs a local file.'); return; }
	if (simulateUnavailable) {
		const choice = await vscode.window.showInformationMessage('Memory-limited spike mode loads the fixture into memory. This experiment accepts files up to 8 MiB.', { modal: true }, 'Continue');
		if (choice !== 'Continue') { return; }
	}
	const spike = new SqliteSpike(join(context.extensionPath, 'dist/sqlite-spike-worker.js'), { fallbackDirectory: join(context.extensionPath, 'dist'), simulateUnavailable });
	const shutdown = new vscode.Disposable(() => { void spike.close().catch(() => { /* The extension host is shutting down. */ }); });
	context.subscriptions.push(shutdown);
	output.show(true);
	let cancelled = false;
	try {
		await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'T-002 SQLite worker spike', cancellable: true }, async (progress, token) => {
			let cancelTask: Promise<void> | undefined;
			let cancelMs: number | undefined;
			const cancellation = token.onCancellationRequested(() => {
				cancelled = true;
				const started = Date.now();
				cancelTask = spike.cancel().then(() => { cancelMs = Date.now() - started; });
			});
			let heartbeatTicks = 0;
			const timer = setInterval(() => { heartbeatTicks++; }, 100);
			try {
				progress.report({ message: 'Opening the database in a worker…' });
				const opened = await spike.open(file.fsPath);
				output.appendLine(`T-002 opened: ${JSON.stringify({ vscode: vscode.version, platform: process.platform, arch: process.arch, ...opened })}`);
				if (token.isCancellationRequested) { await cancelTask; return; }
				const result = await spike.query('SELECT sqlite_version() AS sqlite_version');
				output.appendLine(`T-002 query: ${JSON.stringify(result)}`);
				progress.report({ message: `${opened.notice} Running a long query. Click Cancel; try moving or typing in another editor.` });
				output.appendLine('T-002 long query starting. Click Cancel in the progress notification.');
				try {
					await spike.query('WITH RECURSIVE n(x) AS (VALUES(0) UNION ALL SELECT x+1 FROM n WHERE x<1000000000) SELECT sum(x) FROM n');
				} catch (error: unknown) {
					if (!token.isCancellationRequested) { throw error; }
				}
				await cancelTask;
				await spike.close();
				await spike.open(file.fsPath);
				const recovered = await spike.query('SELECT 42 AS recovered');
				output.appendLine(`T-002 manual result: ${JSON.stringify({ vscode: vscode.version, ...opened, cancelled: token.isCancellationRequested, cancelMs, heartbeatTicks, recovered: recovered.rows[0]?.[0] === '42' })}`);
			} finally {
				clearInterval(timer);
				cancellation.dispose();
				await cancelTask;
			}
		});
	} catch (error: unknown) {
		if (cancelled) { output.appendLine('T-002 cancelled before the long-query recovery check. Run it again and cancel after the long query starts.'); }
		else {
			const message = error instanceof Error ? error.message : 'The SQLite spike failed. Try a small valid local SQLite fixture.';
			await vscode.window.showErrorMessage(message);
		}
	} finally {
		await spike.close();
		shutdown.dispose();
		const index = context.subscriptions.indexOf(shutdown);
		if (index !== -1) { context.subscriptions.splice(index, 1); }
	}
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "lite-voyager" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('lite-voyager.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from Lite Voyager!');
	});

	context.subscriptions.push(disposable);
	const sqliteEditor = new SqliteEditorProvider(context.extensionPath);
	context.subscriptions.push(sqliteEditor, vscode.window.registerCustomEditorProvider(SQLITE_EDITOR_VIEW_TYPE, sqliteEditor,
		{ supportsMultipleEditorsPerDocument: false }));
	const output = vscode.window.createOutputChannel('Lite Voyager T-002');
	context.subscriptions.push(output,
		vscode.commands.registerCommand('lite-voyager.engineCheck', (file?: vscode.Uri) => openEngineCheck(context, file)),
		vscode.commands.registerCommand('lite-voyager.webviewSpike', () => openWebviewSpike(context)),
		vscode.commands.registerCommand('lite-voyager.sqliteSpike', () => runSqliteSpike(context, output, false)),
		vscode.commands.registerCommand('lite-voyager.sqliteSpikeFallback', () => runSqliteSpike(context, output, true)),
	);
	return { sqliteEditor };
}

// This method is called when your extension is deactivated
export function deactivate() {}
