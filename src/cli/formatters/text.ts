import { DailySummary, WeeklySummary } from '../../types/summary.js';
import { Task } from '../../types/models.js';
import { colors, renderScorePill, renderProgressBar } from '../utils.js';
import { formatDurationMinutes } from '../../utils/date.js';

export function formatTaskListText(tasks: Task[]): string {
  if (tasks.length === 0) {
    return colors.dim('No tasks found.');
  }

  const lines: string[] = [];
  lines.push(colors.bold('TASKS'));
  lines.push(colors.dim('─'.repeat(70)));

  for (const t of tasks) {
    let statusIcon = '[ ]';
    if (t.status === 'done') statusIcon = colors.green('[✔]');
    else if (t.status === 'in-progress') statusIcon = colors.yellow('[▶]');

    let priorityStr = `[${t.priority}]`;
    if (t.priority === 'high') priorityStr = colors.red(priorityStr);
    else if (t.priority === 'medium') priorityStr = colors.yellow(priorityStr);
    else priorityStr = colors.dim(priorityStr);

    const tagStr = t.tag ? colors.blue(`#${t.tag}`) : '';
    const estStr = t.estimate ? colors.dim(`(${formatDurationMinutes(t.estimate)})`) : '';
    const dueStr = t.dueDate ? colors.magenta(`due:${t.dueDate}`) : '';

    const idStr = colors.dim(t.id);
    const meta = [priorityStr, tagStr, estStr, dueStr].filter(Boolean).join(' ');

    lines.push(`  ${statusIcon} ${colors.bold(t.title)} ${meta}  ${idStr}`);
  }

  return lines.join('\n');
}

export function formatDailySummaryText(summary: DailySummary): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(colors.bold(`DAYFLOW DAILY SUMMARY — ${summary.date}`));
  lines.push(colors.dim('═'.repeat(60)));

  // Score section
  const scoreBadge = renderScorePill(summary.score.score);
  lines.push(`Productivity Score: ${scoreBadge} (Base: ${summary.score.baseScore})`);
  lines.push(colors.dim(`Insight: "${summary.insight}"`));
  lines.push('');

  // Score breakdown
  lines.push(colors.bold('Score Breakdown:'));
  const b = summary.score.breakdown;
  lines.push(
    `  • Task Completion:    ${renderProgressBar(b.taskCompletion.score, 15)}  (${b.taskCompletion.doneCount}/${b.taskCompletion.totalPlannedCount} tasks)`,
  );
  lines.push(
    `  • Focus Target:       ${renderProgressBar(b.focusTime.score, 15)}  (${formatDurationMinutes(b.focusTime.focusMinutes)} / ${formatDurationMinutes(b.focusTime.targetMinutes)})`,
  );
  lines.push(
    `  • Priority Weighting: ${renderProgressBar(b.priorityCompletion.score, 15)}  (${b.priorityCompletion.completedWeight}/${b.priorityCompletion.totalPlannedWeight} pts)`,
  );
  lines.push(`  • Estimate Accuracy:  ${renderProgressBar(b.estimateAccuracy.score, 15)}`);

  if (summary.score.modifiers.overduePenalty < 0 || summary.score.modifiers.streakBonus > 0) {
    const pen =
      summary.score.modifiers.overduePenalty < 0
        ? colors.red(`${summary.score.modifiers.overduePenalty} overdue penalty`)
        : '';
    const bon =
      summary.score.modifiers.streakBonus > 0
        ? colors.green(
            `+${summary.score.modifiers.streakBonus} streak bonus (${summary.score.modifiers.streakDays}d)`,
          )
        : '';
    lines.push(`  • Modifiers:          ${[pen, bon].filter(Boolean).join(', ')}`);
  }

  lines.push('');
  // Task summary
  lines.push(colors.bold('Tasks Overview:'));
  lines.push(`  • Completed: ${colors.green(String(summary.tasksCompleted.length))}`);
  if (summary.tasksCompleted.length > 0) {
    for (const t of summary.tasksCompleted) {
      lines.push(`    - ${t.title}`);
    }
  }
  lines.push(
    `  • Missed / Overdue: ${summary.tasksMissed.length > 0 ? colors.red(String(summary.tasksMissed.length)) : colors.dim('0')}`,
  );
  if (summary.tasksMissed.length > 0) {
    for (const t of summary.tasksMissed) {
      lines.push(`    - ${colors.red(t.title)} (due: ${t.dueDate})`);
    }
  }

  lines.push('');
  // Time & Categories
  lines.push(colors.bold('Time & Activities:'));
  lines.push(
    `  • Total Time Logged: ${formatDurationMinutes(summary.totalTimeMinutes)} (Deep Work: ${colors.cyan(formatDurationMinutes(summary.focusTimeMinutes))})`,
  );
  if (summary.topActivity) {
    lines.push(
      `  • Top Activity:      ${colors.bold(summary.topActivity.activity)} (${formatDurationMinutes(summary.topActivity.minutes)} [${summary.topActivity.category}])`,
    );
  }

  if (summary.categoryBreakdown.length > 0) {
    lines.push('');
    lines.push(colors.bold('Category Breakdown:'));
    for (const c of summary.categoryBreakdown) {
      lines.push(
        `  - ${c.category.padEnd(14)}: ${formatDurationMinutes(c.minutes).padEnd(8)} (${c.percentage}%) [${c.entryCount} logs]`,
      );
    }
  }

  lines.push(colors.dim('═'.repeat(60)));
  return lines.join('\n');
}

export function formatWeeklySummaryText(summary: WeeklySummary): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(colors.bold(`DAYFLOW WEEKLY SUMMARY (${summary.weekStart} to ${summary.weekEnd})`));
  lines.push(colors.dim('═'.repeat(65)));

  lines.push(`Average Score:       ${renderScorePill(summary.averageScore)}`);
  lines.push(`Daily Score Trend:   ${colors.cyan(summary.sparkline)}`);
  lines.push(`Total Tasks Done:    ${colors.bold(String(summary.totalTasksDone))}`);
  lines.push(
    `Total Time Logged:   ${formatDurationMinutes(summary.totalTimeMinutes)} (Deep Work: ${colors.cyan(formatDurationMinutes(summary.totalFocusMinutes))})`,
  );

  if (summary.bestDay) {
    lines.push(
      `Best Day:            ${colors.green(`${summary.bestDay.date} (${summary.bestDay.score}/100)`)}`,
    );
  }
  if (summary.worstDay) {
    lines.push(
      `Worst Day:           ${colors.yellow(`${summary.worstDay.date} (${summary.worstDay.score}/100)`)}`,
    );
  }
  if (summary.peakTimeWindow) {
    lines.push(
      `Peak Window:         ${colors.bold(summary.peakTimeWindow.window)} (${formatDurationMinutes(summary.peakTimeWindow.focusMinutes)} deep work)`,
    );
  }

  if (summary.comparisonWithPreviousWeek) {
    const comp = summary.comparisonWithPreviousWeek;
    const taskDelta =
      comp.tasksDoneDelta >= 0 ? `+${comp.tasksDoneDelta}` : `${comp.tasksDoneDelta}`;
    const scoreDelta = comp.scoreDelta >= 0 ? `+${comp.scoreDelta}` : `${comp.scoreDelta}`;
    const focusDelta =
      comp.focusMinutesDelta >= 0
        ? `+${formatDurationMinutes(comp.focusMinutesDelta)}`
        : `-${formatDurationMinutes(Math.abs(comp.focusMinutesDelta))}`;
    lines.push(
      `vs Previous Week:    Tasks: ${taskDelta} | Focus: ${focusDelta} | Score: ${scoreDelta}`,
    );
  }

  lines.push('');
  lines.push(colors.bold('Daily Breakdown:'));
  for (const day of summary.dailyTrend) {
    const scorePill = renderScorePill(day.score);
    lines.push(
      `  ${day.dayOfWeek} ${day.date}: ${scorePill.padEnd(16)} | Focus: ${formatDurationMinutes(day.focusMinutes).padEnd(8)} | Done: ${day.tasksCompleted}`,
    );
  }

  if (summary.categoryDistribution.length > 0) {
    lines.push('');
    lines.push(colors.bold('Category Distribution:'));
    for (const c of summary.categoryDistribution) {
      lines.push(
        `  - ${c.category.padEnd(14)}: ${formatDurationMinutes(c.minutes).padEnd(8)} (${c.percentage}%)`,
      );
    }
  }

  lines.push(colors.dim('═'.repeat(65)));
  return lines.join('\n');
}
