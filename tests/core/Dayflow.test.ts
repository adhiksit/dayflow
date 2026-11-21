import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Dayflow } from '../../src/core/Dayflow.js';
import { MemoryStorageAdapter } from '../../src/storage/MemoryStorage.js';
import { SettableClock } from '../../src/utils/clock.js';

describe('Dayflow Programmatic API', () => {
  let clock: SettableClock;
  let storage: MemoryStorageAdapter;
  let dayflow: Dayflow;

  beforeEach(async () => {
    clock = new SettableClock('2026-11-22T09:00:00.000Z');
    storage = new MemoryStorageAdapter();
    dayflow = new Dayflow({ storage, clock, config: { timezone: 'UTC' } });
    await dayflow.init();
  });

  it('emits typed events on task lifecycle', async () => {
    const onAdded = vi.fn();
    const onCompleted = vi.fn();
    const onReopened = vi.fn();
    const onDeleted = vi.fn();

    dayflow.on('taskAdded', onAdded);
    dayflow.on('taskCompleted', onCompleted);
    dayflow.on('taskReopened', onReopened);
    dayflow.on('taskDeleted', onDeleted);

    const task = await dayflow.addTask({ title: 'Important Project', priority: 'high' });
    expect(onAdded).toHaveBeenCalledWith(task);

    await dayflow.completeTask(task.id);
    expect(onCompleted).toHaveBeenCalled();

    await dayflow.reopenTask(task.id);
    expect(onReopened).toHaveBeenCalled();

    await dayflow.deleteTask(task.id);
    expect(onDeleted).toHaveBeenCalledWith(task.id);
  });

  it('emits events on timer start, pause, resume, and stop', async () => {
    const onTimerStarted = vi.fn();
    const onTimerPaused = vi.fn();
    const onTimerResumed = vi.fn();
    const onTimerStopped = vi.fn();

    dayflow.on('timerStarted', onTimerStarted);
    dayflow.on('timerPaused', onTimerPaused);
    dayflow.on('timerResumed', onTimerResumed);
    dayflow.on('timerStopped', onTimerStopped);

    await dayflow.startTimer('Refactoring');
    expect(onTimerStarted).toHaveBeenCalled();

    clock.advanceMinutes(15);
    await dayflow.pauseTimer();
    expect(onTimerPaused).toHaveBeenCalled();

    clock.advanceMinutes(5);
    await dayflow.resumeTimer();
    expect(onTimerResumed).toHaveBeenCalled();

    clock.advanceMinutes(15);
    const entry = await dayflow.stopTimer();
    expect(onTimerStopped).toHaveBeenCalledWith(entry);
    expect(entry.durationMinutes).toBe(30);
  });

  it('exports and imports data seamlessly', async () => {
    await dayflow.addTask({ title: 'Export Task' });
    await dayflow.logTime({ activity: 'Export log', durationMinutes: 60 });

    const exported = await dayflow.exportData();
    expect(exported.tasks).toHaveLength(1);
    expect(exported.timeEntries).toHaveLength(1);

    const newStorage = new MemoryStorageAdapter();
    const newDayflow = new Dayflow({ storage: newStorage, clock, config: { timezone: 'UTC' } });
    await newDayflow.init();

    await newDayflow.importData(exported);
    const importedTasks = await newDayflow.listTasks();
    expect(importedTasks).toHaveLength(1);
    expect(importedTasks[0]!.title).toBe('Export Task');
  });
});
