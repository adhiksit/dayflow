import { describe, it, expect } from 'vitest';
import { SummaryEngine } from '../../src/core/SummaryEngine.js';
import { DEFAULT_CONFIG } from '../../src/types/config.js';
import { Task, TimeEntry } from '../../src/types/models.js';

describe('SummaryEngine', () => {
  const config = { ...DEFAULT_CONFIG, timezone: 'UTC' };

  it('generates rich daily summary with categories and top activity', () => {
    const tasks: Task[] = [
      {
        id: 't1',
        title: 'Build API',
        priority: 'high',
        status: 'done',
        dueDate: '2026-11-22',
        createdAt: '2026-11-22T08:00:00.000Z',
        completedAt: '2026-11-22T12:00:00.000Z',
      },
      {
        id: 't2',
        title: 'Review specs',
        priority: 'medium',
        status: 'todo',
        dueDate: '2026-11-22',
        createdAt: '2026-11-22T08:00:00.000Z',
      },
    ];

    const timeEntries: TimeEntry[] = [
      {
        id: 'e1',
        activity: 'Build API',
        category: 'deep work',
        startTime: '2026-11-22T09:00:00.000Z',
        endTime: '2026-11-22T11:00:00.000Z',
        durationMinutes: 120,
        isManual: false,
      },
      {
        id: 'e2',
        activity: 'Team Standup',
        category: 'meetings',
        startTime: '2026-11-22T11:00:00.000Z',
        endTime: '2026-11-22T11:30:00.000Z',
        durationMinutes: 30,
        isManual: false,
      },
    ];

    const summary = SummaryEngine.generateDailySummary('2026-11-22', tasks, timeEntries, config);

    expect(summary.date).toBe('2026-11-22');
    expect(summary.tasksCompleted).toHaveLength(1);
    expect(summary.tasksMissed).toHaveLength(1);
    expect(summary.totalTimeMinutes).toBe(150);
    expect(summary.focusTimeMinutes).toBe(120);
    expect(summary.topActivity?.activity).toBe('Build API');
    expect(summary.categoryBreakdown).toHaveLength(2);
    expect(summary.insight).toBeTruthy();
  });

  it('generates weekly summary with trends, sparkline, and best/worst day', () => {
    const tasks: Task[] = [
      {
        id: 't1',
        title: 'Weekly project',
        priority: 'high',
        status: 'done',
        dueDate: '2026-11-18',
        createdAt: '2026-11-18T08:00:00.000Z',
        completedAt: '2026-11-18T10:00:00.000Z',
      },
    ];

    const timeEntries: TimeEntry[] = [
      {
        id: 'e1',
        activity: 'Deep work block',
        category: 'deep work',
        startTime: '2026-11-18T10:00:00.000Z',
        endTime: '2026-11-18T14:00:00.000Z',
        durationMinutes: 240,
        isManual: false,
      },
    ];

    const summary = SummaryEngine.generateWeeklySummary('2026-11-18', tasks, timeEntries, config);

    expect(summary.dailyTrend).toHaveLength(7);
    expect(summary.sparkline).toHaveLength(7);
    expect(summary.bestDay).toBeDefined();
    expect(summary.worstDay).toBeDefined();
    expect(summary.peakTimeWindow).toBeDefined();
  });
});
