import { Task, ActivityCategory } from './models.js';
import { ProductivityScore } from './score.js';

export interface CategorySummary {
  category: ActivityCategory;
  minutes: number;
  percentage: number;
  entryCount: number;
}

export interface DailySummary {
  date: string; // 'YYYY-MM-DD'
  tasksCompleted: Task[];
  tasksMissed: Task[]; // due on or before this date, but not done
  categoryBreakdown: CategorySummary[];
  totalTimeMinutes: number;
  focusTimeMinutes: number;
  topActivity: {
    activity: string;
    category: ActivityCategory;
    minutes: number;
  } | null;
  score: ProductivityScore;
  insight: string; // One-line intelligent actionable summary
}

export interface DayTrend {
  date: string; // 'YYYY-MM-DD'
  dayOfWeek: string; // 'Mon', 'Tue', etc.
  score: number;
  focusMinutes: number;
  tasksCompleted: number;
}

export interface TimeWindowProductivity {
  window: string; // e.g. "10:00 - 12:00"
  totalMinutes: number;
  focusMinutes: number;
}

export interface WeeklySummary {
  weekStart: string; // 'YYYY-MM-DD'
  weekEnd: string; // 'YYYY-MM-DD'
  totalTasksDone: number;
  totalTimeMinutes: number;
  totalFocusMinutes: number;
  averageScore: number;
  dailyTrend: DayTrend[];
  sparkline: string; // e.g. " ▃▅▇█"
  bestDay: { date: string; score: number } | null;
  worstDay: { date: string; score: number } | null;
  peakTimeWindow: TimeWindowProductivity | null;
  categoryDistribution: CategorySummary[];
  comparisonWithPreviousWeek: {
    tasksDoneDelta: number; // e.g. +3 or -2
    focusMinutesDelta: number;
    scoreDelta: number;
  } | null;
}
