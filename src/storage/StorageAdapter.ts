import { Task, TimeEntry, ActiveTimer } from '../types/models.js';
import { DayflowConfig } from '../types/config.js';

export interface DayflowData {
  schemaVersion: number;
  config: DayflowConfig;
  tasks: Task[];
  timeEntries: TimeEntry[];
  activeTimer: ActiveTimer | null;
}

export interface StorageAdapter {
  load(): Promise<DayflowData>;
  save(data: DayflowData): Promise<void>;
}
