import { describe, it, expect, beforeEach } from 'vitest';
import { TimeTracker } from '../../src/core/TimeTracker.js';
import { SettableClock } from '../../src/utils/clock.js';
import { TimeEntry, ActiveTimer } from '../../src/types/models.js';

describe('TimeTracker', () => {
  let clock: SettableClock;
  let entries: TimeEntry[];
  let activeTimer: ActiveTimer | null;
  let tracker: TimeTracker;

  beforeEach(() => {
    clock = new SettableClock('2026-11-22T09:00:00.000Z');
    entries = [];
    activeTimer = null;
    tracker = new TimeTracker(entries, activeTimer, clock, 'UTC');
  });

  it('starts a timer cleanly and returns status', () => {
    const { newTimer } = tracker.startTimer({ activity: 'Writing code', category: 'deep work' });
    expect(newTimer.id).toMatch(/^tm_/);
    expect(newTimer.activity).toBe('Writing code');
    expect(newTimer.category).toBe('deep work');
    expect(tracker.getActiveTimer()).toBe(newTimer);

    clock.advanceMinutes(25);
    const status = tracker.getStatus();
    expect(status.active).toBe(true);
    expect(status.timer?.elapsedSeconds).toBe(25 * 60);
    expect(status.timer?.isPaused).toBe(false);
  });

  it('stops a timer and logs entry', () => {
    tracker.startTimer({ activity: 'Debugging' });
    clock.advanceMinutes(45);

    const entry = tracker.stopTimer();
    expect(entry.id).toMatch(/^te_/);
    expect(entry.activity).toBe('Debugging');
    expect(entry.durationMinutes).toBe(45);
    expect(entry.isManual).toBe(false);
    expect(tracker.getActiveTimer()).toBeNull();
    expect(entries).toHaveLength(1);
  });

  it('auto-stops previous timer when starting a new one', () => {
    tracker.startTimer({ activity: 'Task 1' });
    clock.advanceMinutes(30);

    const { newTimer, previousEntry } = tracker.startTimer({ activity: 'Task 2' });
    expect(previousEntry).toBeDefined();
    expect(previousEntry?.activity).toBe('Task 1');
    expect(previousEntry?.durationMinutes).toBe(30);
    expect(newTimer.activity).toBe('Task 2');
    expect(entries).toHaveLength(1);
  });

  it('handles pause and resume accurately without drift', () => {
    tracker.startTimer({ activity: 'Deep Reading' });
    clock.advanceMinutes(20);

    // Pause timer
    const paused = tracker.pauseTimer();
    expect(paused.accumulatedSeconds).toBe(20 * 60);
    expect(paused.pausedAt).toBeDefined();

    // Clock advances during pause
    clock.advanceMinutes(15);
    let status = tracker.getStatus();
    expect(status.timer?.isPaused).toBe(true);
    expect(status.timer?.elapsedSeconds).toBe(20 * 60); // Still 20 min!

    // Resume timer
    tracker.resumeTimer();
    clock.advanceMinutes(10);

    status = tracker.getStatus();
    expect(status.timer?.isPaused).toBe(false);
    expect(status.timer?.elapsedSeconds).toBe(30 * 60); // 20m + 10m

    const entry = tracker.stopTimer();
    expect(entry.durationMinutes).toBe(30);
  });

  it('logs manual time entry', () => {
    const entry = tracker.logManualTime({
      activity: 'Planning meeting',
      category: 'meetings',
      durationMinutes: 45,
      date: '2026-11-21',
    });

    expect(entry.activity).toBe('Planning meeting');
    expect(entry.category).toBe('meetings');
    expect(entry.durationMinutes).toBe(45);
    expect(entry.isManual).toBe(true);
    expect(entries).toHaveLength(1);
  });

  it('filters entries by date and calculates task time', () => {
    tracker.logManualTime({
      activity: 'Act 1',
      durationMinutes: 30,
      date: '2026-11-21',
      taskId: 't_1',
    });
    tracker.logManualTime({
      activity: 'Act 2',
      durationMinutes: 60,
      date: '2026-11-22',
      taskId: 't_1',
    });
    tracker.logManualTime({
      activity: 'Act 3',
      durationMinutes: 15,
      date: '2026-11-22',
      taskId: 't_2',
    });

    expect(tracker.getEntriesForDate('2026-11-21')).toHaveLength(1);
    expect(tracker.getEntriesForDate('2026-11-22')).toHaveLength(2);
    expect(tracker.getTimeForTask('t_1')).toBe(90);
  });
});
