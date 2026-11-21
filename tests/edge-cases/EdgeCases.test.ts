import { describe, it, expect } from 'vitest';
import { SettableClock } from '../../src/utils/clock.js';
import { TimeTracker } from '../../src/core/TimeTracker.js';
import { ScoreCalculator } from '../../src/core/ScoreCalculator.js';
import { getWeekRange, isTimestampOnDate } from '../../src/utils/date.js';
import { DEFAULT_CONFIG } from '../../src/types/config.js';
import { ActiveTimer, Task, TimeEntry } from '../../src/types/models.js';

describe('Edge Cases & Resiliency', () => {
  it('recovers cleanly after process crash while timer is running', () => {
    const clock = new SettableClock('2026-11-22T10:00:00.000Z');

    // Simulate an active timer that was saved to disk before a crash 2 hours ago
    const savedActiveTimer: ActiveTimer = {
      id: 'tm_crashed',
      activity: 'Designing architecture',
      category: 'deep work',
      startTime: '2026-11-22T08:00:00.000Z', // 2 hours ago
      accumulatedSeconds: 15 * 60, // 15 mins before a pause/resume
    };

    const entries: TimeEntry[] = [];
    // Start fresh tracker from recovered state
    const recoveredTracker = new TimeTracker(entries, savedActiveTimer, clock, 'UTC');

    const status = recoveredTracker.getStatus();
    expect(status.active).toBe(true);
    // Elapsed should be 15 mins + 120 mins = 135 mins = 8100 seconds
    expect(status.timer?.elapsedSeconds).toBe(135 * 60);

    // Stop timer and verify time entry is recorded without memory loss
    const stoppedEntry = recoveredTracker.stopTimer();
    expect(stoppedEntry.durationMinutes).toBe(135);
    expect(recoveredTracker.getActiveTimer()).toBeNull();
  });

  it('handles midnight rollover across local timezone dates accurately', () => {
    // 23:55 on Nov 22 in America/New_York
    const clock = new SettableClock('2026-11-23T04:55:00.000Z'); // 23:55 EST on Nov 22
    const tz = 'America/New_York';

    expect(isTimestampOnDate('2026-11-23T04:55:00.000Z', '2026-11-22', tz)).toBe(true);
    expect(isTimestampOnDate('2026-11-23T04:55:00.000Z', '2026-11-23', tz)).toBe(false);

    // 10 minutes later: 00:05 on Nov 23
    clock.advanceMinutes(10);
    expect(isTimestampOnDate(clock.now().toISOString(), '2026-11-23', tz)).toBe(true);
    expect(isTimestampOnDate(clock.now().toISOString(), '2026-11-22', tz)).toBe(false);
  });

  it('handles DST transitions seamlessly in date range calculations', () => {
    // Week containing US Fall DST fallback (first Sunday in November)
    const range = getWeekRange('2026-11-01', 'sunday', 'America/New_York');
    expect(range.days).toHaveLength(7);
    expect(range.weekStart).toBe('2026-11-01');
    expect(range.weekEnd).toBe('2026-11-07');
  });

  it('handles week boundaries for Monday vs Sunday start correctly', () => {
    // 2026-11-22 is a Sunday
    const mondayWeek = getWeekRange('2026-11-22', 'monday', 'UTC');
    // For Monday start, Sunday Nov 22 is the last day of the week starting Monday Nov 16
    expect(mondayWeek.weekStart).toBe('2026-11-16');
    expect(mondayWeek.weekEnd).toBe('2026-11-22');

    const sundayWeek = getWeekRange('2026-11-22', 'sunday', 'UTC');
    // For Sunday start, Sunday Nov 22 is the first day of the week
    expect(sundayWeek.weekStart).toBe('2026-11-22');
    expect(sundayWeek.weekEnd).toBe('2026-11-28');
  });

  it('handles overlapping time entries gracefully in score and aggregates', () => {
    const config = { ...DEFAULT_CONFIG, timezone: 'UTC' };
    const tasks: Task[] = [];
    const overlappingEntries: TimeEntry[] = [
      {
        id: 'te_a',
        activity: 'Pair programming',
        category: 'deep work',
        startTime: '2026-11-22T10:00:00.000Z',
        endTime: '2026-11-22T11:00:00.000Z',
        durationMinutes: 60,
        isManual: true,
      },
      {
        id: 'te_b',
        activity: 'Background compile',
        category: 'admin',
        startTime: '2026-11-22T10:30:00.000Z',
        endTime: '2026-11-22T11:30:00.000Z',
        durationMinutes: 60,
        isManual: true,
      },
    ];

    const score = ScoreCalculator.calculate({
      dateKey: '2026-11-22',
      tasks,
      timeEntries: overlappingEntries,
      config,
    });

    // Deep work was 60 minutes
    expect(score.breakdown.focusTime.focusMinutes).toBe(60);
    expect(score.score).toBeGreaterThanOrEqual(0);
  });
});
