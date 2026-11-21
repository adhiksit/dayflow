export interface ScoreComponentDetail {
  score: number; // 0 - 100
  weight: number; // 0 - 1
  points: number; // score * weight
  [key: string]: unknown;
}

export interface TaskCompletionDetail extends ScoreComponentDetail {
  doneCount: number;
  totalPlannedCount: number;
}

export interface FocusTimeDetail extends ScoreComponentDetail {
  focusMinutes: number;
  targetMinutes: number;
}

export interface PriorityCompletionDetail extends ScoreComponentDetail {
  completedWeight: number;
  totalPlannedWeight: number;
}

export interface EstimateAccuracyDetail extends ScoreComponentDetail {
  evaluatedTasksCount: number;
}

export interface ScoreBreakdown {
  taskCompletion: TaskCompletionDetail;
  focusTime: FocusTimeDetail;
  priorityCompletion: PriorityCompletionDetail;
  estimateAccuracy: EstimateAccuracyDetail;
}

export interface ScoreModifiers {
  overduePenalty: number; // negative or 0
  overdueTasksCount: number;
  streakBonus: number; // positive or 0
  streakDays: number;
}

export interface ProductivityScore {
  date: string; // 'YYYY-MM-DD'
  score: number; // 0 - 100 integer
  baseScore: number; // sum of weighted component points
  breakdown: ScoreBreakdown;
  modifiers: ScoreModifiers;
  formula: string; // human-readable explanation
}
