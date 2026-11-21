import { describe, it, expect } from 'vitest';
import { parseDurationToMinutes, formatDurationMinutes } from '../../src/utils/date.js';
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
import { DailySummary, WeeklySummary } from '../../src/types/summary.js';
import { Task } from '../../src/types/models.js';

describe('CLI Utilities & Formatters', () => {
  it('parses duration strings in various formats', () => {
    expect(parseDurationToMinutes('45m')).toBe(45);
    expect(parseDurationToMinutes('45 mins')).toBe(45);
    expect(parseDurationToMinutes('90')).toBe(90);
    expect(parseDurationToMinutes('1.5h')).toBe(90);
    expect(parseDurationToMinutes('2h')).toBe(120);
    expect(parseDurationToMinutes('1h 30m')).toBe(90);
    expect(parseDurationToMinutes('2h15m')).toBe(135);
    expect(() => parseDurationToMinutes('invalid')).toThrow();
  });

  it('formats minutes into human readable strings', () => {
    expect(formatDurationMinutes(0)).toBe('0m');
    expect(formatDurationMinutes(45)).toBe('45m');
    expect(formatDurationMinutes(60)).toBe('1h');
    expect(formatDurationMinutes(90)).toBe('1h 30m');
    expect(formatDurationMinutes(125)).toBe('2h 5m');
  });

  describe('Text and Markdown Formatters', () => {
    const sampleTask: Task = {
      id: 't_123',
      title: 'Write test suite',
      priority: 'high',
      status: 'done',
      estimate: 60,
      dueDate: '2026-11-22',
      tag: 'quality',
      createdAt: '2026-11-22T08:00:00.000Z',
      completedAt: '2026-11-22T09:00:00.000Z',
    };

    const sampleDailySummary: DailySummary = {
      date: '2026-11-22',
      tasksCompleted: [sampleTask],
      tasksMissed: [],
      categoryBreakdown: [
        { category: 'deep work', minutes: 120, percentage: 80, entryCount: 2 },
        { category: 'admin', minutes: 30, percentage: 20, entryCount: 1 },
      ],
      totalTimeMinutes: 150,
      focusTimeMinutes: 120,
      topActivity: { activity: 'Write test suite', category: 'deep work', minutes: 60 },
      score: {
        date: '2026-11-22',
        score: 85,
        baseScore: 85,
        breakdown: {
          taskCompletion: {
            score: 100,
            weight: 0.25,
            points: 25,
            doneCount: 1,
            totalPlannedCount: 1,
          },
          focusTime: { score: 50, weight: 0.3, points: 15, focusMinutes: 120, targetMinutes: 240 },
          priorityCompletion: {
            score: 100,
            weight: 0.25,
            points: 25,
            completedWeight: 3,
            totalPlannedWeight: 3,
          },
          estimateAccuracy: { score: 100, weight: 0.2, points: 20, evaluatedTasksCount: 1 },
        },
        modifiers: {
          overduePenalty: 0,
          overdueTasksCount: 0,
          streakBonus: 0,
          streakDays: 0,
        },
        formula: 'test formula',
      },
      insight: 'Solid progress today.',
    };

    it('formats task list in text and markdown', () => {
      const text = formatTaskListText([sampleTask]);
      expect(text).toContain('Write test suite');
      expect(text).toContain('t_123');

      const md = formatTaskListMarkdown([sampleTask]);
      expect(md).toContain('| Status | Title |');
      expect(md).toContain('Write test suite');
    });

    it('formats daily summary in text and markdown', () => {
      const text = formatDailySummaryText(sampleDailySummary);
      expect(text).toContain('DAYFLOW DAILY SUMMARY');
      expect(text).toContain('85/100');
      expect(text).toContain('Write test suite');

      const md = formatDailySummaryMarkdown(sampleDailySummary);
      expect(md).toContain('# Dayflow Daily Summary: 2026-11-22');
      expect(md).toContain('**85 / 100**');
      expect(md).toContain('| Task Completion |');
    });

    it('formats weekly summary in text and markdown', () => {
      const sampleWeeklySummary: WeeklySummary = {
        weekStart: '2026-11-16',
        weekEnd: '2026-11-22',
        totalTasksDone: 8,
        totalTimeMinutes: 1200,
        totalFocusMinutes: 900,
        averageScore: 88,
        dailyTrend: [
          { date: '2026-11-16', dayOfWeek: 'Mon', score: 85, focusMinutes: 180, tasksCompleted: 2 },
          { date: '2026-11-17', dayOfWeek: 'Tue', score: 90, focusMinutes: 240, tasksCompleted: 2 },
        ],
        sparkline: ' ▃▅▇█',
        bestDay: { date: '2026-11-17', score: 90 },
        worstDay: { date: '2026-11-16', score: 85 },
        peakTimeWindow: { window: '09:00 - 11:00', totalMinutes: 240, focusMinutes: 200 },
        categoryDistribution: [
          { category: 'deep work', minutes: 900, percentage: 75, entryCount: 5 },
        ],
        comparisonWithPreviousWeek: { tasksDoneDelta: 2, focusMinutesDelta: 60, scoreDelta: 5 },
      };

      const text = formatWeeklySummaryText(sampleWeeklySummary);
      expect(text).toContain('DAYFLOW WEEKLY SUMMARY');
      expect(text).toContain('88/100');

      const md = formatWeeklySummaryMarkdown(sampleWeeklySummary);
      expect(md).toContain('# Dayflow Weekly Summary');
      expect(md).toContain('**88 / 100**');
      expect(md).toContain('| Mon | 2026-11-16 |');
    });
  });
});
