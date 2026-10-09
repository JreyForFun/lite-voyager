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
	contributes: { authentication: [{ id: 'github', label: 'Signed-out test fixture' }] },
}, null, 2), { flag: 'wx' });
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
