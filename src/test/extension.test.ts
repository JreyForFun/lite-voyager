import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
// import * as myExtension from '../../extension';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('T-006: generated smoke assertion', () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
		assert.strictEqual(-1, [1, 2, 3].indexOf(0));
	});

	test('T-006: Given the installed scaffold, When activated, Then Hello World is registered and runs', async () => {
		const extension = vscode.extensions.getExtension<unknown>('jreyinnovarev.lite-voyager');
		assert.ok(extension, 'The development extension must be loaded.');
		await extension.activate();
		assert.ok(extension.isActive);
		const commands = await vscode.commands.getCommands(true);
		assert.ok(commands.includes('lite-voyager.helloWorld'));
		await vscode.commands.executeCommand<void>('lite-voyager.helloWorld');
	});
});
