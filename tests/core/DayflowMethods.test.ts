import { describe, it, expect, beforeEach } from 'vitest';
import * as IndexExports from '../../src/index.js';
import { Dayflow } from '../../src/core/Dayflow.js';
import { MemoryStorageAdapter } from '../../src/storage/MemoryStorage.js';
import { SettableClock, SystemClock } from '../../src/utils/clock.js';
import { formatJson } from '../../src/cli/formatters/json.js';
import { resolveDateString } from '../../src/utils/date.js';

describe('Dayflow Complete API & Index Exports', () => {
  let clock: SettableClock;
  let storage: MemoryStorageAdapter;
  let dayflow: Dayflow;

  beforeEach(async () => {
    clock = new SettableClock('2026-11-22T09:00:00.000Z');
    storage = new MemoryStorageAdapter();
    dayflow = new Dayflow({ storage, clock, config: { timezone: 'UTC' } });
    await dayflow.init();
  });

  it('exports all expected library classes, functions, and adapters from index', () => {
    expect(IndexExports.Dayflow).toBeDefined();
    expect(IndexExports.TaskManager).toBeDefined();
    expect(IndexExports.TimeTracker).toBeDefined();
    expect(IndexExports.ScoreCalculator).toBeDefined();
    expect(IndexExports.SummaryEngine).toBeDefined();
    expect(IndexExports.MemoryStorageAdapter).toBeDefined();
    expect(IndexExports.JsonFileStorageAdapter).toBeDefined();
    expect(IndexExports.SystemClock).toBeDefined();
    expect(IndexExports.SettableClock).toBeDefined();
    expect(IndexExports.generateId).toBeDefined();
    expect(IndexExports.formatDateKey).toBeDefined();
    expect(IndexExports.getWeekRange).toBeDefined();
  });

  it('tests SystemClock and SettableClock methods', () => {
    const sysClock = new SystemClock();
    expect(sysClock.now()).toBeInstanceOf(Date);

    const sClock = new SettableClock();
    sClock.setTime('2026-01-01T00:00:00.000Z');
    expect(sClock.now().toISOString()).toBe('2026-01-01T00:00:00.000Z');

    sClock.advanceSeconds(30);
    expect(sClock.now().toISOString()).toBe('2026-01-01T00:00:30.000Z');

    sClock.advanceDays(2);
    expect(sClock.now().toISOString()).toBe('2026-01-03T00:00:30.000Z');
  });

  it('tests formatJson utility', () => {
    const output = formatJson({ a: 1, b: 'test' });
    expect(output).toBe('{\n  "a": 1,\n  "b": "test"\n}');
  });

  it('tests resolveDateString keywords', () => {
    const now = new Date('2026-11-22T12:00:00.000Z');
    expect(resolveDateString('today', now, 'UTC')).toBe('2026-11-22');
    expect(resolveDateString('yesterday', now, 'UTC')).toBe('2026-11-21');
    expect(resolveDateString('tomorrow', now, 'UTC')).toBe('2026-11-23');
    expect(resolveDateString('2026-11-20', now, 'UTC')).toBe('2026-11-20');
    expect(() => resolveDateString('not-a-date-at-all-xyz', now, 'UTC')).toThrow();
  });

  it('executes Dayflow config, summaries, task operations, and scoring', async () => {
    // Config
    const initialConfig = dayflow.getConfig();
    expect(initialConfig.targetFocusMinutes).toBe(240);

    const updatedConfig = await dayflow.updateConfig({
      targetFocusMinutes: 180,
      weekStartsOn: 'sunday',
    });
    expect(updatedConfig.targetFocusMinutes).toBe(180);
    expect(updatedConfig.weekStartsOn).toBe('sunday');

    // Add task and start timer tied to task
    const task = await dayflow.addTask({
      title: 'Implement Core Engine',
      priority: 'high',
      estimate: 60,
      dueDate: '2026-11-22',
      tag: 'deep work',
    });
    expect(task.title).toBe('Implement Core Engine');

    const retrievedTask = await dayflow.getTask(task.id);
    expect(retrievedTask?.id).toBe(task.id);

    // Start timer by task ID
    const { timer } = await dayflow.startTimer(task.id);
    expect(timer.taskId).toBe(task.id);

    // Status
    const status = await dayflow.getTimerStatus();
    expect(status.active).toBe(true);

    clock.advanceMinutes(60);
    await dayflow.stopTimer();
    await dayflow.completeTask(task.id);

    // Daily summary
    const dailySummary = await dayflow.getDailySummary('2026-11-22');
    expect(dailySummary.tasksCompleted).toHaveLength(1);
    expect(dailySummary.focusTimeMinutes).toBe(60);
    expect(dailySummary.score.score).toBeGreaterThan(0);

    // Score method
    const score = await dayflow.getScore('2026-11-22');
    expect(score.date).toBe('2026-11-22');

    // Weekly summary
    const weeklySummary = await dayflow.getWeeklySummary('2026-11-22');
    expect(weeklySummary.totalTasksDone).toBe(1);

    // Time entries
    const entries = await dayflow.getTimeEntries('2026-11-22');
    expect(entries).toHaveLength(1);

    const allEntries = await dayflow.getTimeEntries();
    expect(allEntries).toHaveLength(1);

    // List tasks with date filter 'today'
    const todayTasks = await dayflow.listTasks({ date: 'today' });
    expect(todayTasks).toHaveLength(1);
    expect(todayTasks[0]?.id).toBe(task.id);
  });
});
