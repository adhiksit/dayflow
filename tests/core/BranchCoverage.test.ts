import { describe, it, expect } from 'vitest';
import { isColorSupported, renderScorePill, renderProgressBar } from '../../src/cli/utils.js';
import {
  formatTaskListText,
  formatDailySummaryText,
  formatWeeklySummaryText,
} from '../../src/cli/formatters/text.js';
import {
  formatTaskListMarkdown,
  formatDailySummaryMarkdown,
  formatWeeklySummaryMarkdown,
} from '../../src/cli/formatters/markdown.js';
import { TimeTracker } from '../../src/core/TimeTracker.js';
import { TaskManager } from '../../src/core/TaskManager.js';
import { SettableClock } from '../../src/utils/clock.js';
import { getDefaultDataDir } from '../../src/storage/paths.js';
import { generateId } from '../../src/utils/id.js';
import { parseDurationToMinutes, formatDateKey } from '../../src/utils/date.js';

describe('Targeted Branch Coverage', () => {
  it('covers CLI utils NO_COLOR, score pills and progress bars', () => {
    const origNoColor = process.env['NO_COLOR'];
    try {
      process.env['NO_COLOR'] = '1';
      expect(isColorSupported()).toBe(false);
    } finally {
      if (origNoColor === undefined) delete process.env['NO_COLOR'];
      else process.env['NO_COLOR'] = origNoColor;
    }

    expect(renderScorePill(95)).toContain('95/100');
    expect(renderScorePill(75)).toContain('75/100');
    expect(renderScorePill(40)).toContain('40/100');

    expect(renderProgressBar(0)).toContain('0%');
    expect(renderProgressBar(120)).toContain('100%');
  });

  it('covers empty states and edge cases in text and markdown formatters', () => {
    expect(formatTaskListText([])).toContain('No tasks found');
    expect(formatTaskListMarkdown([])).toContain('No tasks found');

    const emptyDaily = {
      date: '2026-11-22',
      tasksCompleted: [],
      tasksMissed: [
        {
          id: 'm1',
          title: 'Missed Task',
          priority: 'high' as const,
          dueDate: '2026-11-20',
          status: 'todo' as const,
          createdAt: '2026-11-20T00:00:00.000Z',
        },
      ],
      categoryBreakdown: [],
      totalTimeMinutes: 0,
      focusTimeMinutes: 0,
      topActivity: null,
      score: {
        date: '2026-11-22',
        score: 45,
        baseScore: 50,
        breakdown: {
          taskCompletion: { score: 0, weight: 0.25, points: 0, doneCount: 0, totalPlannedCount: 1 },
          focusTime: { score: 0, weight: 0.3, points: 0, focusMinutes: 0, targetMinutes: 240 },
          priorityCompletion: {
            score: 0,
            weight: 0.25,
            points: 0,
            completedWeight: 0,
            totalPlannedWeight: 3,
          },
          estimateAccuracy: { score: 100, weight: 0.2, points: 20, evaluatedTasksCount: 0 },
        },
        modifiers: {
          overduePenalty: -5,
          overdueTasksCount: 1,
          streakBonus: 0,
          streakDays: 0,
        },
        formula: 'test',
      },
      insight: 'Need focus',
    };

    const textDaily = formatDailySummaryText(emptyDaily);
    expect(textDaily).toContain('Missed Task');
    expect(textDaily).toContain('-5 overdue penalty');

    const mdDaily = formatDailySummaryMarkdown(emptyDaily);
    expect(mdDaily).toContain('Missed Task');
    expect(mdDaily).toContain('_None_'); // No completed tasks

    const emptyWeekly = {
      weekStart: '2026-11-16',
      weekEnd: '2026-11-22',
      totalTasksDone: 0,
      totalTimeMinutes: 0,
      totalFocusMinutes: 0,
      averageScore: 50,
      dailyTrend: [],
      sparkline: '',
      bestDay: null,
      worstDay: null,
      peakTimeWindow: null,
      categoryDistribution: [],
      comparisonWithPreviousWeek: null,
    };

    expect(formatWeeklySummaryText(emptyWeekly)).toContain('DAYFLOW WEEKLY SUMMARY');
    expect(formatWeeklySummaryMarkdown(emptyWeekly)).toContain('# Dayflow Weekly Summary');
  });

  it('covers TimeTracker guard branches', () => {
    const clock = new SettableClock();
    const tracker = new TimeTracker([], null, clock, 'UTC');

    expect(() => tracker.startTimer({ activity: '  ' })).toThrow('Timer activity cannot be empty.');
    expect(() => tracker.stopTimer()).toThrow('No active timer running.');
    expect(() => tracker.pauseTimer()).toThrow('No active timer running.');
    expect(() => tracker.resumeTimer()).toThrow('No active timer to resume.');
    expect(() => tracker.logManualTime({ activity: '', durationMinutes: 10 })).toThrow();
    expect(() => tracker.logManualTime({ activity: 'Reading', durationMinutes: -5 })).toThrow();

    // Pause when already paused
    tracker.startTimer({ activity: 'Coding' });
    tracker.pauseTimer();
    const stillPaused = tracker.pauseTimer();
    expect(stillPaused.pausedAt).toBeDefined();

    // Resume when not paused
    tracker.resumeTimer();
    const stillRunning = tracker.resumeTimer();
    expect(stillRunning.pausedAt).toBeUndefined();
    tracker.stopTimer();
  });

  it('covers TaskManager guard branches', () => {
    const clock = new SettableClock();
    const manager = new TaskManager([], clock, 'UTC');

    expect(() => manager.completeTask('nonexistent')).toThrow();
    expect(() => manager.reopenTask('nonexistent')).toThrow();
    expect(() => manager.updateTask('nonexistent', { title: 'x' })).toThrow();

    const t = manager.addTask({ title: 'Task' });
    expect(() => manager.updateTask(t.id, { title: '   ' })).toThrow('Task title cannot be empty.');

    // Status transitions
    manager.updateTask(t.id, { status: 'done' });
    expect(t.status).toBe('done');
    expect(t.completedAt).toBeDefined();

    manager.updateTask(t.id, { status: 'done' }); // Same status
    expect(t.status).toBe('done');

    manager.updateTask(t.id, { status: 'in-progress' }); // from done to in-progress
    expect(t.status).toBe('in-progress');
    expect(t.completedAt).toBeUndefined();
  });

  it('covers paths for windows platform mock', () => {
    const origPlatform = process.platform;
    const origAppData = process.env['APPDATA'];
    try {
      delete process.env['DAYFLOW_DATA_DIR'];
      Object.defineProperty(process, 'platform', { value: 'win32' });
      process.env['APPDATA'] = 'C:\\MockAppData';
      const dir = getDefaultDataDir();
      expect(dir).toContain('dayflow');
    } finally {
      Object.defineProperty(process, 'platform', { value: origPlatform });
      if (origAppData === undefined) delete process.env['APPDATA'];
      else process.env['APPDATA'] = origAppData;
    }
  });

  it('covers generateId without prefix', () => {
    const id = generateId();
    expect(id).toMatch(/^[0-9a-f]{8}$/);
  });

  it('covers date helpers edge cases', () => {
    const d = new Date('2026-11-22T10:00:00Z');
    expect(formatDateKey(d, 'Invalid/Timezone_Name')).toBe('2026-11-22');
    expect(parseDurationToMinutes('1.5 hours')).toBe(90);
    expect(parseDurationToMinutes('1 hour')).toBe(60);
    expect(parseDurationToMinutes('30 mins')).toBe(30);
  });
});
