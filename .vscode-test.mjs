import { defineConfig } from '@vscode/test-cli';
import { build } from 'esbuild';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const outputDirectory = join(root, 'out');
await mkdir(outputDirectory, { recursive: true });
const configuredProfile = process.env.LITE_VOYAGER_TEST_PROFILE;
const profileDirectory = configuredProfile === undefined
	? await mkdtemp(join(outputDirectory, 'integration-profile-'))
	: resolve(configuredProfile);
const relativeProfile = relative(outputDirectory, profileDirectory);
if (!relativeProfile.startsWith('integration-profile-') || dirname(relativeProfile) !== '.') {
	throw new Error('The integration profile must be inside the project output directory.');
}
const settingsDirectory = join(profileDirectory, 'User');
const extensionsDirectory = join(profileDirectory, 'extensions');
const builtinExtensionsDirectory = join(profileDirectory, 'builtin-extensions');
await mkdir(settingsDirectory, { recursive: true });
await mkdir(extensionsDirectory, { recursive: true });
await mkdir(builtinExtensionsDirectory, { recursive: true });
// Prevent VS Code's renderer and shared process racing to create this manifest.
await writeFile(join(extensionsDirectory, 'extensions.json'), '[]\n', { flag: 'wx' });
await writeFile(join(settingsDirectory, 'settings.json'), JSON.stringify({
	'chat.disableAIFeatures': true,
	'extensions.autoUpdate': 'off',
	'extensions.autoCheckUpdates': false,
	// In VS Code 1.140 the signed-out private-gallery route returns a null
	// manifest before any request. This prevents the five-minute background
	// control-report fetch in long offline tests. No user profile is changed.
	'extensions.gallery.serviceUrl': 'http://127.0.0.1:1/lite-voyager-isolated-tests',
	'extensions.gallery.authProvider': 'github',
}, null, 2));

const version = process.env.LITE_VOYAGER_TEST_VSCODE_VERSION ?? '1.140.0';
if (!/^\d+\.\d+\.\d+$/.test(version)) {
	throw new Error('Set LITE_VOYAGER_TEST_VSCODE_VERSION to an exact numeric VS Code version.');
}

// The isolated host needs a signed-out provider for VS Code's startup session
// lookup. This separate development fixture never authenticates or ships.
const authenticationFixture = join(profileDirectory, 'authentication-fixture');
await mkdir(authenticationFixture);
await writeFile(join(authenticationFixture, 'package.json'), JSON.stringify({
	name: 'signed-out-authentication',
	publisher: 'lite-voyager-tests',
	version: '0.0.1',
	license: 'MIT',
	engines: { vscode: '^1.140.0' },
	main: './extension.js',
	contributes: {
		authentication: [{ id: 'github', label: 'Signed-out test fixture' }],
		themes: [
			{ label: 'T-019 Light', uiTheme: 'vs', path: './light.json' },
			{ label: 'T-019 Dark', uiTheme: 'vs-dark', path: './dark.json' },
		],
	},
}, null, 2), { flag: 'wx' });
// Deterministic test themes accompany the isolated development fixture only.
for (const [name, type, foreground, background] of [
	['light', 'light', '#111111', '#ffffff'], ['dark', 'dark', '#eeeeee', '#111111'],
]) {
	await writeFile(join(authenticationFixture, `${name}.json`), JSON.stringify({
		type, colors: { 'editor.foreground': foreground, 'editor.background': background }, tokenColors: [],
	}), { flag: 'wx' });
}
const fixtureBuild = await build({
	entryPoints: [join(root, 'src', 'test', 'fixtures', 'authentication-provider.ts')],
	outfile: join(authenticationFixture, 'extension.js'),
	bundle: true,
	platform: 'node',
	format: 'cjs',
	external: ['vscode'],
});
if (fixtureBuild.warnings.length > 0) {
	throw new Error('The authentication fixture build emitted warnings.');
}

export default defineConfig({
	// Default to the declared minimum; compatibility probes can choose another exact version.
	version,
	extensionDevelopmentPath: [root, authenticationFixture],
	files: 'out/integration/test/**/*.test.js',
	launchArgs: [
		`--user-data-dir=${profileDirectory}`,
		// Test Lite Voyager without unrelated installed or built-in extensions.
		`--extensions-dir=${extensionsDirectory}`,
		`--builtin-extensions-dir=${builtinExtensionsDirectory}`,
		'--disable-extensions',
		'--disable-gpu',
		'--skip-welcome',
		'--skip-release-notes',
		'--disable-workspace-trust',
	],
});
