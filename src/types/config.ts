export interface ScoreWeights {
  taskCompletion: number; // e.g. 0.25 (25%)
  focusTime: number; // e.g. 0.30 (30%)
  priorityCompletion: number; // e.g. 0.25 (25%)
  estimateAccuracy: number; // e.g. 0.20 (20%)
}

export interface ScorePenalties {
  overduePerTask: number; // default 5 (capped at 20)
}

export interface ScoreBonuses {
  streakPerDay: number; // default 2 (capped at 10)
}

export interface DayflowConfig {
  version: number;
  targetFocusMinutes: number; // default 240 (4 hours)
  workingHours: {
    start: string; // '09:00'
    end: string; // '17:00'
  };
  weekStartsOn: 'monday' | 'sunday'; // default 'monday'
  timezone: string; // default system timezone e.g. 'America/New_York' or 'Asia/Kolkata'
  weights: ScoreWeights;
  penalties: ScorePenalties;
  bonuses: ScoreBonuses;
}

export const DEFAULT_CONFIG: DayflowConfig = {
  version: 1,
  targetFocusMinutes: 240,
  workingHours: {
    start: '09:00',
    end: '17:00',
  },
  weekStartsOn: 'monday',
  timezone:
    typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' : 'UTC',
  weights: {
    taskCompletion: 0.25,
    focusTime: 0.3,
    priorityCompletion: 0.25,
    estimateAccuracy: 0.2,
  },
  penalties: {
    overduePerTask: 5,
  },
  bonuses: {
    streakPerDay: 2,
  },
};
