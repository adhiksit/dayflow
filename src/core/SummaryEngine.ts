import { Task, TimeEntry, ActivityCategory } from '../types/models.js';
import { DayflowConfig } from '../types/config.js';
import {
  DailySummary,
  WeeklySummary,
  CategorySummary,
  DayTrend,
  TimeWindowProductivity,
} from '../types/summary.js';
import { ScoreCalculator } from './ScoreCalculator.js';
import { isTimestampOnDate, getWeekRange } from '../utils/date.js';

export class SummaryEngine {
  /**
   * Generates a daily summary for dateKey.
   */
  static generateDailySummary(
    dateKey: string,
    tasks: Task[],
    timeEntries: TimeEntry[],
    config: DayflowConfig,
  ): DailySummary {
    const timezone = config.timezone;
    const streakDays = ScoreCalculator.calculateStreak(dateKey, tasks, timeEntries, config);
    const score = ScoreCalculator.calculate({
      dateKey,
      tasks,
      timeEntries,
      config,
      streakDays,
    });

    const dayEntries = timeEntries.filter((e) => isTimestampOnDate(e.startTime, dateKey, timezone));

    // Tasks completed today
    const tasksCompleted = tasks.filter(
      (t) =>
        t.status === 'done' && t.completedAt && isTimestampOnDate(t.completedAt, dateKey, timezone),
    );

    // Tasks missed today: due today or earlier, but not done
    const tasksMissed = tasks.filter(
      (t) => t.status !== 'done' && t.dueDate && t.dueDate <= dateKey,
    );

    // Category aggregation
    const categoryMap = new Map<ActivityCategory, { minutes: number; count: number }>();
    let totalMinutes = 0;
    let focusMinutes = 0;

    for (const entry of dayEntries) {
      const cat = entry.category || 'general';
      const current = categoryMap.get(cat) || { minutes: 0, count: 0 };
      current.minutes += entry.durationMinutes;
      current.count += 1;
      categoryMap.set(cat, current);

      totalMinutes += entry.durationMinutes;
      if (cat.toLowerCase() === 'deep work') {
        focusMinutes += entry.durationMinutes;
      }
    }

    totalMinutes = Math.round(totalMinutes * 10) / 10;
    focusMinutes = Math.round(focusMinutes * 10) / 10;

    const categoryBreakdown: CategorySummary[] = Array.from(categoryMap.entries()).map(
      ([cat, data]) => ({
        category: cat,
        minutes: Math.round(data.minutes * 10) / 10,
        percentage: totalMinutes > 0 ? Math.round((data.minutes / totalMinutes) * 100) : 0,
        entryCount: data.count,
      }),
    );
    categoryBreakdown.sort((a, b) => b.minutes - a.minutes);

    // Top activity
    const activityMap = new Map<string, { minutes: number; category: ActivityCategory }>();
    for (const entry of dayEntries) {
      const act = entry.activity;
      const cur = activityMap.get(act) || { minutes: 0, category: entry.category };
      cur.minutes += entry.durationMinutes;
      activityMap.set(act, cur);
    }

    let topActivity: DailySummary['topActivity'] = null;
    let maxActivityMinutes = 0;
    for (const [activity, cur] of activityMap.entries()) {
      if (cur.minutes > maxActivityMinutes) {
        maxActivityMinutes = cur.minutes;
        topActivity = {
          activity,
          category: cur.category,
          minutes: Math.round(cur.minutes * 10) / 10,
        };
      }
    }

    // Insight generation
    const insight = this.generateDailyInsight({
      score: score.score,
      focusMinutes,
      targetFocus: config.targetFocusMinutes,
      tasksCompletedCount: tasksCompleted.length,
      tasksMissedCount: tasksMissed.length,
      streakDays,
    });

    return {
      date: dateKey,
      tasksCompleted,
      tasksMissed,
      categoryBreakdown,
      totalTimeMinutes: totalMinutes,
      focusTimeMinutes: focusMinutes,
      topActivity,
      score,
      insight,
    };
  }

  /**
   * Generates a weekly summary.
   */
  static generateWeeklySummary(
    dateInWeek: string,
    tasks: Task[],
    timeEntries: TimeEntry[],
    config: DayflowConfig,
  ): WeeklySummary {
    const { weekStart, weekEnd, days } = getWeekRange(
      dateInWeek,
      config.weekStartsOn,
      config.timezone,
    );

    const dayTrends: DayTrend[] = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    let totalTasksDone = 0;
    let totalTimeMinutes = 0;
    let totalFocusMinutes = 0;
    let scoreSum = 0;

    let bestDay: { date: string; score: number } | null = null;
    let worstDay: { date: string; score: number } | null = null;

    const weekCategoryMap = new Map<ActivityCategory, { minutes: number; count: number }>();
    const hourlyBuckets = new Map<number, { total: number; focus: number }>();

    for (const dayKey of days) {
      const [y, m, d] = dayKey.split('-').map(Number);
      const utcDate = new Date(Date.UTC(y!, m! - 1, d!, 12, 0, 0));
      const dayOfWeek = dayNames[utcDate.getUTCDay()]!;

      const daily = this.generateDailySummary(dayKey, tasks, timeEntries, config);

      dayTrends.push({
        date: dayKey,
        dayOfWeek,
        score: daily.score.score,
        focusMinutes: daily.focusTimeMinutes,
        tasksCompleted: daily.tasksCompleted.length,
      });

      totalTasksDone += daily.tasksCompleted.length;
      totalTimeMinutes += daily.totalTimeMinutes;
      totalFocusMinutes += daily.focusTimeMinutes;
      scoreSum += daily.score.score;

      if (!bestDay || daily.score.score > bestDay.score) {
        bestDay = { date: dayKey, score: daily.score.score };
      }
      if (!worstDay || daily.score.score < worstDay.score) {
        worstDay = { date: dayKey, score: daily.score.score };
      }

      for (const cat of daily.categoryBreakdown) {
        const cur = weekCategoryMap.get(cat.category) || { minutes: 0, count: 0 };
        cur.minutes += cat.minutes;
        cur.count += cat.entryCount;
        weekCategoryMap.set(cat.category, cur);
      }

      // Hourly bucket analysis for time window productivity
      const dayEntries = timeEntries.filter((e) =>
        isTimestampOnDate(e.startTime, dayKey, config.timezone),
      );
      for (const entry of dayEntries) {
        const entryDate = new Date(entry.startTime);
        // Extract hour in configured timezone
        const hour = parseInt(
          new Intl.DateTimeFormat('en-US', {
            hour: 'numeric',
            hourCycle: 'h23',
            timeZone: config.timezone,
          }).format(entryDate),
          10,
        );

        const bucket = hourlyBuckets.get(hour) || { total: 0, focus: 0 };
        bucket.total += entry.durationMinutes;
        if (entry.category.toLowerCase() === 'deep work') {
          bucket.focus += entry.durationMinutes;
        }
        hourlyBuckets.set(hour, bucket);
      }
    }

    const averageScore = Math.round(scoreSum / days.length);
    const sparkline = this.generateSparkline(dayTrends.map((d) => d.score));

    // Category distribution
    const categoryDistribution: CategorySummary[] = Array.from(weekCategoryMap.entries()).map(
      ([cat, data]) => ({
        category: cat,
        minutes: Math.round(data.minutes * 10) / 10,
        percentage: totalTimeMinutes > 0 ? Math.round((data.minutes / totalTimeMinutes) * 100) : 0,
        entryCount: data.count,
      }),
    );
    categoryDistribution.sort((a, b) => b.minutes - a.minutes);

    // Peak 2-hour productivity window
    let peakTimeWindow: TimeWindowProductivity | null = null;
    let maxWindowFocus = 0;

    for (let h = 0; h < 23; h++) {
      const b1 = hourlyBuckets.get(h) || { total: 0, focus: 0 };
      const b2 = hourlyBuckets.get(h + 1) || { total: 0, focus: 0 };
      const windowFocus = b1.focus + b2.focus;
      const windowTotal = b1.total + b2.total;

      if (windowTotal > 0 && (windowFocus > maxWindowFocus || peakTimeWindow === null)) {
        maxWindowFocus = windowFocus;
        const startStr = `${String(h).padStart(2, '0')}:00`;
        const endStr = `${String(h + 2).padStart(2, '0')}:00`;
        peakTimeWindow = {
          window: `${startStr} - ${endStr}`,
          totalMinutes: Math.round(windowTotal * 10) / 10,
          focusMinutes: Math.round(windowFocus * 10) / 10,
        };
      }
    }

    // Comparison with previous week
    const [y, m, d] = weekStart.split('-').map(Number);
    const prevWeekStartUtc = new Date(Date.UTC(y!, m! - 1, d!, 12, 0, 0) - 7 * 24 * 60 * 60 * 1000);
    const prevWeekKey = `${prevWeekStartUtc.getUTCFullYear()}-${String(prevWeekStartUtc.getUTCMonth() + 1).padStart(2, '0')}-${String(prevWeekStartUtc.getUTCDate()).padStart(2, '0')}`;

    let comparisonWithPreviousWeek: WeeklySummary['comparisonWithPreviousWeek'] = null;
    try {
      const prevWeekRange = getWeekRange(prevWeekKey, config.weekStartsOn, config.timezone);
      let prevTasksDone = 0;
      let prevFocusMins = 0;
      let prevScoreSum = 0;

      for (const pDay of prevWeekRange.days) {
        const pSummary = this.generateDailySummary(pDay, tasks, timeEntries, config);
        prevTasksDone += pSummary.tasksCompleted.length;
        prevFocusMins += pSummary.focusTimeMinutes;
        prevScoreSum += pSummary.score.score;
      }

      const prevAvgScore = Math.round(prevScoreSum / prevWeekRange.days.length);

      comparisonWithPreviousWeek = {
        tasksDoneDelta: totalTasksDone - prevTasksDone,
        focusMinutesDelta: Math.round((totalFocusMinutes - prevFocusMins) * 10) / 10,
        scoreDelta: averageScore - prevAvgScore,
      };
    } catch {
      // Omit comparison if previous week data calculation encounters error
    }

    return {
      weekStart,
      weekEnd,
      totalTasksDone,
      totalTimeMinutes: Math.round(totalTimeMinutes * 10) / 10,
      totalFocusMinutes: Math.round(totalFocusMinutes * 10) / 10,
      averageScore,
      dailyTrend: dayTrends,
      sparkline,
      bestDay,
      worstDay,
      peakTimeWindow,
      categoryDistribution,
      comparisonWithPreviousWeek,
    };
  }

  private static generateSparkline(numbers: number[]): string {
    const ticks = [' ', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
    const min = 0;
    const max = 100;

    return numbers
      .map((n) => {
        const val = Math.max(min, Math.min(max, n));
        const index = Math.min(ticks.length - 1, Math.floor((val / max) * ticks.length));
        return ticks[index]!;
      })
      .join('');
  }

  private static generateDailyInsight(params: {
    score: number;
    focusMinutes: number;
    targetFocus: number;
    tasksCompletedCount: number;
    tasksMissedCount: number;
    streakDays: number;
  }): string {
    const { score, focusMinutes, targetFocus, tasksCompletedCount, tasksMissedCount, streakDays } =
      params;

    if (score >= 90) {
      if (streakDays >= 3) {
        return `Outstanding performance! Crushed focus goals and maintaining a ${streakDays}-day streak.`;
      }
      return 'Exceptional focus and execution across all planned goals today!';
    }

    if (score >= 75) {
      if (tasksMissedCount > 0) {
        return `Solid day (${Math.round(focusMinutes)}m focus), but ${tasksMissedCount} task(s) slipped past deadline.`;
      }
      return 'Great productivity flow; targets well matched to output.';
    }

    if (focusMinutes >= targetFocus && tasksMissedCount > 0) {
      return `Strong deep work time (${Math.round(focusMinutes)}m), but task prioritization needs tightening.`;
    }

    if (tasksCompletedCount > 0 && focusMinutes < targetFocus * 0.5) {
      return 'Completed tasks today, but deep focus time fell short of target hours.';
    }

    if (tasksMissedCount > 2) {
      return `Multiple tasks overdue (${tasksMissedCount}); consider reducing commitments or re-estimating.`;
    }

    return 'A steady day. Focus on uninterrupted blocks tomorrow to lift deep work velocity.';
  }
}
