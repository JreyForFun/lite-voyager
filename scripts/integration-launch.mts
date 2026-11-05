import { join } from 'node:path';

export function integrationLaunchArgs(profile: string, platform: NodeJS.Platform = process.platform): string[] {
  return [
    `--user-data-dir=${profile}`,
    `--extensions-dir=${join(profile, 'extensions')}`,
    `--builtin-extensions-dir=${join(profile, 'builtin-extensions')}`,
    '--disable-extensions',
    // Controlled macOS/Linux probes: permit the ordinary VS Code renderer.
    // Omission does not establish which backend the host actually selects.
    ...(platform === 'darwin' || platform === 'linux' ? [] : ['--disable-gpu']),
    '--skip-welcome',
    '--skip-release-notes',
    '--disable-workspace-trust',
  ];
}
