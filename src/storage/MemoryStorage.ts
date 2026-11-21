import { StorageAdapter, DayflowData } from './StorageAdapter.js';
import { DEFAULT_CONFIG } from '../types/config.js';

export class MemoryStorageAdapter implements StorageAdapter {
  private data: DayflowData;

  constructor(initialData?: Partial<DayflowData>) {
    this.data = {
      schemaVersion: 1,
      config: { ...DEFAULT_CONFIG, ...(initialData?.config || {}) },
      tasks: initialData?.tasks ? [...initialData.tasks] : [],
      timeEntries: initialData?.timeEntries ? [...initialData.timeEntries] : [],
      activeTimer: initialData?.activeTimer || null,
    };
  }

  async load(): Promise<DayflowData> {
    return JSON.parse(JSON.stringify(this.data));
  }

  async save(data: DayflowData): Promise<void> {
    this.data = JSON.parse(JSON.stringify(data));
  }
}
