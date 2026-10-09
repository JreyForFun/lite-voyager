import { defineConfig } from '@vscode/test-cli';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const outputDirectory = join(dirname(fileURLToPath(import.meta.url)), 'out');
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
await writeFile(join(settingsDirectory, 'settings.json'), JSON.stringify({
	'chat.disableAIFeatures': true,
}, null, 2));

const version = process.env.LITE_VOYAGER_TEST_VSCODE_VERSION ?? '1.140.0';
if (!/^\d+\.\d+\.\d+$/.test(version)) {
	throw new Error('Set LITE_VOYAGER_TEST_VSCODE_VERSION to an exact numeric VS Code version.');
}

export default defineConfig({
	// Default to the declared minimum; compatibility probes can choose another exact version.
	version,
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
