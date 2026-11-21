import { Task, TimeEntry } from '../types/models.js';
import { DayflowConfig } from '../types/config.js';
import { ProductivityScore, ScoreBreakdown } from '../types/score.js';
import { isTimestampOnDate } from '../utils/date.js';

export interface ScoreInputs {
  dateKey: string;
  tasks: Task[];
  timeEntries: TimeEntry[];
  config: DayflowConfig;
  streakDays?: number;
}

export class ScoreCalculator {
  /**
   * Calculates the productivity score for a specific date.
   */
  static calculate(inputs: ScoreInputs): ProductivityScore {
    const { dateKey, tasks, timeEntries, config, streakDays = 0 } = inputs;
    const timezone = config.timezone;
    const weights = config.weights;

    // 1. Filter tasks planned or completed for this date
    // Planned: tasks due on dateKey, OR completed on dateKey, OR created on dateKey
    const relevantTasks = tasks.filter((t) => {
      if (t.dueDate === dateKey) return true;
      if (t.completedAt && isTimestampOnDate(t.completedAt, dateKey, timezone)) return true;
      if (isTimestampOnDate(t.createdAt, dateKey, timezone)) return true;
      return false;
    });

    const completedTasksToday = tasks.filter(
      (t) =>
        t.status === 'done' && t.completedAt && isTimestampOnDate(t.completedAt, dateKey, timezone),
    );

    // Total planned tasks for today: tasks with dueDate === dateKey, plus tasks worked/completed today if dueDate wasn't set
    const plannedTasksMap = new Map<string, Task>();
    for (const t of relevantTasks) {
      if (t.dueDate === dateKey) {
        plannedTasksMap.set(t.id, t);
      }
    }
    for (const t of completedTasksToday) {
      plannedTasksMap.set(t.id, t);
    }
    const plannedTasks = Array.from(plannedTasksMap.values());

    // 2. Focus Time (0 - 100)
    const dayEntries = timeEntries.filter((e) => isTimestampOnDate(e.startTime, dateKey, timezone));
    const focusMinutes = dayEntries
      .filter((e) => e.category.toLowerCase() === 'deep work')
      .reduce((sum, e) => sum + e.durationMinutes, 0);

    const hasAnyActivity = completedTasksToday.length > 0 || dayEntries.length > 0;

    // 1. Task Completion Rate (0 - 100)
    let compScore = 0;
    if (plannedTasks.length > 0) {
      const doneCount = plannedTasks.filter((t) => t.status === 'done').length;
      compScore = Math.min(100, (doneCount / plannedTasks.length) * 100);
    } else if (completedTasksToday.length > 0 || hasAnyActivity) {
      compScore = 100;
    }
    compScore = Math.round(compScore * 100) / 100;

    const targetFocus = config.targetFocusMinutes > 0 ? config.targetFocusMinutes : 240;
    const focusScore = Math.min(100, Math.round((focusMinutes / targetFocus) * 10000) / 100);

    // 3. Priority-Weighted Completion (0 - 100)
    const priorityWeights: Record<string, number> = {
      high: 3,
      medium: 2,
      low: 1,
    };

    let priorityScore = 0;
    let completedWeight = 0;
    let totalPlannedWeight = 0;

    if (plannedTasks.length > 0) {
      for (const t of plannedTasks) {
        const w = priorityWeights[t.priority] || 2;
        totalPlannedWeight += w;
        if (t.status === 'done') {
          completedWeight += w;
        }
      }
      priorityScore =
        totalPlannedWeight > 0 ? Math.min(100, (completedWeight / totalPlannedWeight) * 100) : 100;
    } else if (completedTasksToday.length > 0) {
      priorityScore = 100;
      for (const t of completedTasksToday) {
        const w = priorityWeights[t.priority] || 2;
        completedWeight += w;
        totalPlannedWeight += w;
      }
    } else if (hasAnyActivity) {
      priorityScore = 100;
    }
    priorityScore = Math.round(priorityScore * 100) / 100;

    // 4. Estimate Accuracy (0 - 100)
    // For completed tasks with estimates
    let evaluatedAccuracyCount = 0;
    let sumAccuracy = 0;

    for (const task of completedTasksToday) {
      if (task.estimate && task.estimate > 0) {
        const actualMinutes = timeEntries
          .filter((e) => e.taskId === task.id)
          .reduce((sum, e) => sum + e.durationMinutes, 0);

        // If time was logged on this task
        if (actualMinutes > 0) {
          evaluatedAccuracyCount++;
          const errorRatio = Math.abs(actualMinutes - task.estimate) / task.estimate;
          const accuracy = Math.max(0, 100 - errorRatio * 100);
          sumAccuracy += accuracy;
        }
      }
    }

    const accuracyScore =
      evaluatedAccuracyCount > 0
        ? Math.round((sumAccuracy / evaluatedAccuracyCount) * 100) / 100
        : hasAnyActivity
          ? 100
          : 0;

    // Base score calculation
    const compPoints = Math.round(compScore * weights.taskCompletion * 100) / 100;
    const focusPoints = Math.round(focusScore * weights.focusTime * 100) / 100;
    const priorityPoints = Math.round(priorityScore * weights.priorityCompletion * 100) / 100;
    const accuracyPoints = Math.round(accuracyScore * weights.estimateAccuracy * 100) / 100;

    const baseScore =
      Math.round((compPoints + focusPoints + priorityPoints + accuracyPoints) * 100) / 100;

    // 5. Penalties & Bonuses
    // Overdue tasks: incomplete tasks where dueDate < dateKey
    const overdueTasks = tasks.filter(
      (t) => t.status !== 'done' && t.dueDate && t.dueDate < dateKey,
    );
    const overduePenaltyRaw = overdueTasks.length * (config.penalties.overduePerTask ?? 5);
    const overduePenalty = Math.min(20, overduePenaltyRaw); // Capped at 20 points

    const streakBonusRaw = streakDays * (config.bonuses.streakPerDay ?? 2);
    const streakBonus = Math.min(10, streakBonusRaw); // Capped at 10 points

    const finalScore = Math.max(
      0,
      Math.min(100, Math.round(baseScore - overduePenalty + streakBonus)),
    );

    const breakdown: ScoreBreakdown = {
      taskCompletion: {
        score: compScore,
        weight: weights.taskCompletion,
        points: compPoints,
        doneCount: plannedTasks.filter((t) => t.status === 'done').length,
        totalPlannedCount: plannedTasks.length,
      },
      focusTime: {
        score: focusScore,
        weight: weights.focusTime,
        points: focusPoints,
        focusMinutes: Math.round(focusMinutes * 10) / 10,
        targetMinutes: targetFocus,
      },
      priorityCompletion: {
        score: priorityScore,
        weight: weights.priorityCompletion,
        points: priorityPoints,
        completedWeight,
        totalPlannedWeight,
      },
      estimateAccuracy: {
        score: accuracyScore,
        weight: weights.estimateAccuracy,
        points: accuracyPoints,
        evaluatedTasksCount: evaluatedAccuracyCount,
      },
    };

    const formula =
      `Score = clamp(0, 100, round(${weights.taskCompletion}×${compScore} + ${weights.focusTime}×${focusScore} + ` +
      `${weights.priorityCompletion}×${priorityScore} + ${weights.estimateAccuracy}×${accuracyScore}` +
      (overduePenalty > 0 ? ` - ${overduePenalty}` : '') +
      (streakBonus > 0 ? ` + ${streakBonus}` : '') +
      `)) = ${finalScore}`;

    return {
      date: dateKey,
      score: finalScore,
      baseScore,
      breakdown,
      modifiers: {
        overduePenalty: -overduePenalty,
        overdueTasksCount: overdueTasks.length,
        streakBonus,
        streakDays,
      },
      formula,
    };
  }

  /**
   * Calculates consecutive active days (score >= 60) up to the day before targetDate.
   */
  static calculateStreak(
    dateKey: string,
    tasks: Task[],
    timeEntries: TimeEntry[],
    config: DayflowConfig,
    maxDaysToCheck = 30,
  ): number {
    const [year, month, day] = dateKey.split('-').map(Number);
    if (!year || !month || !day) return 0;

    let streak = 0;
    const baseDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

    for (let i = 1; i <= maxDaysToCheck; i++) {
      const prevDate = new Date(baseDate.getTime() - i * 24 * 60 * 60 * 1000);
      const y = prevDate.getUTCFullYear();
      const m = String(prevDate.getUTCMonth() + 1).padStart(2, '0');
      const d = String(prevDate.getUTCDate()).padStart(2, '0');
      const prevKey = `${y}-${m}-${d}`;

      // Check if previous day had score >= 60 (without streak bonus to avoid recursion)
      const dayScore = ScoreCalculator.calculate({
        dateKey: prevKey,
        tasks,
        timeEntries,
        config,
        streakDays: 0,
      });

      if (dayScore.score >= 60) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }
}
