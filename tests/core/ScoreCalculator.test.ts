import { describe, it, expect } from 'vitest';
import { ScoreCalculator } from '../../src/core/ScoreCalculator.js';
import { DEFAULT_CONFIG } from '../../src/types/config.js';
import { Task, TimeEntry } from '../../src/types/models.js';

describe('ScoreCalculator', () => {
  const config = { ...DEFAULT_CONFIG, timezone: 'UTC' };

  it('calculates exact worked example from the implementation plan', () => {
    // 4 planned tasks:
    // Task A: High, est 60, act 60, done
    // Task B: High, est 90, act 120, done
    // Task C: Med, est 30, act 30, done
    // Task D: Low, est 30, not done
    // 1 overdue task from prior day
    // Streak: 3 days
    // Deep work: 60 + 120 + 30 = 210m vs 240m target
    const tasks: Task[] = [
      {
        id: 'task_a',
        title: 'Task A',
        priority: 'high',
        estimate: 60,
        dueDate: '2026-11-22',
        status: 'done',
        createdAt: '2026-11-22T08:00:00.000Z',
        completedAt: '2026-11-22T11:00:00.000Z',
      },
      {
        id: 'task_b',
        title: 'Task B',
        priority: 'high',
        estimate: 90,
        dueDate: '2026-11-22',
        status: 'done',
        createdAt: '2026-11-22T08:00:00.000Z',
        completedAt: '2026-11-22T14:00:00.000Z',
      },
      {
        id: 'task_c',
        title: 'Task C',
        priority: 'medium',
        estimate: 30,
        dueDate: '2026-11-22',
        status: 'done',
        createdAt: '2026-11-22T08:00:00.000Z',
        completedAt: '2026-11-22T16:00:00.000Z',
      },
      {
        id: 'task_d',
        title: 'Task D',
        priority: 'low',
        estimate: 30,
        dueDate: '2026-11-22',
        status: 'todo',
        createdAt: '2026-11-22T08:00:00.000Z',
      },
      {
        id: 'task_overdue',
        title: 'Old Task',
        priority: 'medium',
        dueDate: '2026-11-20',
        status: 'todo',
        createdAt: '2026-11-20T08:00:00.000Z',
      },
    ];

    const timeEntries: TimeEntry[] = [
      {
        id: 'te_1',
        taskId: 'task_a',
        activity: 'Task A',
        category: 'deep work',
        startTime: '2026-11-22T09:00:00.000Z',
        endTime: '2026-11-22T10:00:00.000Z',
        durationMinutes: 60,
        isManual: false,
      },
      {
        id: 'te_2',
        taskId: 'task_b',
        activity: 'Task B',
        category: 'deep work',
        startTime: '2026-11-22T10:00:00.000Z',
        endTime: '2026-11-22T12:00:00.000Z',
        durationMinutes: 120,
        isManual: false,
      },
      {
        id: 'te_3',
        taskId: 'task_c',
        activity: 'Task C',
        category: 'deep work',
        startTime: '2026-11-22T13:00:00.000Z',
        endTime: '2026-11-22T13:30:00.000Z',
        durationMinutes: 30,
        isManual: false,
      },
      {
        id: 'te_4',
        activity: 'Sync',
        category: 'meetings',
        startTime: '2026-11-22T14:00:00.000Z',
        endTime: '2026-11-22T15:00:00.000Z',
        durationMinutes: 60,
        isManual: false,
      },
    ];

    const result = ScoreCalculator.calculate({
      dateKey: '2026-11-22',
      tasks,
      timeEntries,
      config,
      streakDays: 3,
    });

    // Verify component breakdowns
    expect(result.breakdown.taskCompletion.score).toBe(75);
    expect(result.breakdown.focusTime.score).toBe(87.5);
    expect(result.breakdown.priorityCompletion.score).toBe(88.89);
    expect(result.breakdown.estimateAccuracy.score).toBe(88.89);

    // Overdue penalty: 1 overdue task = -5
    expect(result.modifiers.overduePenalty).toBe(-5);
    // Streak bonus: 3 days = +6
    expect(result.modifiers.streakBonus).toBe(6);

    // Final score = round(85.0 - 5 + 6) = 86
    expect(result.score).toBe(86);
    expect(result.formula).toContain('Score = clamp(0, 100');
  });

  it('handles edge case: no tasks planned or completed', () => {
    const result = ScoreCalculator.calculate({
      dateKey: '2026-11-22',
      tasks: [],
      timeEntries: [],
      config,
      streakDays: 0,
    });

    // In the absence of planned tasks, task completion and priority are 100 (neutral)
    // Focus is 0 (0/240)
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.breakdown.focusTime.score).toBe(0);
  });

  it('handles edge case: all tasks done and focus target exceeded', () => {
    const tasks: Task[] = [
      {
        id: 't1',
        title: 'Task 1',
        priority: 'high',
        dueDate: '2026-11-22',
        status: 'done',
        createdAt: '2026-11-22T08:00:00.000Z',
        completedAt: '2026-11-22T12:00:00.000Z',
      },
    ];
    const timeEntries: TimeEntry[] = [
      {
        id: 'te1',
        activity: 'Work',
        category: 'deep work',
        startTime: '2026-11-22T08:00:00.000Z',
        endTime: '2026-11-22T14:00:00.000Z',
        durationMinutes: 300, // exceeds 240
        isManual: false,
      },
    ];

    const result = ScoreCalculator.calculate({
      dateKey: '2026-11-22',
      tasks,
      timeEntries,
      config,
      streakDays: 5,
    });

    // Score clamped at 100
    expect(result.score).toBe(100);
  });

  it('clamps penalty and bonus to prevent negative or >100 score', () => {
    // 10 overdue tasks (-50 uncapped, but capped at -20)
    const overdueTasks: Task[] = Array.from({ length: 10 }).map((_, i) => ({
      id: `overdue_${i}`,
      title: `Overdue ${i}`,
      priority: 'low',
      dueDate: '2026-11-10',
      status: 'todo',
      createdAt: '2026-11-10T00:00:00.000Z',
    }));

    const result = ScoreCalculator.calculate({
      dateKey: '2026-11-22',
      tasks: overdueTasks,
      timeEntries: [],
      config,
      streakDays: 0,
    });

    expect(result.modifiers.overduePenalty).toBe(-20);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});
