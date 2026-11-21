import { EventEmitter } from 'node:events';

type TaskPriority = 'low' | 'medium' | 'high';
type TaskStatus = 'todo' | 'in-progress' | 'done';
interface Task {
    id: string;
    title: string;
    tag?: string;
    priority: TaskPriority;
    estimate?: number;
    dueDate?: string;
    status: TaskStatus;
    createdAt: string;
    completedAt?: string;
}
type ActivityCategory = 'deep work' | 'meetings' | 'admin' | 'break' | string;
interface TimeEntry {
    id: string;
    taskId?: string;
    activity: string;
    category: ActivityCategory;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    isManual: boolean;
}
interface ActiveTimer {
    id: string;
    taskId?: string;
    activity: string;
    category: ActivityCategory;
    startTime: string;
    pausedAt?: string;
    accumulatedSeconds: number;
}
interface TaskFilter {
    date?: string;
    status?: TaskStatus;
    tag?: string;
    priority?: TaskPriority;
}

interface ScoreWeights {
    taskCompletion: number;
    focusTime: number;
    priorityCompletion: number;
    estimateAccuracy: number;
}
interface ScorePenalties {
    overduePerTask: number;
}
interface ScoreBonuses {
    streakPerDay: number;
}
interface DayflowConfig {
    version: number;
    targetFocusMinutes: number;
    workingHours: {
        start: string;
        end: string;
    };
    weekStartsOn: 'monday' | 'sunday';
    timezone: string;
    weights: ScoreWeights;
    penalties: ScorePenalties;
    bonuses: ScoreBonuses;
}
declare const DEFAULT_CONFIG: DayflowConfig;

interface ScoreComponentDetail {
    score: number;
    weight: number;
    points: number;
    [key: string]: unknown;
}
interface TaskCompletionDetail extends ScoreComponentDetail {
    doneCount: number;
    totalPlannedCount: number;
}
interface FocusTimeDetail extends ScoreComponentDetail {
    focusMinutes: number;
    targetMinutes: number;
}
interface PriorityCompletionDetail extends ScoreComponentDetail {
    completedWeight: number;
    totalPlannedWeight: number;
}
interface EstimateAccuracyDetail extends ScoreComponentDetail {
    evaluatedTasksCount: number;
}
interface ScoreBreakdown {
    taskCompletion: TaskCompletionDetail;
    focusTime: FocusTimeDetail;
    priorityCompletion: PriorityCompletionDetail;
    estimateAccuracy: EstimateAccuracyDetail;
}
interface ScoreModifiers {
    overduePenalty: number;
    overdueTasksCount: number;
    streakBonus: number;
    streakDays: number;
}
interface ProductivityScore {
    date: string;
    score: number;
    baseScore: number;
    breakdown: ScoreBreakdown;
    modifiers: ScoreModifiers;
    formula: string;
}

interface CategorySummary {
    category: ActivityCategory;
    minutes: number;
    percentage: number;
    entryCount: number;
}
interface DailySummary {
    date: string;
    tasksCompleted: Task[];
    tasksMissed: Task[];
    categoryBreakdown: CategorySummary[];
    totalTimeMinutes: number;
    focusTimeMinutes: number;
    topActivity: {
        activity: string;
        category: ActivityCategory;
        minutes: number;
    } | null;
    score: ProductivityScore;
    insight: string;
}
interface DayTrend {
    date: string;
    dayOfWeek: string;
    score: number;
    focusMinutes: number;
    tasksCompleted: number;
}
interface TimeWindowProductivity {
    window: string;
    totalMinutes: number;
    focusMinutes: number;
}
interface WeeklySummary {
    weekStart: string;
    weekEnd: string;
    totalTasksDone: number;
    totalTimeMinutes: number;
    totalFocusMinutes: number;
    averageScore: number;
    dailyTrend: DayTrend[];
    sparkline: string;
    bestDay: {
        date: string;
        score: number;
    } | null;
    worstDay: {
        date: string;
        score: number;
    } | null;
    peakTimeWindow: TimeWindowProductivity | null;
    categoryDistribution: CategorySummary[];
    comparisonWithPreviousWeek: {
        tasksDoneDelta: number;
        focusMinutesDelta: number;
        scoreDelta: number;
    } | null;
}

interface DayflowEvents {
    taskAdded: (task: Task) => void;
    taskUpdated: (task: Task) => void;
    taskCompleted: (task: Task) => void;
    taskReopened: (task: Task) => void;
    taskDeleted: (taskId: string) => void;
    timerStarted: (timer: ActiveTimer) => void;
    timerStopped: (entry: TimeEntry) => void;
    timerPaused: (timer: ActiveTimer) => void;
    timerResumed: (timer: ActiveTimer) => void;
    timeLogged: (entry: TimeEntry) => void;
    scoreUpdated: (score: ProductivityScore) => void;
}

interface DayflowData {
    schemaVersion: number;
    config: DayflowConfig;
    tasks: Task[];
    timeEntries: TimeEntry[];
    activeTimer: ActiveTimer | null;
}
interface StorageAdapter {
    load(): Promise<DayflowData>;
    save(data: DayflowData): Promise<void>;
}

interface Clock {
    now(): Date;
}
declare class SystemClock implements Clock {
    now(): Date;
}
declare class SettableClock implements Clock {
    private currentTime;
    constructor(initialTime?: Date | string);
    now(): Date;
    setTime(time: Date | string): void;
    advanceMinutes(minutes: number): void;
    advanceSeconds(seconds: number): void;
    advanceDays(days: number): void;
}

interface CreateTaskOptions {
    title: string;
    tag?: string;
    priority?: TaskPriority;
    estimate?: number;
    dueDate?: string;
}
interface UpdateTaskOptions {
    title?: string;
    tag?: string;
    priority?: TaskPriority;
    estimate?: number;
    dueDate?: string;
    status?: TaskStatus;
}
declare class TaskManager {
    private tasks;
    private clock;
    private timezone;
    constructor(tasks: Task[], clock: Clock, timezone: string);
    getTasks(): Task[];
    addTask(options: CreateTaskOptions): Task;
    getTask(id: string): Task | undefined;
    updateTask(id: string, updates: UpdateTaskOptions): Task;
    completeTask(id: string): Task;
    reopenTask(id: string): Task;
    deleteTask(id: string): Task;
    listTasks(filter?: TaskFilter): Task[];
    /**
     * Identifies overdue tasks as of a reference date.
     * A task is overdue if status is not 'done' and dueDate < referenceDate.
     */
    getOverdueTasks(asOfDateKey?: string): Task[];
}

interface StartTimerOptions {
    activity: string;
    category?: ActivityCategory;
    taskId?: string;
}
interface ManualLogOptions {
    activity: string;
    category?: ActivityCategory;
    durationMinutes: number;
    date?: string;
    taskId?: string;
    startTime?: string;
}
declare class TimeTracker {
    private timeEntries;
    private activeTimer;
    private clock;
    private timezone;
    constructor(timeEntries: TimeEntry[], activeTimer: ActiveTimer | null, clock: Clock, timezone: string);
    getTimeEntries(): TimeEntry[];
    getActiveTimer(): ActiveTimer | null;
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
    };
    /**
     * Starts a timer. If another timer is currently running, stops it and saves it first.
     */
    startTimer(options: StartTimerOptions): {
        newTimer: ActiveTimer;
        previousEntry?: TimeEntry;
    };
    /**
     * Pauses the active timer.
     */
    pauseTimer(): ActiveTimer;
    /**
     * Resumes the active timer if paused.
     */
    resumeTimer(): ActiveTimer;
    /**
     * Stops the active timer and records a TimeEntry.
     */
    stopTimer(): TimeEntry;
    /**
     * Logs manual time spent.
     */
    logManualTime(options: ManualLogOptions): TimeEntry;
    /**
     * Returns all time entries that occurred on a specific date in the configured timezone.
     */
    getEntriesForDate(dateKey: string): TimeEntry[];
    /**
     * Returns total actual minutes logged for a specific task.
     */
    getTimeForTask(taskId: string): number;
}

interface DayflowOptions {
    storage?: StorageAdapter;
    clock?: Clock;
    config?: Partial<DayflowConfig>;
}
declare class Dayflow extends EventEmitter {
    private storage;
    private clock;
    private config;
    private tasks;
    private timeEntries;
    private activeTimer;
    private isLoaded;
    private taskManager;
    private timeTracker;
    constructor(options?: DayflowOptions);
    on<E extends keyof DayflowEvents>(event: E, listener: DayflowEvents[E]): this;
    emit<E extends keyof DayflowEvents>(event: E, ...args: Parameters<DayflowEvents[E]>): boolean;
    /**
     * Initializes Dayflow by loading state from storage adapter.
     */
    init(): Promise<this>;
    private initManagers;
    private ensureLoaded;
    private persist;
    getConfig(): DayflowConfig;
    updateConfig(updates: Partial<DayflowConfig>): Promise<DayflowConfig>;
    addTask(options: CreateTaskOptions): Promise<Task>;
    updateTask(id: string, updates: UpdateTaskOptions): Promise<Task>;
    completeTask(id: string): Promise<Task>;
    reopenTask(id: string): Promise<Task>;
    deleteTask(id: string): Promise<Task>;
    listTasks(filter?: TaskFilter): Promise<Task[]>;
    getTask(id: string): Promise<Task | undefined>;
    startTimer(target: string, category?: ActivityCategory): Promise<{
        timer: ActiveTimer;
        previousEntry?: TimeEntry;
    }>;
    stopTimer(): Promise<TimeEntry>;
    pauseTimer(): Promise<ActiveTimer>;
    resumeTimer(): Promise<ActiveTimer>;
    getTimerStatus(): Promise<{
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
    }>;
    logTime(options: ManualLogOptions): Promise<TimeEntry>;
    getTimeEntries(dateKey?: string): Promise<TimeEntry[]>;
    getScore(date?: string): Promise<ProductivityScore>;
    getDailySummary(date?: string): Promise<DailySummary>;
    getWeeklySummary(weekDate?: string): Promise<WeeklySummary>;
    exportData(): Promise<DayflowData>;
    importData(data: DayflowData): Promise<void>;
}

interface ScoreInputs {
    dateKey: string;
    tasks: Task[];
    timeEntries: TimeEntry[];
    config: DayflowConfig;
    streakDays?: number;
}
declare class ScoreCalculator {
    /**
     * Calculates the productivity score for a specific date.
     */
    static calculate(inputs: ScoreInputs): ProductivityScore;
    /**
     * Calculates consecutive active days (score >= 60) up to the day before targetDate.
     */
    static calculateStreak(dateKey: string, tasks: Task[], timeEntries: TimeEntry[], config: DayflowConfig, maxDaysToCheck?: number): number;
}

declare class SummaryEngine {
    /**
     * Generates a daily summary for dateKey.
     */
    static generateDailySummary(dateKey: string, tasks: Task[], timeEntries: TimeEntry[], config: DayflowConfig): DailySummary;
    /**
     * Generates a weekly summary.
     */
    static generateWeeklySummary(dateInWeek: string, tasks: Task[], timeEntries: TimeEntry[], config: DayflowConfig): WeeklySummary;
    private static generateSparkline;
    private static generateDailyInsight;
}

declare class JsonFileStorageAdapter implements StorageAdapter {
    private filePath;
    constructor(filePath?: string);
    getFilePath(): string;
    load(): Promise<DayflowData>;
    save(data: DayflowData): Promise<void>;
    private migrate;
}

declare class MemoryStorageAdapter implements StorageAdapter {
    private data;
    constructor(initialData?: Partial<DayflowData>);
    load(): Promise<DayflowData>;
    save(data: DayflowData): Promise<void>;
}

/**
 * Returns OS-appropriate configuration and data directories.
 * Respects DAYFLOW_DATA_DIR environment variable if specified.
 */
declare function getDefaultDataDir(): string;
declare function getDefaultDataFilePath(): string;

/**
 * Formats a Date object to YYYY-MM-DD in the specified timezone.
 */
declare function formatDateKey(date: Date, timezone: string): string;
/**
 * Parses YYYY-MM-DD or keywords like 'today', 'yesterday' relative to clock and timezone.
 */
declare function resolveDateString(input: string | undefined, now: Date, timezone: string): string;
/**
 * Gets the start and end of a week (YYYY-MM-DD) containing targetDateKey.
 */
declare function getWeekRange(dateKey: string, weekStartsOn: 'monday' | 'sunday', _timezone?: string): {
    weekStart: string;
    weekEnd: string;
    days: string[];
};
/**
 * Checks whether an ISO timestamp falls on a given YYYY-MM-DD in the specified timezone.
 */
declare function isTimestampOnDate(isoString: string, dateKey: string, timezone: string): boolean;
/**
 * Calculates human duration string from minutes.
 * e.g., 45 -> "45m", 125 -> "2h 5m", 0 -> "0m"
 */
declare function formatDurationMinutes(minutes: number): string;
/**
 * Parses duration strings like "45m", "1.5h", "2h30m", "90" (minutes) into minutes.
 */
declare function parseDurationToMinutes(input: string): number;

/**
 * Generates a short, collision-resistant unique ID with an optional prefix.
 * e.g., t_a7b9c1 or te_f4e2d8
 */
declare function generateId(prefix?: string): string;

export { type ActiveTimer, type ActivityCategory, type CategorySummary, type Clock, type CreateTaskOptions, DEFAULT_CONFIG, type DailySummary, type DayTrend, Dayflow, type DayflowConfig, type DayflowData, type DayflowEvents, type DayflowOptions, type EstimateAccuracyDetail, type FocusTimeDetail, JsonFileStorageAdapter, type ManualLogOptions, MemoryStorageAdapter, type PriorityCompletionDetail, type ProductivityScore, type ScoreBonuses, type ScoreBreakdown, ScoreCalculator, type ScoreComponentDetail, type ScoreInputs, type ScoreModifiers, type ScorePenalties, type ScoreWeights, SettableClock, type StartTimerOptions, type StorageAdapter, SummaryEngine, SystemClock, type Task, type TaskCompletionDetail, type TaskFilter, TaskManager, type TaskPriority, type TaskStatus, type TimeEntry, TimeTracker, type TimeWindowProductivity, type UpdateTaskOptions, type WeeklySummary, formatDateKey, formatDurationMinutes, generateId, getDefaultDataDir, getDefaultDataFilePath, getWeekRange, isTimestampOnDate, parseDurationToMinutes, resolveDateString };
