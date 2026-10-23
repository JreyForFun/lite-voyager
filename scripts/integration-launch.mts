import { join } from 'node:path';

export function integrationLaunchArgs(profile: string, platform: NodeJS.Platform = process.platform): string[] {
  return [
    `--user-data-dir=${profile}`,
    `--extensions-dir=${join(profile, 'extensions')}`,
    `--builtin-extensions-dir=${join(profile, 'builtin-extensions')}`,
    '--disable-extensions',
    // Controlled macOS probe: permit the ordinary VS Code renderer. Removing
    // this switch does not establish which backend the host actually selects.
    ...(platform === 'darwin' ? [] : ['--disable-gpu']),
    '--skip-welcome',
    '--skip-release-notes',
    '--disable-workspace-trust',
  ];
}
