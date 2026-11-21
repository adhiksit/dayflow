import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDefaultDataDir, getDefaultDataFilePath } from '../../src/storage/paths.js';

describe('Storage paths', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('respects DAYFLOW_DATA_DIR environment variable', () => {
    process.env['DAYFLOW_DATA_DIR'] = '/custom/dayflow/path';
    expect(getDefaultDataDir()).toBe('/custom/dayflow/path');
    expect(getDefaultDataFilePath()).toBe('/custom/dayflow/path/data.json');
  });

  it('returns default path for current platform', () => {
    delete process.env['DAYFLOW_DATA_DIR'];
    const dir = getDefaultDataDir();
    expect(dir).toContain('dayflow');
    const filePath = getDefaultDataFilePath();
    expect(filePath.endsWith('data.json')).toBe(true);
  });
});
