import { TimeEntry, ActiveTimer, ActivityCategory } from '../types/models.js';
import { generateId } from '../utils/id.js';
import { Clock } from '../utils/clock.js';
import { isTimestampOnDate, resolveDateString } from '../utils/date.js';

export interface StartTimerOptions {
  activity: string;
  category?: ActivityCategory;
  taskId?: string;
}

export interface ManualLogOptions {
  activity: string;
  category?: ActivityCategory;
  durationMinutes: number;
  date?: string; // YYYY-MM-DD (defaults to today)
  taskId?: string;
  startTime?: string; // optional UTC ISO
}

export class TimeTracker {
  private timeEntries: TimeEntry[];
  private activeTimer: ActiveTimer | null;
  private clock: Clock;
  private timezone: string;

  constructor(
    timeEntries: TimeEntry[],
    activeTimer: ActiveTimer | null,
    clock: Clock,
    timezone: string,
  ) {
    this.timeEntries = timeEntries;
    this.activeTimer = activeTimer;
    this.clock = clock;
    this.timezone = timezone;
  }

  getTimeEntries(): TimeEntry[] {
    return this.timeEntries;
  }

  getActiveTimer(): ActiveTimer | null {
    return this.activeTimer;
  }

  /**
   * Returns current active timer status with dynamic elapsed seconds.
   */
  getStatus(): {
    active: boolean;
    timer?: {
      id: string;
      activity: string;
      category: ActivityCategory;
      taskId?: string;
      isPaused: boolean;
      elapsedSeconds: number;
      startTime: string;
    };
  } {
    if (!this.activeTimer) {
      return { active: false };
    }

    let elapsed = this.activeTimer.accumulatedSeconds;
    const isPaused = Boolean(this.activeTimer.pausedAt);

    if (!isPaused) {
      const startMs = new Date(this.activeTimer.startTime).getTime();
      const nowMs = this.clock.now().getTime();
      const currentSegment = Math.max(0, Math.floor((nowMs - startMs) / 1000));
      elapsed += currentSegment;
    }

    return {
      active: true,
      timer: {
        id: this.activeTimer.id,
        activity: this.activeTimer.activity,
        category: this.activeTimer.category,
        taskId: this.activeTimer.taskId,
        isPaused,
        elapsedSeconds: elapsed,
        startTime: this.activeTimer.startTime,
      },
    };
  }

  /**
   * Starts a timer. If another timer is currently running, stops it and saves it first.
   */
  startTimer(options: StartTimerOptions): { newTimer: ActiveTimer; previousEntry?: TimeEntry } {
    if (!options.activity || !options.activity.trim()) {
      throw new Error('Timer activity cannot be empty.');
    }

    let previousEntry: TimeEntry | undefined;
    if (this.activeTimer) {
      previousEntry = this.stopTimer();
    }

    const nowIso = this.clock.now().toISOString();
    const timer: ActiveTimer = {
      id: generateId('tm'),
      taskId: options.taskId,
      activity: options.activity.trim(),
      category: options.category?.trim() || 'deep work',
      startTime: nowIso,
      accumulatedSeconds: 0,
    };

    this.activeTimer = timer;
    return { newTimer: timer, previousEntry };
  }

  /**
   * Pauses the active timer.
   */
  pauseTimer(): ActiveTimer {
    if (!this.activeTimer) {
      throw new Error('No active timer running.');
    }

    if (this.activeTimer.pausedAt) {
      // Already paused
      return this.activeTimer;
    }

    const now = this.clock.now();
    const startMs = new Date(this.activeTimer.startTime).getTime();
    const segmentSeconds = Math.max(0, Math.floor((now.getTime() - startMs) / 1000));

    this.activeTimer.accumulatedSeconds += segmentSeconds;
    this.activeTimer.pausedAt = now.toISOString();

    return this.activeTimer;
  }

  /**
   * Resumes the active timer if paused.
   */
  resumeTimer(): ActiveTimer {
    if (!this.activeTimer) {
      throw new Error('No active timer to resume.');
    }

    if (!this.activeTimer.pausedAt) {
      // Not paused
      return this.activeTimer;
    }

    this.activeTimer.pausedAt = undefined;
    this.activeTimer.startTime = this.clock.now().toISOString();

    return this.activeTimer;
  }

  /**
   * Stops the active timer and records a TimeEntry.
   */
  stopTimer(): TimeEntry {
    if (!this.activeTimer) {
      throw new Error('No active timer running.');
    }

    const now = this.clock.now();
    let totalSeconds = this.activeTimer.accumulatedSeconds;

    if (!this.activeTimer.pausedAt) {
      const startMs = new Date(this.activeTimer.startTime).getTime();
      const segmentSeconds = Math.max(0, Math.floor((now.getTime() - startMs) / 1000));
      totalSeconds += segmentSeconds;
    }

    // Convert to minutes, rounded to 2 decimal places, minimum 0.1 min (6 sec)
    const durationMinutes = Math.max(0.1, Math.round((totalSeconds / 60) * 100) / 100);

    const entry: TimeEntry = {
      id: generateId('te'),
      taskId: this.activeTimer.taskId,
      activity: this.activeTimer.activity,
      category: this.activeTimer.category,
      startTime: this.activeTimer.startTime,
      endTime: now.toISOString(),
      durationMinutes,
      isManual: false,
    };

    this.timeEntries.push(entry);
    this.activeTimer = null;

    return entry;
  }

  /**
   * Logs manual time spent.
   */
  logManualTime(options: ManualLogOptions): TimeEntry {
    if (!options.activity || !options.activity.trim()) {
      throw new Error('Activity description cannot be empty.');
    }

    if (options.durationMinutes <= 0) {
      throw new Error('Duration must be greater than zero.');
    }

    const durationMinutes = Math.round(options.durationMinutes * 100) / 100;
    const now = this.clock.now();

    let startTimeIso: string;
    let endTimeIso: string;

    if (options.startTime) {
      startTimeIso = options.startTime;
      const endMs = new Date(options.startTime).getTime() + durationMinutes * 60 * 1000;
      endTimeIso = new Date(endMs).toISOString();
    } else {
      // Determine date
      const targetDateKey = resolveDateString(options.date, now, this.timezone);
      const [year, month, day] = targetDateKey.split('-').map(Number);
      if (!year || !month || !day) {
        throw new Error(`Invalid date format: ${options.date}`);
      }

      // Default midday timestamp for target date
      const baseDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
      startTimeIso = baseDate.toISOString();
      const endMs = baseDate.getTime() + durationMinutes * 60 * 1000;
      endTimeIso = new Date(endMs).toISOString();
    }

    const entry: TimeEntry = {
      id: generateId('te'),
      taskId: options.taskId,
      activity: options.activity.trim(),
      category: options.category?.trim() || 'deep work',
      startTime: startTimeIso,
      endTime: endTimeIso,
      durationMinutes,
      isManual: true,
    };

    this.timeEntries.push(entry);
    return entry;
  }

  /**
   * Returns all time entries that occurred on a specific date in the configured timezone.
   */
  getEntriesForDate(dateKey: string): TimeEntry[] {
    return this.timeEntries.filter((entry) =>
      isTimestampOnDate(entry.startTime, dateKey, this.timezone),
    );
  }

  /**
   * Returns total actual minutes logged for a specific task.
   */
  getTimeForTask(taskId: string): number {
    return this.timeEntries
      .filter((e) => e.taskId === taskId)
      .reduce((sum, e) => sum + e.durationMinutes, 0);
  }
}
