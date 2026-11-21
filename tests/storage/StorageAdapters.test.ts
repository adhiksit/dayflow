import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { JsonFileStorageAdapter } from '../../src/storage/JsonFileStorage.js';
import { MemoryStorageAdapter } from '../../src/storage/MemoryStorage.js';

describe('Storage Adapters', () => {
  it('MemoryStorageAdapter stores and retrieves copies safely', async () => {
    const mem = new MemoryStorageAdapter();
    const initial = await mem.load();
    expect(initial.tasks).toEqual([]);

    initial.tasks.push({
      id: 't_test',
      title: 'Memory task',
      priority: 'low',
      status: 'todo',
      createdAt: new Date().toISOString(),
    });

    await mem.save(initial);
    const retrieved = await mem.load();
    expect(retrieved.tasks).toHaveLength(1);
    expect(retrieved.tasks[0]?.title).toBe('Memory task');
  });

  it('JsonFileStorageAdapter writes atomically and handles missing files', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dayflow-test-'));
    const testFile = path.join(tmpDir, 'data.json');

    try {
      const adapter = new JsonFileStorageAdapter(testFile);

      // Loading non-existent file creates default structure
      const data = await adapter.load();
      expect(data.schemaVersion).toBe(1);
      expect(data.tasks).toEqual([]);
      expect(data.timeEntries).toEqual([]);

      // Verify file was written to disk
      const diskContent = JSON.parse(await fs.readFile(testFile, 'utf-8'));
      expect(diskContent.schemaVersion).toBe(1);

      // Save custom data
      data.tasks.push({
        id: 't_file',
        title: 'File task',
        priority: 'high',
        status: 'done',
        createdAt: '2026-11-22T10:00:00.000Z',
      });
      await adapter.save(data);

      // Reload
      const reloaded = await adapter.load();
      expect(reloaded.tasks).toHaveLength(1);
      expect(reloaded.tasks[0]?.id).toBe('t_file');

      // Verify no temporary files were left over
      const files = await fs.readdir(tmpDir);
      expect(files).toEqual(['data.json']);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('migrates legacy or incomplete schema objects smoothly', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dayflow-migrate-'));
    const testFile = path.join(tmpDir, 'legacy.json');

    try {
      // Incomplete data without config or schemaVersion
      await fs.writeFile(
        testFile,
        JSON.stringify({ tasks: [{ id: 't_old', title: 'Old' }] }),
        'utf-8',
      );

      const adapter = new JsonFileStorageAdapter(testFile);
      const migrated = await adapter.load();

      expect(migrated.schemaVersion).toBe(1);
      expect(migrated.config).toBeDefined();
      expect(migrated.timeEntries).toEqual([]);
      expect(migrated.tasks).toHaveLength(1);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});
