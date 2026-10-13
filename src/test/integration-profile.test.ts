import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';

suite('T-007 isolated integration profile', () => {
  test('T-007: Given the isolated host, When GitHub sessions are requested silently, Then the test fixture supplies the signed-out state', async () => {
    const fixture = vscode.extensions.getExtension<unknown>('lite-voyager-tests.signed-out-authentication');
    assert.ok(fixture, 'The signed-out authentication fixture must be loaded.');
    const session = await vscode.authentication.getSession('github', [], { silent: true });
    assert.equal(session, undefined);
    const configuration = vscode.workspace.getConfiguration('extensions');
    assert.equal(configuration.get('autoUpdate'), 'off');
    assert.equal(configuration.get('autoCheckUpdates'), false);
    assert.equal(configuration.get('gallery.serviceUrl'), 'http://127.0.0.1:1/lite-voyager-isolated-tests');
    assert.equal(configuration.get('gallery.authProvider'), 'github');
    assert.ok(fixture.isActive, 'The authentication request must activate the fixture.');
  });
});
