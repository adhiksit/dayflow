import fs from 'node:fs/promises';
import path from 'node:path';
import { StorageAdapter, DayflowData } from './StorageAdapter.js';
import { DEFAULT_CONFIG } from '../types/config.js';
import { getDefaultDataFilePath } from './paths.js';

export class JsonFileStorageAdapter implements StorageAdapter {
  private filePath: string;

  constructor(filePath?: string) {
    this.filePath = filePath || getDefaultDataFilePath();
  }

  getFilePath(): string {
    return this.filePath;
  }

  async load(): Promise<DayflowData> {
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(content) as DayflowData;
      return this.migrate(parsed);
    } catch (err: unknown) {
      const error = err as NodeJS.ErrnoException;
      if (error.code === 'ENOENT') {
        const defaultData: DayflowData = {
          schemaVersion: 1,
          config: { ...DEFAULT_CONFIG },
          tasks: [],
          timeEntries: [],
          activeTimer: null,
        };
        await this.save(defaultData);
        return defaultData;
      }
      throw new Error(`Failed to load dayflow data from ${this.filePath}: ${error.message}`);
    }
  }

  async save(data: DayflowData): Promise<void> {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });

    // Atomic write: write to unique temporary file in the same directory, then rename
    const tempFile = `${this.filePath}.tmp.${process.pid}.${Date.now()}`;
    const json = JSON.stringify(data, null, 2);

    try {
      await fs.writeFile(tempFile, json, 'utf-8');
      await fs.rename(tempFile, this.filePath);
    } catch (err) {
      // Clean up temp file if rename or write failed
      try {
        await fs.unlink(tempFile);
      } catch {
        // Ignore unlink error
      }
      throw err;
    }
  }

  private migrate(data: DayflowData): DayflowData {
    if (!data.schemaVersion || data.schemaVersion === 1) {
      return {
        schemaVersion: 1,
        config: { ...DEFAULT_CONFIG, ...(data.config || {}) },
        tasks: Array.isArray(data.tasks) ? data.tasks : [],
        timeEntries: Array.isArray(data.timeEntries) ? data.timeEntries : [],
        activeTimer: data.activeTimer || null,
      };
    }
    return data;
  }
}
