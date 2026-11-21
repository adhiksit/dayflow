import os from 'node:os';
import path from 'node:path';

/**
 * Returns OS-appropriate configuration and data directories.
 * Respects DAYFLOW_DATA_DIR environment variable if specified.
 */
export function getDefaultDataDir(): string {
  if (process.env['DAYFLOW_DATA_DIR']) {
    return path.resolve(process.env['DAYFLOW_DATA_DIR']);
  }

  const home = os.homedir();
  const platform = process.platform;

  if (platform === 'win32') {
    const appData =
      process.env['APPDATA'] ||
      (path.win32
        ? path.win32.join(home, 'AppData', 'Roaming')
        : path.join(home, 'AppData', 'Roaming'));
    return path.win32 ? path.win32.join(appData, 'dayflow') : path.join(appData, 'dayflow');
  }

  if (platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', 'dayflow');
  }

  // Linux and other Unix
  const xdgData = process.env['XDG_DATA_HOME'] || path.join(home, '.local', 'share');
  return path.join(xdgData, 'dayflow');
}

export function getDefaultDataFilePath(): string {
  return path.join(getDefaultDataDir(), 'data.json');
}
