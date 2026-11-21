import { EventEmitter } from 'node:events';
import { Task, TimeEntry, ActiveTimer, TaskFilter, ActivityCategory } from '../types/models.js';
import { DayflowConfig, DEFAULT_CONFIG } from '../types/config.js';
import { ProductivityScore } from '../types/score.js';
import { DailySummary, WeeklySummary } from '../types/summary.js';
import { DayflowEvents } from '../types/events.js';
import { StorageAdapter, DayflowData } from '../storage/StorageAdapter.js';
import { JsonFileStorageAdapter } from '../storage/JsonFileStorage.js';
import { Clock, SystemClock } from '../utils/clock.js';
import { TaskManager, CreateTaskOptions, UpdateTaskOptions } from './TaskManager.js';
import { TimeTracker, ManualLogOptions } from './TimeTracker.js';
import { ScoreCalculator } from './ScoreCalculator.js';
import { SummaryEngine } from './SummaryEngine.js';
import { resolveDateString } from '../utils/date.js';

export interface DayflowOptions {
  storage?: StorageAdapter;
  clock?: Clock;
  config?: Partial<DayflowConfig>;
}

export class Dayflow extends EventEmitter {
  private storage: StorageAdapter;
  private clock: Clock;
  private config: DayflowConfig;
  private tasks: Task[] = [];
  private timeEntries: TimeEntry[] = [];
  private activeTimer: ActiveTimer | null = null;
  private isLoaded = false;

  private taskManager!: TaskManager;
  private timeTracker!: TimeTracker;

  constructor(options: DayflowOptions = {}) {
    super();
    this.storage = options.storage || new JsonFileStorageAdapter();
    this.clock = options.clock || new SystemClock();
    this.config = { ...DEFAULT_CONFIG, ...(options.config || {}) };
  }

  // Strongly typed event listener helpers
  override on<E extends keyof DayflowEvents>(event: E, listener: DayflowEvents[E]): this {
    return super.on(event, listener as (...args: unknown[]) => void);
  }

  override emit<E extends keyof DayflowEvents>(
    event: E,
    ...args: Parameters<DayflowEvents[E]>
  ): boolean {
    return super.emit(event, ...args);
  }

  /**
   * Initializes Dayflow by loading state from storage adapter.
   */
  async init(): Promise<this> {
    if (this.isLoaded) return this;

    const data = await this.storage.load();
    this.config = { ...DEFAULT_CONFIG, ...(data.config || {}) };
    this.tasks = Array.isArray(data.tasks) ? data.tasks : [];
    this.timeEntries = Array.isArray(data.timeEntries) ? data.timeEntries : [];
    this.activeTimer = data.activeTimer || null;

    this.initManagers();
    this.isLoaded = true;
    return this;
  }

  private initManagers(): void {
    this.taskManager = new TaskManager(this.tasks, this.clock, this.config.timezone);
    this.timeTracker = new TimeTracker(
      this.timeEntries,
      this.activeTimer,
      this.clock,
      this.config.timezone,
    );
  }

  private async ensureLoaded(): Promise<void> {
    if (!this.isLoaded) {
      await this.init();
    }
  }

  private async persist(): Promise<void> {
    const data: DayflowData = {
      schemaVersion: 1,
      config: this.config,
      tasks: this.tasks,
      timeEntries: this.timeEntries,
      activeTimer: this.timeTracker.getActiveTimer(),
    };
    await this.storage.save(data);
  }

  // --- CONFIG ---

  getConfig(): DayflowConfig {
    return { ...this.config };
  }

  async updateConfig(updates: Partial<DayflowConfig>): Promise<DayflowConfig> {
    await this.ensureLoaded();
    this.config = {
      ...this.config,
      ...updates,
      weights: { ...this.config.weights, ...(updates.weights || {}) },
      penalties: { ...this.config.penalties, ...(updates.penalties || {}) },
      bonuses: { ...this.config.bonuses, ...(updates.bonuses || {}) },
    };
    this.initManagers();
    await this.persist();
    return { ...this.config };
  }

  // --- TASKS ---

  async addTask(options: CreateTaskOptions): Promise<Task> {
    await this.ensureLoaded();
    const task = this.taskManager.addTask(options);
    await this.persist();
    this.emit('taskAdded', task);
    return task;
  }

  async updateTask(id: string, updates: UpdateTaskOptions): Promise<Task> {
    await this.ensureLoaded();
    const task = this.taskManager.updateTask(id, updates);
    await this.persist();
    this.emit('taskUpdated', task);
    return task;
  }

  async completeTask(id: string): Promise<Task> {
    await this.ensureLoaded();
    const task = this.taskManager.completeTask(id);
    await this.persist();
    this.emit('taskCompleted', task);
    return task;
  }

  async reopenTask(id: string): Promise<Task> {
    await this.ensureLoaded();
    const task = this.taskManager.reopenTask(id);
    await this.persist();
    this.emit('taskReopened', task);
    return task;
  }

  async deleteTask(id: string): Promise<Task> {
    await this.ensureLoaded();
    const task = this.taskManager.deleteTask(id);
    await this.persist();
    this.emit('taskDeleted', id);
    return task;
  }

  async listTasks(filter?: TaskFilter): Promise<Task[]> {
    await this.ensureLoaded();
    const resolvedFilter = filter ? { ...filter } : undefined;
    if (resolvedFilter?.date) {
      resolvedFilter.date = resolveDateString(
        resolvedFilter.date,
        this.clock.now(),
        this.config.timezone,
      );
    }
    return this.taskManager.listTasks(resolvedFilter);
  }

  async getTask(id: string): Promise<Task | undefined> {
    await this.ensureLoaded();
    return this.taskManager.getTask(id);
  }

  // --- TIME TRACKING ---

  async startTimer(
    target: string,
    category?: ActivityCategory,
  ): Promise<{ timer: ActiveTimer; previousEntry?: TimeEntry }> {
    await this.ensureLoaded();

    // Check if target is a task ID
    const task = this.taskManager.getTask(target);
    let activity = target;
    let taskId: string | undefined;

    if (task) {
      activity = task.title;
      taskId = task.id;
      if (task.status === 'todo') {
        this.taskManager.updateTask(task.id, { status: 'in-progress' });
      }
    }

    const result = this.timeTracker.startTimer({
      activity,
      category: category || (task?.tag ? task.tag : 'deep work'),
      taskId,
    });

    if (result.previousEntry) {
      this.emit('timerStopped', result.previousEntry);
    }

    await this.persist();
    this.emit('timerStarted', result.newTimer);
    return { timer: result.newTimer, previousEntry: result.previousEntry };
  }

  async stopTimer(): Promise<TimeEntry> {
    await this.ensureLoaded();
    const entry = this.timeTracker.stopTimer();
    await this.persist();
    this.emit('timerStopped', entry);
    return entry;
  }

  async pauseTimer(): Promise<ActiveTimer> {
    await this.ensureLoaded();
    const timer = this.timeTracker.pauseTimer();
    await this.persist();
    this.emit('timerPaused', timer);
    return timer;
  }

  async resumeTimer(): Promise<ActiveTimer> {
    await this.ensureLoaded();
    const timer = this.timeTracker.resumeTimer();
    await this.persist();
    this.emit('timerResumed', timer);
    return timer;
  }

  async getTimerStatus() {
    await this.ensureLoaded();
    return this.timeTracker.getStatus();
  }

  async logTime(options: ManualLogOptions): Promise<TimeEntry> {
    await this.ensureLoaded();
    const entry = this.timeTracker.logManualTime(options);
    await this.persist();
    this.emit('timeLogged', entry);
    return entry;
  }

  async getTimeEntries(dateKey?: string): Promise<TimeEntry[]> {
    await this.ensureLoaded();
    if (dateKey) {
      const resolved = resolveDateString(dateKey, this.clock.now(), this.config.timezone);
      return this.timeTracker.getEntriesForDate(resolved);
    }
    return this.timeTracker.getTimeEntries();
  }

  // --- SCORES & SUMMARIES ---

  async getScore(date?: string): Promise<ProductivityScore> {
    await this.ensureLoaded();
    const resolvedDate = resolveDateString(date, this.clock.now(), this.config.timezone);
    const streakDays = ScoreCalculator.calculateStreak(
      resolvedDate,
      this.tasks,
      this.timeEntries,
      this.config,
    );

    const score = ScoreCalculator.calculate({
      dateKey: resolvedDate,
      tasks: this.tasks,
      timeEntries: this.timeEntries,
      config: this.config,
      streakDays,
    });

    this.emit('scoreUpdated', score);
    return score;
  }

  async getDailySummary(date?: string): Promise<DailySummary> {
    await this.ensureLoaded();
    const resolvedDate = resolveDateString(date, this.clock.now(), this.config.timezone);
    return SummaryEngine.generateDailySummary(
      resolvedDate,
      this.tasks,
      this.timeEntries,
      this.config,
    );
  }

  async getWeeklySummary(weekDate?: string): Promise<WeeklySummary> {
    await this.ensureLoaded();
    const resolvedDate = resolveDateString(weekDate, this.clock.now(), this.config.timezone);
    return SummaryEngine.generateWeeklySummary(
      resolvedDate,
      this.tasks,
      this.timeEntries,
      this.config,
    );
  }

  // --- EXPORT & IMPORT ---

  async exportData(): Promise<DayflowData> {
    await this.ensureLoaded();
    return {
      schemaVersion: 1,
      config: this.config,
      tasks: this.tasks,
      timeEntries: this.timeEntries,
      activeTimer: this.timeTracker.getActiveTimer(),
    };
  }

  async importData(data: DayflowData): Promise<void> {
    await this.ensureLoaded();
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid dayflow import data format.');
    }

    this.config = { ...DEFAULT_CONFIG, ...(data.config || {}) };
    this.tasks = Array.isArray(data.tasks) ? data.tasks : [];
    this.timeEntries = Array.isArray(data.timeEntries) ? data.timeEntries : [];
    this.activeTimer = data.activeTimer || null;

    this.initManagers();
    await this.persist();
  }
}
