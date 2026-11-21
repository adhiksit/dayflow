import { describe, it, expect } from 'vitest';
import { formatTaskListText, formatDailySummaryText } from '../../src/cli/formatters/text.js';
import { formatTaskListMarkdown } from '../../src/cli/formatters/markdown.js';
import { SummaryEngine } from '../../src/core/SummaryEngine.js';
import { Dayflow } from '../../src/core/Dayflow.js';
import { MemoryStorageAdapter } from '../../src/storage/MemoryStorage.js';
import { SettableClock } from '../../src/utils/clock.js';
import { DEFAULT_CONFIG } from '../../src/types/config.js';
import { Task } from '../../src/types/models.js';

describe('Deep Branch Testing', () => {
  it('covers all priority and status icons in text and markdown task formatters', () => {
    const tasks: Task[] = [
      {
        id: 't_med',
        title: 'Medium Task',
        priority: 'medium',
        status: 'in-progress',
        createdAt: '2026-11-22T08:00:00Z',
      },
      {
        id: 't_low',
        title: 'Low Task',
        priority: 'low',
        status: 'todo',
        createdAt: '2026-11-22T08:00:00Z',
      },
    ];

    const text = formatTaskListText(tasks);
    expect(text).toContain('[medium]');
    expect(text).toContain('[low]');

    const md = formatTaskListMarkdown(tasks);
    expect(md).toContain('in-progress');
    expect(md).toContain('todo');
  });

  it('covers all insight branches in SummaryEngine', () => {
    const config = { ...DEFAULT_CONFIG, targetFocusMinutes: 240, timezone: 'UTC' };

    // 1. tasksCompleted > 0 and focus < targetFocus * 0.5 and score < 75
    const s1 = SummaryEngine.generateDailySummary(
      '2026-11-22',
      [
        {
          id: 't1',
          title: 'T1',
          priority: 'low',
          status: 'done',
          dueDate: '2026-11-22',
          createdAt: '2026-11-22T08:00:00Z',
          completedAt: '2026-11-22T09:00:00Z',
        },
        {
          id: 't2',
          title: 'T2',
          priority: 'high',
          status: 'todo',
          dueDate: '2026-11-22',
          createdAt: '2026-11-22T08:00:00Z',
        },
        {
          id: 't3',
          title: 'T3',
          priority: 'high',
          status: 'todo',
          dueDate: '2026-11-22',
          createdAt: '2026-11-22T08:00:00Z',
        },
      ],
      [], // 0 focus
      config,
    );
    expect(s1.insight).toContain('deep focus time fell short of target hours');

    // 2. tasksMissed > 2
    const s2 = SummaryEngine.generateDailySummary(
      '2026-11-22',
      [
        {
          id: 'm1',
          title: 'M1',
          priority: 'high',
          status: 'todo',
          dueDate: '2026-11-20',
          createdAt: '2026-11-20T00:00:00Z',
        },
        {
          id: 'm2',
          title: 'M2',
          priority: 'high',
          status: 'todo',
          dueDate: '2026-11-20',
          createdAt: '2026-11-20T00:00:00Z',
        },
        {
          id: 'm3',
          title: 'M3',
          priority: 'high',
          status: 'todo',
          dueDate: '2026-11-20',
          createdAt: '2026-11-20T00:00:00Z',
        },
      ],
      [],
      config,
    );
    expect(s2.insight).toContain('Multiple tasks overdue');

    // 3. focus >= targetFocus and tasksMissed > 0, score < 75
    const s3 = SummaryEngine.generateDailySummary(
      '2026-11-22',
      [
        {
          id: 'm1',
          title: 'M1',
          priority: 'high',
          status: 'todo',
          dueDate: '2026-11-22',
          createdAt: '2026-11-22T00:00:00Z',
        },
        {
          id: 'm2',
          title: 'M2',
          priority: 'high',
          status: 'todo',
          dueDate: '2026-11-22',
          createdAt: '2026-11-22T00:00:00Z',
        },
      ],
      [
        {
          id: 'e1',
          activity: 'Deep',
          category: 'deep work',
          startTime: '2026-11-22T08:00:00Z',
          endTime: '2026-11-22T13:00:00Z',
          durationMinutes: 300,
          isManual: false,
        },
      ],
      config,
    );
    expect(s3.insight).toContain('Strong deep work time');
  });

  it('covers Dayflow timer with freeform activity and import error handling', async () => {
    const clock = new SettableClock('2026-11-22T10:00:00Z');
    const storage = new MemoryStorageAdapter();
    const dayflow = new Dayflow({ storage, clock, config: { timezone: 'UTC' } });
    await dayflow.init();

    // Start timer with a freeform string activity (not a task id)
    const { timer } = await dayflow.startTimer('Writing blog post', 'deep work');
    expect(timer.activity).toBe('Writing blog post');
    expect(timer.taskId).toBeUndefined();

    // Import error handling
    await expect(dayflow.importData(null as any)).rejects.toThrow(
      'Invalid dayflow import data format.',
    );
    await expect(dayflow.importData('string' as any)).rejects.toThrow(
      'Invalid dayflow import data format.',
    );

    // Update task with tag, estimate, dueDate
    const t = await dayflow.addTask({ title: 'Task to edit' });
    const updated = await dayflow.updateTask(t.id, {
      tag: 'newtag',
      estimate: 120,
      dueDate: '2026-11-30',
    });
    expect(updated.tag).toBe('newtag');
    expect(updated.estimate).toBe(120);
    expect(updated.dueDate).toBe('2026-11-30');
  });

  it('covers daily text formatter with both overdue penalty and streak bonus', () => {
    const summary = {
      date: '2026-11-22',
      tasksCompleted: [],
      tasksMissed: [],
      categoryBreakdown: [],
      totalTimeMinutes: 0,
      focusTimeMinutes: 0,
      topActivity: null,
      score: {
        date: '2026-11-22',
        score: 80,
        baseScore: 80,
        breakdown: {
          taskCompletion: {
            score: 100,
            weight: 0.25,
            points: 25,
            doneCount: 0,
            totalPlannedCount: 0,
          },
          focusTime: { score: 100, weight: 0.3, points: 30, focusMinutes: 240, targetMinutes: 240 },
          priorityCompletion: {
            score: 100,
            weight: 0.25,
            points: 25,
            completedWeight: 0,
            totalPlannedWeight: 0,
          },
          estimateAccuracy: { score: 100, weight: 0.2, points: 20, evaluatedTasksCount: 0 },
        },
        modifiers: {
          overduePenalty: -5,
          overdueTasksCount: 1,
          streakBonus: 4,
          streakDays: 2,
        },
        formula: 'test',
      },
      insight: 'Solid',
    };

    const text = formatDailySummaryText(summary);
    expect(text).toContain('-5 overdue penalty');
    expect(text).toContain('+4 streak bonus');
  });
});
