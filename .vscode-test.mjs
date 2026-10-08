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
await mkdir(settingsDirectory, { recursive: true });
await writeFile(join(settingsDirectory, 'settings.json'), JSON.stringify({
	'chat.disableAIFeatures': true,
}, null, 2));

export default defineConfig({
	// Exercise the currently declared minimum; T-002 will measure compatibility.
	version: '1.140.0',
	files: 'out/integration/test/**/*.test.js',
	launchArgs: [
		`--user-data-dir=${profileDirectory}`,
		'--disable-extensions',
		'--disable-gpu',
		'--skip-welcome',
		'--skip-release-notes',
		'--disable-workspace-trust',
	],
});
