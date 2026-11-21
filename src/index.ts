// Main library exports for Dayflow

export { Dayflow, DayflowOptions } from './core/Dayflow.js';
export { TaskManager, CreateTaskOptions, UpdateTaskOptions } from './core/TaskManager.js';
export { TimeTracker, StartTimerOptions, ManualLogOptions } from './core/TimeTracker.js';
export { ScoreCalculator, ScoreInputs } from './core/ScoreCalculator.js';
export { SummaryEngine } from './core/SummaryEngine.js';

export { StorageAdapter, DayflowData } from './storage/StorageAdapter.js';
export { JsonFileStorageAdapter } from './storage/JsonFileStorage.js';
export { MemoryStorageAdapter } from './storage/MemoryStorage.js';
export { getDefaultDataDir, getDefaultDataFilePath } from './storage/paths.js';

export { Clock, SystemClock, SettableClock } from './utils/clock.js';
export {
  formatDateKey,
  resolveDateString,
  getWeekRange,
  isTimestampOnDate,
  formatDurationMinutes,
  parseDurationToMinutes,
} from './utils/date.js';
export { generateId } from './utils/id.js';

// Types
export * from './types/models.js';
export * from './types/config.js';
export * from './types/score.js';
export * from './types/summary.js';
export * from './types/events.js';
