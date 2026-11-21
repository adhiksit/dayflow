import { DailySummary, WeeklySummary } from '../../types/summary.js';
import { Task } from '../../types/models.js';
import { formatDurationMinutes } from '../../utils/date.js';

export function formatTaskListMarkdown(tasks: Task[]): string {
  if (tasks.length === 0) {
    return '_No tasks found._';
  }

  const lines: string[] = [];
  lines.push('| Status | Title | Priority | Tag | Estimate | Due Date | ID |');
  lines.push('|---|---|---|---|---|---|---|');

  for (const t of tasks) {
    const status =
      t.status === 'done' ? '✅ done' : t.status === 'in-progress' ? '▶️ in-progress' : '⏳ todo';
    const tag = t.tag ? `\`#${t.tag}\`` : '-';
    const est = t.estimate ? formatDurationMinutes(t.estimate) : '-';
    const due = t.dueDate || '-';
    lines.push(
      `| ${status} | ${t.title} | ${t.priority} | ${tag} | ${est} | ${due} | \`${t.id}\` |`,
    );
  }

  return lines.join('\n');
}

export function formatDailySummaryMarkdown(summary: DailySummary): string {
  const lines: string[] = [];

  lines.push(`# Dayflow Daily Summary: ${summary.date}`);
  lines.push('');
  lines.push(
    `**Productivity Score:** **${summary.score.score} / 100** (Base: ${summary.score.baseScore})`,
  );
  lines.push(`> _"${summary.insight}"_`);
  lines.push('');
  lines.push('### Score Breakdown');
  lines.push('');
  lines.push('| Component | Score | Weight | Points | Metrics |');
  lines.push('|---|---|---|---|---|');
  const b = summary.score.breakdown;
  lines.push(
    `| Task Completion | ${b.taskCompletion.score}% | ${b.taskCompletion.weight * 100}% | ${b.taskCompletion.points} | ${b.taskCompletion.doneCount}/${b.taskCompletion.totalPlannedCount} tasks |`,
  );
  lines.push(
    `| Focus Time | ${b.focusTime.score}% | ${b.focusTime.weight * 100}% | ${b.focusTime.points} | ${formatDurationMinutes(b.focusTime.focusMinutes)} / ${formatDurationMinutes(b.focusTime.targetMinutes)} |`,
  );
  lines.push(
    `| Priority Weighting | ${b.priorityCompletion.score}% | ${b.priorityCompletion.weight * 100}% | ${b.priorityCompletion.points} | ${b.priorityCompletion.completedWeight}/${b.priorityCompletion.totalPlannedWeight} weight |`,
  );
  lines.push(
    `| Estimate Accuracy | ${b.estimateAccuracy.score}% | ${b.estimateAccuracy.weight * 100}% | ${b.estimateAccuracy.points} | ${b.estimateAccuracy.evaluatedTasksCount} evaluated |`,
  );
  lines.push('');

  lines.push('### Tasks');
  lines.push(`- **Completed (${summary.tasksCompleted.length}):**`);
  if (summary.tasksCompleted.length === 0) {
    lines.push('  - _None_');
  } else {
    for (const t of summary.tasksCompleted) {
      lines.push(`  - [x] ${t.title}`);
    }
  }

  lines.push(`- **Missed / Overdue (${summary.tasksMissed.length}):**`);
  if (summary.tasksMissed.length === 0) {
    lines.push('  - _None_');
  } else {
    for (const t of summary.tasksMissed) {
      lines.push(`  - [ ] **${t.title}** (due: ${t.dueDate})`);
    }
  }
  lines.push('');

  lines.push('### Time & Categories');
  lines.push(`- **Total Time Logged:** ${formatDurationMinutes(summary.totalTimeMinutes)}`);
  lines.push(`- **Deep Work Focus:** ${formatDurationMinutes(summary.focusTimeMinutes)}`);
  if (summary.topActivity) {
    lines.push(
      `- **Top Activity:** ${summary.topActivity.activity} (${formatDurationMinutes(summary.topActivity.minutes)} [${summary.topActivity.category}])`,
    );
  }
  lines.push('');

  if (summary.categoryBreakdown.length > 0) {
    lines.push('| Category | Time | Share | Logs |');
    lines.push('|---|---|---|---|');
    for (const c of summary.categoryBreakdown) {
      lines.push(
        `| ${c.category} | ${formatDurationMinutes(c.minutes)} | ${c.percentage}% | ${c.entryCount} |`,
      );
    }
  }

  return lines.join('\n');
}

export function formatWeeklySummaryMarkdown(summary: WeeklySummary): string {
  const lines: string[] = [];

  lines.push(`# Dayflow Weekly Summary: ${summary.weekStart} – ${summary.weekEnd}`);
  lines.push('');
  lines.push(`- **Average Score:** **${summary.averageScore} / 100**`);
  lines.push(`- **Score Trend:** \`${summary.sparkline}\``);
  lines.push(`- **Total Tasks Done:** ${summary.totalTasksDone}`);
  lines.push(
    `- **Total Focus Time:** ${formatDurationMinutes(summary.totalFocusMinutes)} (${formatDurationMinutes(summary.totalTimeMinutes)} total)`,
  );
  if (summary.bestDay)
    lines.push(`- **Best Day:** ${summary.bestDay.date} (${summary.bestDay.score}/100)`);
  if (summary.worstDay)
    lines.push(`- **Worst Day:** ${summary.worstDay.date} (${summary.worstDay.score}/100)`);
  if (summary.peakTimeWindow)
    lines.push(
      `- **Peak Time Window:** ${summary.peakTimeWindow.window} (${formatDurationMinutes(summary.peakTimeWindow.focusMinutes)} focus)`,
    );
  lines.push('');

  lines.push('### Daily Trend');
  lines.push('| Day | Date | Score | Focus Time | Tasks Done |');
  lines.push('|---|---|---|---|---|');
  for (const d of summary.dailyTrend) {
    lines.push(
      `| ${d.dayOfWeek} | ${d.date} | ${d.score}/100 | ${formatDurationMinutes(d.focusMinutes)} | ${d.tasksCompleted} |`,
    );
  }
  lines.push('');

  if (summary.categoryDistribution.length > 0) {
    lines.push('### Category Distribution');
    lines.push('| Category | Time | Share | Entries |');
    lines.push('|---|---|---|---|');
    for (const c of summary.categoryDistribution) {
      lines.push(
        `| ${c.category} | ${formatDurationMinutes(c.minutes)} | ${c.percentage}% | ${c.entryCount} |`,
      );
    }
  }

  return lines.join('\n');
}
