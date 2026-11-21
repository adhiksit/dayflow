#!/usr/bin/env node
'use strict';

var commander = require('commander');
var fs = require('fs/promises');
var events = require('events');
var path = require('path');
var os = require('os');
var crypto = require('crypto');
var pc = require('picocolors');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var fs__default = /*#__PURE__*/_interopDefault(fs);
var path__default = /*#__PURE__*/_interopDefault(path);
var os__default = /*#__PURE__*/_interopDefault(os);
var crypto__default = /*#__PURE__*/_interopDefault(crypto);
var pc__default = /*#__PURE__*/_interopDefault(pc);

// src/types/config.ts
var DEFAULT_CONFIG = {
  version: 1,
  targetFocusMinutes: 240,
  workingHours: {
    start: "09:00",
    end: "17:00"
  },
  weekStartsOn: "monday",
  timezone: typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" : "UTC",
  weights: {
    taskCompletion: 0.25,
    focusTime: 0.3,
    priorityCompletion: 0.25,
    estimateAccuracy: 0.2
  },
  penalties: {
    overduePerTask: 5
  },
  bonuses: {
    streakPerDay: 2
  }
};
function getDefaultDataDir() {
  if (process.env["DAYFLOW_DATA_DIR"]) {
    return path__default.default.resolve(process.env["DAYFLOW_DATA_DIR"]);
  }
  const home = os__default.default.homedir();
  const platform = process.platform;
  if (platform === "win32") {
    const appData = process.env["APPDATA"] || (path__default.default.win32 ? path__default.default.win32.join(home, "AppData", "Roaming") : path__default.default.join(home, "AppData", "Roaming"));
    return path__default.default.win32 ? path__default.default.win32.join(appData, "dayflow") : path__default.default.join(appData, "dayflow");
  }
  if (platform === "darwin") {
    return path__default.default.join(home, "Library", "Application Support", "dayflow");
  }
  const xdgData = process.env["XDG_DATA_HOME"] || path__default.default.join(home, ".local", "share");
  return path__default.default.join(xdgData, "dayflow");
}
function getDefaultDataFilePath() {
  return path__default.default.join(getDefaultDataDir(), "data.json");
}

// src/storage/JsonFileStorage.ts
var JsonFileStorageAdapter = class {
  filePath;
  constructor(filePath) {
    this.filePath = filePath || getDefaultDataFilePath();
  }
  getFilePath() {
    return this.filePath;
  }
  async load() {
    try {
      const content = await fs__default.default.readFile(this.filePath, "utf-8");
      const parsed = JSON.parse(content);
      return this.migrate(parsed);
    } catch (err) {
      const error = err;
      if (error.code === "ENOENT") {
        const defaultData = {
          schemaVersion: 1,
          config: { ...DEFAULT_CONFIG },
          tasks: [],
          timeEntries: [],
          activeTimer: null
        };
        await this.save(defaultData);
        return defaultData;
      }
      throw new Error(`Failed to load dayflow data from ${this.filePath}: ${error.message}`);
    }
  }
  async save(data) {
    const dir = path__default.default.dirname(this.filePath);
    await fs__default.default.mkdir(dir, { recursive: true });
    const tempFile = `${this.filePath}.tmp.${process.pid}.${Date.now()}`;
    const json = JSON.stringify(data, null, 2);
    try {
      await fs__default.default.writeFile(tempFile, json, "utf-8");
      await fs__default.default.rename(tempFile, this.filePath);
    } catch (err) {
      try {
        await fs__default.default.unlink(tempFile);
      } catch {
      }
      throw err;
    }
  }
  migrate(data) {
    if (!data.schemaVersion || data.schemaVersion === 1) {
      return {
        schemaVersion: 1,
        config: { ...DEFAULT_CONFIG, ...data.config || {} },
        tasks: Array.isArray(data.tasks) ? data.tasks : [],
        timeEntries: Array.isArray(data.timeEntries) ? data.timeEntries : [],
        activeTimer: data.activeTimer || null
      };
    }
    return data;
  }
};

// src/utils/clock.ts
var SystemClock = class {
  now() {
    return /* @__PURE__ */ new Date();
  }
};
function generateId(prefix) {
  const randomBytes = crypto__default.default.randomBytes(4).toString("hex");
  return prefix ? `${prefix}_${randomBytes}` : randomBytes;
}

// src/utils/date.ts
function formatDateKey(date, timezone) {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    return formatter.format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}
function resolveDateString(input, now, timezone) {
  if (!input || input.toLowerCase() === "today") {
    return formatDateKey(now, timezone);
  }
  if (input.toLowerCase() === "yesterday") {
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1e3);
    return formatDateKey(yesterday, timezone);
  }
  if (input.toLowerCase() === "tomorrow") {
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1e3);
    return formatDateKey(tomorrow, timezone);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return input;
  }
  const parsed = new Date(input);
  if (!isNaN(parsed.getTime())) {
    return formatDateKey(parsed, timezone);
  }
  throw new Error(`Invalid date format: "${input}". Expected YYYY-MM-DD, "today", or "yesterday".`);
}
function getWeekRange(dateKey, weekStartsOn, _timezone) {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) {
    throw new Error(`Invalid date key: ${dateKey}`);
  }
  const utcDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const dayOfWeek = utcDate.getUTCDay();
  let diffToStart = 0;
  if (weekStartsOn === "monday") {
    const adjustedDay = dayOfWeek === 0 ? 7 : dayOfWeek;
    diffToStart = adjustedDay - 1;
  } else {
    diffToStart = dayOfWeek;
  }
  const startDate = new Date(utcDate.getTime() - diffToStart * 24 * 60 * 60 * 1e3);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1e3);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dt = String(d.getUTCDate()).padStart(2, "0");
    days.push(`${y}-${m}-${dt}`);
  }
  return {
    weekStart: days[0],
    weekEnd: days[6],
    days
  };
}
function isTimestampOnDate(isoString, dateKey, timezone) {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return false;
    return formatDateKey(d, timezone) === dateKey;
  } catch {
    return false;
  }
}
function formatDurationMinutes(minutes) {
  const rounded = Math.round(minutes);
  if (rounded < 60) {
    return `${rounded}m`;
  }
  const hours = Math.floor(rounded / 60);
  const remainingMins = rounded % 60;
  return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
}
function parseDurationToMinutes(input) {
  const trimmed = input.trim().toLowerCase();
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return parseFloat(trimmed);
  }
  const comboMatch = trimmed.match(
    /^(\d+(?:\.\d+)?)\s*h(?:ours?)?(?:\s*(\d+(?:\.\d+)?)\s*m(?:in(?:ute)?s?)?)?$/
  );
  if (comboMatch) {
    const hours = parseFloat(comboMatch[1] || "0");
    const mins = parseFloat(comboMatch[2] || "0");
    return hours * 60 + mins;
  }
  const minMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*m(?:in(?:ute)?s?)?$/);
  if (minMatch) {
    return parseFloat(minMatch[1]);
  }
  const hourMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*h(?:ours?)?$/);
  if (hourMatch) {
    return parseFloat(hourMatch[1]) * 60;
  }
  throw new Error(`Invalid duration format: "${input}". Examples: "45m", "1h", "1.5h", "1h30m".`);
}

// src/core/TaskManager.ts
var TaskManager = class {
  tasks;
  clock;
  timezone;
  constructor(tasks, clock, timezone) {
    this.tasks = tasks;
    this.clock = clock;
    this.timezone = timezone;
  }
  getTasks() {
    return this.tasks;
  }
  addTask(options) {
    if (!options.title || !options.title.trim()) {
      throw new Error("Task title cannot be empty.");
    }
    const task = {
      id: generateId("t"),
      title: options.title.trim(),
      tag: options.tag?.trim() || void 0,
      priority: options.priority || "medium",
      estimate: options.estimate !== void 0 ? Math.max(0, options.estimate) : void 0,
      dueDate: options.dueDate?.trim() || void 0,
      status: "todo",
      createdAt: this.clock.now().toISOString()
    };
    this.tasks.push(task);
    return task;
  }
  getTask(id) {
    return this.tasks.find((t) => t.id === id);
  }
  updateTask(id, updates) {
    const task = this.getTask(id);
    if (!task) {
      throw new Error(`Task with ID "${id}" not found.`);
    }
    if (updates.title !== void 0) {
      if (!updates.title.trim()) {
        throw new Error("Task title cannot be empty.");
      }
      task.title = updates.title.trim();
    }
    if (updates.tag !== void 0) {
      task.tag = updates.tag.trim() || void 0;
    }
    if (updates.priority !== void 0) {
      task.priority = updates.priority;
    }
    if (updates.estimate !== void 0) {
      task.estimate = Math.max(0, updates.estimate);
    }
    if (updates.dueDate !== void 0) {
      task.dueDate = updates.dueDate.trim() || void 0;
    }
    if (updates.status !== void 0) {
      if (updates.status === "done" && task.status !== "done") {
        task.status = "done";
        task.completedAt = this.clock.now().toISOString();
      } else if (updates.status !== "done" && task.status === "done") {
        task.status = updates.status;
        task.completedAt = void 0;
      } else {
        task.status = updates.status;
      }
    }
    return task;
  }
  completeTask(id) {
    const task = this.getTask(id);
    if (!task) {
      throw new Error(`Task with ID "${id}" not found.`);
    }
    task.status = "done";
    task.completedAt = this.clock.now().toISOString();
    return task;
  }
  reopenTask(id) {
    const task = this.getTask(id);
    if (!task) {
      throw new Error(`Task with ID "${id}" not found.`);
    }
    task.status = "todo";
    task.completedAt = void 0;
    return task;
  }
  deleteTask(id) {
    const index = this.tasks.findIndex((t) => t.id === id);
    if (index === -1) {
      throw new Error(`Task with ID "${id}" not found.`);
    }
    const [deleted] = this.tasks.splice(index, 1);
    return deleted;
  }
  listTasks(filter) {
    let result = [...this.tasks];
    if (!filter) {
      return result;
    }
    if (filter.status) {
      result = result.filter((t) => t.status === filter.status);
    }
    if (filter.priority) {
      result = result.filter((t) => t.priority === filter.priority);
    }
    if (filter.tag) {
      const lowerTag = filter.tag.toLowerCase();
      result = result.filter((t) => t.tag?.toLowerCase() === lowerTag);
    }
    if (filter.date) {
      const targetDate = filter.date;
      result = result.filter((t) => {
        if (t.dueDate === targetDate) return true;
        if (t.completedAt && isTimestampOnDate(t.completedAt, targetDate, this.timezone)) {
          return true;
        }
        if (isTimestampOnDate(t.createdAt, targetDate, this.timezone)) {
          return true;
        }
        return false;
      });
    }
    return result;
  }
  /**
   * Identifies overdue tasks as of a reference date.
   * A task is overdue if status is not 'done' and dueDate < referenceDate.
   */
  getOverdueTasks(asOfDateKey) {
    const refDate = asOfDateKey || formatDateKey(this.clock.now(), this.timezone);
    return this.tasks.filter((t) => {
      if (t.status === "done") return false;
      if (!t.dueDate) return false;
      return t.dueDate < refDate;
    });
  }
};

// src/core/TimeTracker.ts
var TimeTracker = class {
  timeEntries;
  activeTimer;
  clock;
  timezone;
  constructor(timeEntries, activeTimer, clock, timezone) {
    this.timeEntries = timeEntries;
    this.activeTimer = activeTimer;
    this.clock = clock;
    this.timezone = timezone;
  }
  getTimeEntries() {
    return this.timeEntries;
  }
  getActiveTimer() {
    return this.activeTimer;
  }
  /**
   * Returns current active timer status with dynamic elapsed seconds.
   */
  getStatus() {
    if (!this.activeTimer) {
      return { active: false };
    }
    let elapsed = this.activeTimer.accumulatedSeconds;
    const isPaused = Boolean(this.activeTimer.pausedAt);
    if (!isPaused) {
      const startMs = new Date(this.activeTimer.startTime).getTime();
      const nowMs = this.clock.now().getTime();
      const currentSegment = Math.max(0, Math.floor((nowMs - startMs) / 1e3));
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
        startTime: this.activeTimer.startTime
      }
    };
  }
  /**
   * Starts a timer. If another timer is currently running, stops it and saves it first.
   */
  startTimer(options) {
    if (!options.activity || !options.activity.trim()) {
      throw new Error("Timer activity cannot be empty.");
    }
    let previousEntry;
    if (this.activeTimer) {
      previousEntry = this.stopTimer();
    }
    const nowIso = this.clock.now().toISOString();
    const timer = {
      id: generateId("tm"),
      taskId: options.taskId,
      activity: options.activity.trim(),
      category: options.category?.trim() || "deep work",
      startTime: nowIso,
      accumulatedSeconds: 0
    };
    this.activeTimer = timer;
    return { newTimer: timer, previousEntry };
  }
  /**
   * Pauses the active timer.
   */
  pauseTimer() {
    if (!this.activeTimer) {
      throw new Error("No active timer running.");
    }
    if (this.activeTimer.pausedAt) {
      return this.activeTimer;
    }
    const now = this.clock.now();
    const startMs = new Date(this.activeTimer.startTime).getTime();
    const segmentSeconds = Math.max(0, Math.floor((now.getTime() - startMs) / 1e3));
    this.activeTimer.accumulatedSeconds += segmentSeconds;
    this.activeTimer.pausedAt = now.toISOString();
    return this.activeTimer;
  }
  /**
   * Resumes the active timer if paused.
   */
  resumeTimer() {
    if (!this.activeTimer) {
      throw new Error("No active timer to resume.");
    }
    if (!this.activeTimer.pausedAt) {
      return this.activeTimer;
    }
    this.activeTimer.pausedAt = void 0;
    this.activeTimer.startTime = this.clock.now().toISOString();
    return this.activeTimer;
  }
  /**
   * Stops the active timer and records a TimeEntry.
   */
  stopTimer() {
    if (!this.activeTimer) {
      throw new Error("No active timer running.");
    }
    const now = this.clock.now();
    let totalSeconds = this.activeTimer.accumulatedSeconds;
    if (!this.activeTimer.pausedAt) {
      const startMs = new Date(this.activeTimer.startTime).getTime();
      const segmentSeconds = Math.max(0, Math.floor((now.getTime() - startMs) / 1e3));
      totalSeconds += segmentSeconds;
    }
    const durationMinutes = Math.max(0.1, Math.round(totalSeconds / 60 * 100) / 100);
    const entry = {
      id: generateId("te"),
      taskId: this.activeTimer.taskId,
      activity: this.activeTimer.activity,
      category: this.activeTimer.category,
      startTime: this.activeTimer.startTime,
      endTime: now.toISOString(),
      durationMinutes,
      isManual: false
    };
    this.timeEntries.push(entry);
    this.activeTimer = null;
    return entry;
  }
  /**
   * Logs manual time spent.
   */
  logManualTime(options) {
    if (!options.activity || !options.activity.trim()) {
      throw new Error("Activity description cannot be empty.");
    }
    if (options.durationMinutes <= 0) {
      throw new Error("Duration must be greater than zero.");
    }
    const durationMinutes = Math.round(options.durationMinutes * 100) / 100;
    const now = this.clock.now();
    let startTimeIso;
    let endTimeIso;
    if (options.startTime) {
      startTimeIso = options.startTime;
      const endMs = new Date(options.startTime).getTime() + durationMinutes * 60 * 1e3;
      endTimeIso = new Date(endMs).toISOString();
    } else {
      const targetDateKey = resolveDateString(options.date, now, this.timezone);
      const [year, month, day] = targetDateKey.split("-").map(Number);
      if (!year || !month || !day) {
        throw new Error(`Invalid date format: ${options.date}`);
      }
      const baseDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
      startTimeIso = baseDate.toISOString();
      const endMs = baseDate.getTime() + durationMinutes * 60 * 1e3;
      endTimeIso = new Date(endMs).toISOString();
    }
    const entry = {
      id: generateId("te"),
      taskId: options.taskId,
      activity: options.activity.trim(),
      category: options.category?.trim() || "deep work",
      startTime: startTimeIso,
      endTime: endTimeIso,
      durationMinutes,
      isManual: true
    };
    this.timeEntries.push(entry);
    return entry;
  }
  /**
   * Returns all time entries that occurred on a specific date in the configured timezone.
   */
  getEntriesForDate(dateKey) {
    return this.timeEntries.filter(
      (entry) => isTimestampOnDate(entry.startTime, dateKey, this.timezone)
    );
  }
  /**
   * Returns total actual minutes logged for a specific task.
   */
  getTimeForTask(taskId) {
    return this.timeEntries.filter((e) => e.taskId === taskId).reduce((sum, e) => sum + e.durationMinutes, 0);
  }
};

// src/core/ScoreCalculator.ts
var ScoreCalculator = class _ScoreCalculator {
  /**
   * Calculates the productivity score for a specific date.
   */
  static calculate(inputs) {
    const { dateKey, tasks, timeEntries, config, streakDays = 0 } = inputs;
    const timezone = config.timezone;
    const weights = config.weights;
    const relevantTasks = tasks.filter((t) => {
      if (t.dueDate === dateKey) return true;
      if (t.completedAt && isTimestampOnDate(t.completedAt, dateKey, timezone)) return true;
      if (isTimestampOnDate(t.createdAt, dateKey, timezone)) return true;
      return false;
    });
    const completedTasksToday = tasks.filter(
      (t) => t.status === "done" && t.completedAt && isTimestampOnDate(t.completedAt, dateKey, timezone)
    );
    const plannedTasksMap = /* @__PURE__ */ new Map();
    for (const t of relevantTasks) {
      if (t.dueDate === dateKey) {
        plannedTasksMap.set(t.id, t);
      }
    }
    for (const t of completedTasksToday) {
      plannedTasksMap.set(t.id, t);
    }
    const plannedTasks = Array.from(plannedTasksMap.values());
    const dayEntries = timeEntries.filter((e) => isTimestampOnDate(e.startTime, dateKey, timezone));
    const focusMinutes = dayEntries.filter((e) => e.category.toLowerCase() === "deep work").reduce((sum, e) => sum + e.durationMinutes, 0);
    const hasAnyActivity = completedTasksToday.length > 0 || dayEntries.length > 0;
    let compScore = 0;
    if (plannedTasks.length > 0) {
      const doneCount = plannedTasks.filter((t) => t.status === "done").length;
      compScore = Math.min(100, doneCount / plannedTasks.length * 100);
    } else if (completedTasksToday.length > 0 || hasAnyActivity) {
      compScore = 100;
    }
    compScore = Math.round(compScore * 100) / 100;
    const targetFocus = config.targetFocusMinutes > 0 ? config.targetFocusMinutes : 240;
    const focusScore = Math.min(100, Math.round(focusMinutes / targetFocus * 1e4) / 100);
    const priorityWeights = {
      high: 3,
      medium: 2,
      low: 1
    };
    let priorityScore = 0;
    let completedWeight = 0;
    let totalPlannedWeight = 0;
    if (plannedTasks.length > 0) {
      for (const t of plannedTasks) {
        const w = priorityWeights[t.priority] || 2;
        totalPlannedWeight += w;
        if (t.status === "done") {
          completedWeight += w;
        }
      }
      priorityScore = totalPlannedWeight > 0 ? Math.min(100, completedWeight / totalPlannedWeight * 100) : 100;
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
    let evaluatedAccuracyCount = 0;
    let sumAccuracy = 0;
    for (const task of completedTasksToday) {
      if (task.estimate && task.estimate > 0) {
        const actualMinutes = timeEntries.filter((e) => e.taskId === task.id).reduce((sum, e) => sum + e.durationMinutes, 0);
        if (actualMinutes > 0) {
          evaluatedAccuracyCount++;
          const errorRatio = Math.abs(actualMinutes - task.estimate) / task.estimate;
          const accuracy = Math.max(0, 100 - errorRatio * 100);
          sumAccuracy += accuracy;
        }
      }
    }
    const accuracyScore = evaluatedAccuracyCount > 0 ? Math.round(sumAccuracy / evaluatedAccuracyCount * 100) / 100 : hasAnyActivity ? 100 : 0;
    const compPoints = Math.round(compScore * weights.taskCompletion * 100) / 100;
    const focusPoints = Math.round(focusScore * weights.focusTime * 100) / 100;
    const priorityPoints = Math.round(priorityScore * weights.priorityCompletion * 100) / 100;
    const accuracyPoints = Math.round(accuracyScore * weights.estimateAccuracy * 100) / 100;
    const baseScore = Math.round((compPoints + focusPoints + priorityPoints + accuracyPoints) * 100) / 100;
    const overdueTasks = tasks.filter(
      (t) => t.status !== "done" && t.dueDate && t.dueDate < dateKey
    );
    const overduePenaltyRaw = overdueTasks.length * (config.penalties.overduePerTask ?? 5);
    const overduePenalty = Math.min(20, overduePenaltyRaw);
    const streakBonusRaw = streakDays * (config.bonuses.streakPerDay ?? 2);
    const streakBonus = Math.min(10, streakBonusRaw);
    const finalScore = Math.max(
      0,
      Math.min(100, Math.round(baseScore - overduePenalty + streakBonus))
    );
    const breakdown = {
      taskCompletion: {
        score: compScore,
        weight: weights.taskCompletion,
        points: compPoints,
        doneCount: plannedTasks.filter((t) => t.status === "done").length,
        totalPlannedCount: plannedTasks.length
      },
      focusTime: {
        score: focusScore,
        weight: weights.focusTime,
        points: focusPoints,
        focusMinutes: Math.round(focusMinutes * 10) / 10,
        targetMinutes: targetFocus
      },
      priorityCompletion: {
        score: priorityScore,
        weight: weights.priorityCompletion,
        points: priorityPoints,
        completedWeight,
        totalPlannedWeight
      },
      estimateAccuracy: {
        score: accuracyScore,
        weight: weights.estimateAccuracy,
        points: accuracyPoints,
        evaluatedTasksCount: evaluatedAccuracyCount
      }
    };
    const formula = `Score = clamp(0, 100, round(${weights.taskCompletion}\xD7${compScore} + ${weights.focusTime}\xD7${focusScore} + ${weights.priorityCompletion}\xD7${priorityScore} + ${weights.estimateAccuracy}\xD7${accuracyScore}` + (overduePenalty > 0 ? ` - ${overduePenalty}` : "") + (streakBonus > 0 ? ` + ${streakBonus}` : "") + `)) = ${finalScore}`;
    return {
      date: dateKey,
      score: finalScore,
      baseScore,
      breakdown,
      modifiers: {
        overduePenalty: -overduePenalty,
        overdueTasksCount: overdueTasks.length,
        streakBonus,
        streakDays
      },
      formula
    };
  }
  /**
   * Calculates consecutive active days (score >= 60) up to the day before targetDate.
   */
  static calculateStreak(dateKey, tasks, timeEntries, config, maxDaysToCheck = 30) {
    const [year, month, day] = dateKey.split("-").map(Number);
    if (!year || !month || !day) return 0;
    let streak = 0;
    const baseDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    for (let i = 1; i <= maxDaysToCheck; i++) {
      const prevDate = new Date(baseDate.getTime() - i * 24 * 60 * 60 * 1e3);
      const y = prevDate.getUTCFullYear();
      const m = String(prevDate.getUTCMonth() + 1).padStart(2, "0");
      const d = String(prevDate.getUTCDate()).padStart(2, "0");
      const prevKey = `${y}-${m}-${d}`;
      const dayScore = _ScoreCalculator.calculate({
        dateKey: prevKey,
        tasks,
        timeEntries,
        config,
        streakDays: 0
      });
      if (dayScore.score >= 60) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }
};

// src/core/SummaryEngine.ts
var SummaryEngine = class {
  /**
   * Generates a daily summary for dateKey.
   */
  static generateDailySummary(dateKey, tasks, timeEntries, config) {
    const timezone = config.timezone;
    const streakDays = ScoreCalculator.calculateStreak(dateKey, tasks, timeEntries, config);
    const score = ScoreCalculator.calculate({
      dateKey,
      tasks,
      timeEntries,
      config,
      streakDays
    });
    const dayEntries = timeEntries.filter((e) => isTimestampOnDate(e.startTime, dateKey, timezone));
    const tasksCompleted = tasks.filter(
      (t) => t.status === "done" && t.completedAt && isTimestampOnDate(t.completedAt, dateKey, timezone)
    );
    const tasksMissed = tasks.filter(
      (t) => t.status !== "done" && t.dueDate && t.dueDate <= dateKey
    );
    const categoryMap = /* @__PURE__ */ new Map();
    let totalMinutes = 0;
    let focusMinutes = 0;
    for (const entry of dayEntries) {
      const cat = entry.category || "general";
      const current = categoryMap.get(cat) || { minutes: 0, count: 0 };
      current.minutes += entry.durationMinutes;
      current.count += 1;
      categoryMap.set(cat, current);
      totalMinutes += entry.durationMinutes;
      if (cat.toLowerCase() === "deep work") {
        focusMinutes += entry.durationMinutes;
      }
    }
    totalMinutes = Math.round(totalMinutes * 10) / 10;
    focusMinutes = Math.round(focusMinutes * 10) / 10;
    const categoryBreakdown = Array.from(categoryMap.entries()).map(
      ([cat, data]) => ({
        category: cat,
        minutes: Math.round(data.minutes * 10) / 10,
        percentage: totalMinutes > 0 ? Math.round(data.minutes / totalMinutes * 100) : 0,
        entryCount: data.count
      })
    );
    categoryBreakdown.sort((a, b) => b.minutes - a.minutes);
    const activityMap = /* @__PURE__ */ new Map();
    for (const entry of dayEntries) {
      const act = entry.activity;
      const cur = activityMap.get(act) || { minutes: 0, category: entry.category };
      cur.minutes += entry.durationMinutes;
      activityMap.set(act, cur);
    }
    let topActivity = null;
    let maxActivityMinutes = 0;
    for (const [activity, cur] of activityMap.entries()) {
      if (cur.minutes > maxActivityMinutes) {
        maxActivityMinutes = cur.minutes;
        topActivity = {
          activity,
          category: cur.category,
          minutes: Math.round(cur.minutes * 10) / 10
        };
      }
    }
    const insight = this.generateDailyInsight({
      score: score.score,
      focusMinutes,
      targetFocus: config.targetFocusMinutes,
      tasksCompletedCount: tasksCompleted.length,
      tasksMissedCount: tasksMissed.length,
      streakDays
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
      insight
    };
  }
  /**
   * Generates a weekly summary.
   */
  static generateWeeklySummary(dateInWeek, tasks, timeEntries, config) {
    const { weekStart, weekEnd, days } = getWeekRange(
      dateInWeek,
      config.weekStartsOn,
      config.timezone
    );
    const dayTrends = [];
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    let totalTasksDone = 0;
    let totalTimeMinutes = 0;
    let totalFocusMinutes = 0;
    let scoreSum = 0;
    let bestDay = null;
    let worstDay = null;
    const weekCategoryMap = /* @__PURE__ */ new Map();
    const hourlyBuckets = /* @__PURE__ */ new Map();
    for (const dayKey of days) {
      const [y2, m2, d2] = dayKey.split("-").map(Number);
      const utcDate = new Date(Date.UTC(y2, m2 - 1, d2, 12, 0, 0));
      const dayOfWeek = dayNames[utcDate.getUTCDay()];
      const daily = this.generateDailySummary(dayKey, tasks, timeEntries, config);
      dayTrends.push({
        date: dayKey,
        dayOfWeek,
        score: daily.score.score,
        focusMinutes: daily.focusTimeMinutes,
        tasksCompleted: daily.tasksCompleted.length
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
      const dayEntries = timeEntries.filter(
        (e) => isTimestampOnDate(e.startTime, dayKey, config.timezone)
      );
      for (const entry of dayEntries) {
        const entryDate = new Date(entry.startTime);
        const hour = parseInt(
          new Intl.DateTimeFormat("en-US", {
            hour: "numeric",
            hourCycle: "h23",
            timeZone: config.timezone
          }).format(entryDate),
          10
        );
        const bucket = hourlyBuckets.get(hour) || { total: 0, focus: 0 };
        bucket.total += entry.durationMinutes;
        if (entry.category.toLowerCase() === "deep work") {
          bucket.focus += entry.durationMinutes;
        }
        hourlyBuckets.set(hour, bucket);
      }
    }
    const averageScore = Math.round(scoreSum / days.length);
    const sparkline = this.generateSparkline(dayTrends.map((d2) => d2.score));
    const categoryDistribution = Array.from(weekCategoryMap.entries()).map(
      ([cat, data]) => ({
        category: cat,
        minutes: Math.round(data.minutes * 10) / 10,
        percentage: totalTimeMinutes > 0 ? Math.round(data.minutes / totalTimeMinutes * 100) : 0,
        entryCount: data.count
      })
    );
    categoryDistribution.sort((a, b) => b.minutes - a.minutes);
    let peakTimeWindow = null;
    let maxWindowFocus = 0;
    for (let h = 0; h < 23; h++) {
      const b1 = hourlyBuckets.get(h) || { total: 0, focus: 0 };
      const b2 = hourlyBuckets.get(h + 1) || { total: 0, focus: 0 };
      const windowFocus = b1.focus + b2.focus;
      const windowTotal = b1.total + b2.total;
      if (windowTotal > 0 && (windowFocus > maxWindowFocus || peakTimeWindow === null)) {
        maxWindowFocus = windowFocus;
        const startStr = `${String(h).padStart(2, "0")}:00`;
        const endStr = `${String(h + 2).padStart(2, "0")}:00`;
        peakTimeWindow = {
          window: `${startStr} - ${endStr}`,
          totalMinutes: Math.round(windowTotal * 10) / 10,
          focusMinutes: Math.round(windowFocus * 10) / 10
        };
      }
    }
    const [y, m, d] = weekStart.split("-").map(Number);
    const prevWeekStartUtc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0) - 7 * 24 * 60 * 60 * 1e3);
    const prevWeekKey = `${prevWeekStartUtc.getUTCFullYear()}-${String(prevWeekStartUtc.getUTCMonth() + 1).padStart(2, "0")}-${String(prevWeekStartUtc.getUTCDate()).padStart(2, "0")}`;
    let comparisonWithPreviousWeek = null;
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
        scoreDelta: averageScore - prevAvgScore
      };
    } catch {
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
      comparisonWithPreviousWeek
    };
  }
  static generateSparkline(numbers) {
    const ticks = [" ", "\u2582", "\u2583", "\u2584", "\u2585", "\u2586", "\u2587", "\u2588"];
    const min = 0;
    const max = 100;
    return numbers.map((n) => {
      const val = Math.max(min, Math.min(max, n));
      const index = Math.min(ticks.length - 1, Math.floor(val / max * ticks.length));
      return ticks[index];
    }).join("");
  }
  static generateDailyInsight(params) {
    const { score, focusMinutes, targetFocus, tasksCompletedCount, tasksMissedCount, streakDays } = params;
    if (score >= 90) {
      if (streakDays >= 3) {
        return `Outstanding performance! Crushed focus goals and maintaining a ${streakDays}-day streak.`;
      }
      return "Exceptional focus and execution across all planned goals today!";
    }
    if (score >= 75) {
      if (tasksMissedCount > 0) {
        return `Solid day (${Math.round(focusMinutes)}m focus), but ${tasksMissedCount} task(s) slipped past deadline.`;
      }
      return "Great productivity flow; targets well matched to output.";
    }
    if (focusMinutes >= targetFocus && tasksMissedCount > 0) {
      return `Strong deep work time (${Math.round(focusMinutes)}m), but task prioritization needs tightening.`;
    }
    if (tasksCompletedCount > 0 && focusMinutes < targetFocus * 0.5) {
      return "Completed tasks today, but deep focus time fell short of target hours.";
    }
    if (tasksMissedCount > 2) {
      return `Multiple tasks overdue (${tasksMissedCount}); consider reducing commitments or re-estimating.`;
    }
    return "A steady day. Focus on uninterrupted blocks tomorrow to lift deep work velocity.";
  }
};

// src/core/Dayflow.ts
var Dayflow = class extends events.EventEmitter {
  storage;
  clock;
  config;
  tasks = [];
  timeEntries = [];
  activeTimer = null;
  isLoaded = false;
  taskManager;
  timeTracker;
  constructor(options = {}) {
    super();
    this.storage = options.storage || new JsonFileStorageAdapter();
    this.clock = options.clock || new SystemClock();
    this.config = { ...DEFAULT_CONFIG, ...options.config || {} };
  }
  // Strongly typed event listener helpers
  on(event, listener) {
    return super.on(event, listener);
  }
  emit(event, ...args) {
    return super.emit(event, ...args);
  }
  /**
   * Initializes Dayflow by loading state from storage adapter.
   */
  async init() {
    if (this.isLoaded) return this;
    const data = await this.storage.load();
    this.config = { ...DEFAULT_CONFIG, ...data.config || {} };
    this.tasks = Array.isArray(data.tasks) ? data.tasks : [];
    this.timeEntries = Array.isArray(data.timeEntries) ? data.timeEntries : [];
    this.activeTimer = data.activeTimer || null;
    this.initManagers();
    this.isLoaded = true;
    return this;
  }
  initManagers() {
    this.taskManager = new TaskManager(this.tasks, this.clock, this.config.timezone);
    this.timeTracker = new TimeTracker(
      this.timeEntries,
      this.activeTimer,
      this.clock,
      this.config.timezone
    );
  }
  async ensureLoaded() {
    if (!this.isLoaded) {
      await this.init();
    }
  }
  async persist() {
    const data = {
      schemaVersion: 1,
      config: this.config,
      tasks: this.tasks,
      timeEntries: this.timeEntries,
      activeTimer: this.timeTracker.getActiveTimer()
    };
    await this.storage.save(data);
  }
  // --- CONFIG ---
  getConfig() {
    return { ...this.config };
  }
  async updateConfig(updates) {
    await this.ensureLoaded();
    this.config = {
      ...this.config,
      ...updates,
      weights: { ...this.config.weights, ...updates.weights || {} },
      penalties: { ...this.config.penalties, ...updates.penalties || {} },
      bonuses: { ...this.config.bonuses, ...updates.bonuses || {} }
    };
    this.initManagers();
    await this.persist();
    return { ...this.config };
  }
  // --- TASKS ---
  async addTask(options) {
    await this.ensureLoaded();
    const task = this.taskManager.addTask(options);
    await this.persist();
    this.emit("taskAdded", task);
    return task;
  }
  async updateTask(id, updates) {
    await this.ensureLoaded();
    const task = this.taskManager.updateTask(id, updates);
    await this.persist();
    this.emit("taskUpdated", task);
    return task;
  }
  async completeTask(id) {
    await this.ensureLoaded();
    const task = this.taskManager.completeTask(id);
    await this.persist();
    this.emit("taskCompleted", task);
    return task;
  }
  async reopenTask(id) {
    await this.ensureLoaded();
    const task = this.taskManager.reopenTask(id);
    await this.persist();
    this.emit("taskReopened", task);
    return task;
  }
  async deleteTask(id) {
    await this.ensureLoaded();
    const task = this.taskManager.deleteTask(id);
    await this.persist();
    this.emit("taskDeleted", id);
    return task;
  }
  async listTasks(filter) {
    await this.ensureLoaded();
    const resolvedFilter = filter ? { ...filter } : void 0;
    if (resolvedFilter?.date) {
      resolvedFilter.date = resolveDateString(
        resolvedFilter.date,
        this.clock.now(),
        this.config.timezone
      );
    }
    return this.taskManager.listTasks(resolvedFilter);
  }
  async getTask(id) {
    await this.ensureLoaded();
    return this.taskManager.getTask(id);
  }
  // --- TIME TRACKING ---
  async startTimer(target, category) {
    await this.ensureLoaded();
    const task = this.taskManager.getTask(target);
    let activity = target;
    let taskId;
    if (task) {
      activity = task.title;
      taskId = task.id;
      if (task.status === "todo") {
        this.taskManager.updateTask(task.id, { status: "in-progress" });
      }
    }
    const result = this.timeTracker.startTimer({
      activity,
      category: category || (task?.tag ? task.tag : "deep work"),
      taskId
    });
    if (result.previousEntry) {
      this.emit("timerStopped", result.previousEntry);
    }
    await this.persist();
    this.emit("timerStarted", result.newTimer);
    return { timer: result.newTimer, previousEntry: result.previousEntry };
  }
  async stopTimer() {
    await this.ensureLoaded();
    const entry = this.timeTracker.stopTimer();
    await this.persist();
    this.emit("timerStopped", entry);
    return entry;
  }
  async pauseTimer() {
    await this.ensureLoaded();
    const timer = this.timeTracker.pauseTimer();
    await this.persist();
    this.emit("timerPaused", timer);
    return timer;
  }
  async resumeTimer() {
    await this.ensureLoaded();
    const timer = this.timeTracker.resumeTimer();
    await this.persist();
    this.emit("timerResumed", timer);
    return timer;
  }
  async getTimerStatus() {
    await this.ensureLoaded();
    return this.timeTracker.getStatus();
  }
  async logTime(options) {
    await this.ensureLoaded();
    const entry = this.timeTracker.logManualTime(options);
    await this.persist();
    this.emit("timeLogged", entry);
    return entry;
  }
  async getTimeEntries(dateKey) {
    await this.ensureLoaded();
    if (dateKey) {
      const resolved = resolveDateString(dateKey, this.clock.now(), this.config.timezone);
      return this.timeTracker.getEntriesForDate(resolved);
    }
    return this.timeTracker.getTimeEntries();
  }
  // --- SCORES & SUMMARIES ---
  async getScore(date) {
    await this.ensureLoaded();
    const resolvedDate = resolveDateString(date, this.clock.now(), this.config.timezone);
    const streakDays = ScoreCalculator.calculateStreak(
      resolvedDate,
      this.tasks,
      this.timeEntries,
      this.config
    );
    const score = ScoreCalculator.calculate({
      dateKey: resolvedDate,
      tasks: this.tasks,
      timeEntries: this.timeEntries,
      config: this.config,
      streakDays
    });
    this.emit("scoreUpdated", score);
    return score;
  }
  async getDailySummary(date) {
    await this.ensureLoaded();
    const resolvedDate = resolveDateString(date, this.clock.now(), this.config.timezone);
    return SummaryEngine.generateDailySummary(
      resolvedDate,
      this.tasks,
      this.timeEntries,
      this.config
    );
  }
  async getWeeklySummary(weekDate) {
    await this.ensureLoaded();
    const resolvedDate = resolveDateString(weekDate, this.clock.now(), this.config.timezone);
    return SummaryEngine.generateWeeklySummary(
      resolvedDate,
      this.tasks,
      this.timeEntries,
      this.config
    );
  }
  // --- EXPORT & IMPORT ---
  async exportData() {
    await this.ensureLoaded();
    return {
      schemaVersion: 1,
      config: this.config,
      tasks: this.tasks,
      timeEntries: this.timeEntries,
      activeTimer: this.timeTracker.getActiveTimer()
    };
  }
  async importData(data) {
    await this.ensureLoaded();
    if (!data || typeof data !== "object") {
      throw new Error("Invalid dayflow import data format.");
    }
    this.config = { ...DEFAULT_CONFIG, ...data.config || {} };
    this.tasks = Array.isArray(data.tasks) ? data.tasks : [];
    this.timeEntries = Array.isArray(data.timeEntries) ? data.timeEntries : [];
    this.activeTimer = data.activeTimer || null;
    this.initManagers();
    await this.persist();
  }
};
function isColorSupported() {
  if (process.env["NO_COLOR"] !== void 0 || process.env["NODE_DISABLE_COLORS"] !== void 0) {
    return false;
  }
  return Boolean(process.stdout && process.stdout.isTTY);
}
var colors = {
  bold: (s) => isColorSupported() ? pc__default.default.bold(s) : s,
  dim: (s) => isColorSupported() ? pc__default.default.dim(s) : s,
  green: (s) => isColorSupported() ? pc__default.default.green(s) : s,
  yellow: (s) => isColorSupported() ? pc__default.default.yellow(s) : s,
  blue: (s) => isColorSupported() ? pc__default.default.blue(s) : s,
  magenta: (s) => isColorSupported() ? pc__default.default.magenta(s) : s,
  cyan: (s) => isColorSupported() ? pc__default.default.cyan(s) : s,
  red: (s) => isColorSupported() ? pc__default.default.red(s) : s,
  gray: (s) => isColorSupported() ? pc__default.default.gray(s) : s
};
function renderScorePill(score) {
  let coloredScore = `${score}/100`;
  if (score >= 80) {
    coloredScore = colors.green(coloredScore);
  } else if (score >= 60) {
    coloredScore = colors.yellow(coloredScore);
  } else {
    coloredScore = colors.red(coloredScore);
  }
  return coloredScore;
}
function renderProgressBar(percentage, width = 20) {
  const clamped = Math.max(0, Math.min(100, percentage));
  const filledChars = Math.round(clamped / 100 * width);
  const emptyChars = width - filledChars;
  const bar = "\u2588".repeat(filledChars) + "\u2591".repeat(emptyChars);
  return `${colors.cyan(bar)} ${clamped}%`;
}

// src/cli/formatters/text.ts
function formatTaskListText(tasks) {
  if (tasks.length === 0) {
    return colors.dim("No tasks found.");
  }
  const lines = [];
  lines.push(colors.bold("TASKS"));
  lines.push(colors.dim("\u2500".repeat(70)));
  for (const t of tasks) {
    let statusIcon = "[ ]";
    if (t.status === "done") statusIcon = colors.green("[\u2714]");
    else if (t.status === "in-progress") statusIcon = colors.yellow("[\u25B6]");
    let priorityStr = `[${t.priority}]`;
    if (t.priority === "high") priorityStr = colors.red(priorityStr);
    else if (t.priority === "medium") priorityStr = colors.yellow(priorityStr);
    else priorityStr = colors.dim(priorityStr);
    const tagStr = t.tag ? colors.blue(`#${t.tag}`) : "";
    const estStr = t.estimate ? colors.dim(`(${formatDurationMinutes(t.estimate)})`) : "";
    const dueStr = t.dueDate ? colors.magenta(`due:${t.dueDate}`) : "";
    const idStr = colors.dim(t.id);
    const meta = [priorityStr, tagStr, estStr, dueStr].filter(Boolean).join(" ");
    lines.push(`  ${statusIcon} ${colors.bold(t.title)} ${meta}  ${idStr}`);
  }
  return lines.join("\n");
}
function formatDailySummaryText(summary) {
  const lines = [];
  lines.push("");
  lines.push(colors.bold(`DAYFLOW DAILY SUMMARY \u2014 ${summary.date}`));
  lines.push(colors.dim("\u2550".repeat(60)));
  const scoreBadge = renderScorePill(summary.score.score);
  lines.push(`Productivity Score: ${scoreBadge} (Base: ${summary.score.baseScore})`);
  lines.push(colors.dim(`Insight: "${summary.insight}"`));
  lines.push("");
  lines.push(colors.bold("Score Breakdown:"));
  const b = summary.score.breakdown;
  lines.push(
    `  \u2022 Task Completion:    ${renderProgressBar(b.taskCompletion.score, 15)}  (${b.taskCompletion.doneCount}/${b.taskCompletion.totalPlannedCount} tasks)`
  );
  lines.push(
    `  \u2022 Focus Target:       ${renderProgressBar(b.focusTime.score, 15)}  (${formatDurationMinutes(b.focusTime.focusMinutes)} / ${formatDurationMinutes(b.focusTime.targetMinutes)})`
  );
  lines.push(
    `  \u2022 Priority Weighting: ${renderProgressBar(b.priorityCompletion.score, 15)}  (${b.priorityCompletion.completedWeight}/${b.priorityCompletion.totalPlannedWeight} pts)`
  );
  lines.push(`  \u2022 Estimate Accuracy:  ${renderProgressBar(b.estimateAccuracy.score, 15)}`);
  if (summary.score.modifiers.overduePenalty < 0 || summary.score.modifiers.streakBonus > 0) {
    const pen = summary.score.modifiers.overduePenalty < 0 ? colors.red(`${summary.score.modifiers.overduePenalty} overdue penalty`) : "";
    const bon = summary.score.modifiers.streakBonus > 0 ? colors.green(
      `+${summary.score.modifiers.streakBonus} streak bonus (${summary.score.modifiers.streakDays}d)`
    ) : "";
    lines.push(`  \u2022 Modifiers:          ${[pen, bon].filter(Boolean).join(", ")}`);
  }
  lines.push("");
  lines.push(colors.bold("Tasks Overview:"));
  lines.push(`  \u2022 Completed: ${colors.green(String(summary.tasksCompleted.length))}`);
  if (summary.tasksCompleted.length > 0) {
    for (const t of summary.tasksCompleted) {
      lines.push(`    - ${t.title}`);
    }
  }
  lines.push(
    `  \u2022 Missed / Overdue: ${summary.tasksMissed.length > 0 ? colors.red(String(summary.tasksMissed.length)) : colors.dim("0")}`
  );
  if (summary.tasksMissed.length > 0) {
    for (const t of summary.tasksMissed) {
      lines.push(`    - ${colors.red(t.title)} (due: ${t.dueDate})`);
    }
  }
  lines.push("");
  lines.push(colors.bold("Time & Activities:"));
  lines.push(
    `  \u2022 Total Time Logged: ${formatDurationMinutes(summary.totalTimeMinutes)} (Deep Work: ${colors.cyan(formatDurationMinutes(summary.focusTimeMinutes))})`
  );
  if (summary.topActivity) {
    lines.push(
      `  \u2022 Top Activity:      ${colors.bold(summary.topActivity.activity)} (${formatDurationMinutes(summary.topActivity.minutes)} [${summary.topActivity.category}])`
    );
  }
  if (summary.categoryBreakdown.length > 0) {
    lines.push("");
    lines.push(colors.bold("Category Breakdown:"));
    for (const c of summary.categoryBreakdown) {
      lines.push(
        `  - ${c.category.padEnd(14)}: ${formatDurationMinutes(c.minutes).padEnd(8)} (${c.percentage}%) [${c.entryCount} logs]`
      );
    }
  }
  lines.push(colors.dim("\u2550".repeat(60)));
  return lines.join("\n");
}
function formatWeeklySummaryText(summary) {
  const lines = [];
  lines.push("");
  lines.push(colors.bold(`DAYFLOW WEEKLY SUMMARY (${summary.weekStart} to ${summary.weekEnd})`));
  lines.push(colors.dim("\u2550".repeat(65)));
  lines.push(`Average Score:       ${renderScorePill(summary.averageScore)}`);
  lines.push(`Daily Score Trend:   ${colors.cyan(summary.sparkline)}`);
  lines.push(`Total Tasks Done:    ${colors.bold(String(summary.totalTasksDone))}`);
  lines.push(
    `Total Time Logged:   ${formatDurationMinutes(summary.totalTimeMinutes)} (Deep Work: ${colors.cyan(formatDurationMinutes(summary.totalFocusMinutes))})`
  );
  if (summary.bestDay) {
    lines.push(
      `Best Day:            ${colors.green(`${summary.bestDay.date} (${summary.bestDay.score}/100)`)}`
    );
  }
  if (summary.worstDay) {
    lines.push(
      `Worst Day:           ${colors.yellow(`${summary.worstDay.date} (${summary.worstDay.score}/100)`)}`
    );
  }
  if (summary.peakTimeWindow) {
    lines.push(
      `Peak Window:         ${colors.bold(summary.peakTimeWindow.window)} (${formatDurationMinutes(summary.peakTimeWindow.focusMinutes)} deep work)`
    );
  }
  if (summary.comparisonWithPreviousWeek) {
    const comp = summary.comparisonWithPreviousWeek;
    const taskDelta = comp.tasksDoneDelta >= 0 ? `+${comp.tasksDoneDelta}` : `${comp.tasksDoneDelta}`;
    const scoreDelta = comp.scoreDelta >= 0 ? `+${comp.scoreDelta}` : `${comp.scoreDelta}`;
    const focusDelta = comp.focusMinutesDelta >= 0 ? `+${formatDurationMinutes(comp.focusMinutesDelta)}` : `-${formatDurationMinutes(Math.abs(comp.focusMinutesDelta))}`;
    lines.push(
      `vs Previous Week:    Tasks: ${taskDelta} | Focus: ${focusDelta} | Score: ${scoreDelta}`
    );
  }
  lines.push("");
  lines.push(colors.bold("Daily Breakdown:"));
  for (const day of summary.dailyTrend) {
    const scorePill = renderScorePill(day.score);
    lines.push(
      `  ${day.dayOfWeek} ${day.date}: ${scorePill.padEnd(16)} | Focus: ${formatDurationMinutes(day.focusMinutes).padEnd(8)} | Done: ${day.tasksCompleted}`
    );
  }
  if (summary.categoryDistribution.length > 0) {
    lines.push("");
    lines.push(colors.bold("Category Distribution:"));
    for (const c of summary.categoryDistribution) {
      lines.push(
        `  - ${c.category.padEnd(14)}: ${formatDurationMinutes(c.minutes).padEnd(8)} (${c.percentage}%)`
      );
    }
  }
  lines.push(colors.dim("\u2550".repeat(65)));
  return lines.join("\n");
}

// src/cli/formatters/markdown.ts
function formatTaskListMarkdown(tasks) {
  if (tasks.length === 0) {
    return "_No tasks found._";
  }
  const lines = [];
  lines.push("| Status | Title | Priority | Tag | Estimate | Due Date | ID |");
  lines.push("|---|---|---|---|---|---|---|");
  for (const t of tasks) {
    const status = t.status === "done" ? "\u2705 done" : t.status === "in-progress" ? "\u25B6\uFE0F in-progress" : "\u23F3 todo";
    const tag = t.tag ? `\`#${t.tag}\`` : "-";
    const est = t.estimate ? formatDurationMinutes(t.estimate) : "-";
    const due = t.dueDate || "-";
    lines.push(
      `| ${status} | ${t.title} | ${t.priority} | ${tag} | ${est} | ${due} | \`${t.id}\` |`
    );
  }
  return lines.join("\n");
}
function formatDailySummaryMarkdown(summary) {
  const lines = [];
  lines.push(`# Dayflow Daily Summary: ${summary.date}`);
  lines.push("");
  lines.push(
    `**Productivity Score:** **${summary.score.score} / 100** (Base: ${summary.score.baseScore})`
  );
  lines.push(`> _"${summary.insight}"_`);
  lines.push("");
  lines.push("### Score Breakdown");
  lines.push("");
  lines.push("| Component | Score | Weight | Points | Metrics |");
  lines.push("|---|---|---|---|---|");
  const b = summary.score.breakdown;
  lines.push(
    `| Task Completion | ${b.taskCompletion.score}% | ${b.taskCompletion.weight * 100}% | ${b.taskCompletion.points} | ${b.taskCompletion.doneCount}/${b.taskCompletion.totalPlannedCount} tasks |`
  );
  lines.push(
    `| Focus Time | ${b.focusTime.score}% | ${b.focusTime.weight * 100}% | ${b.focusTime.points} | ${formatDurationMinutes(b.focusTime.focusMinutes)} / ${formatDurationMinutes(b.focusTime.targetMinutes)} |`
  );
  lines.push(
    `| Priority Weighting | ${b.priorityCompletion.score}% | ${b.priorityCompletion.weight * 100}% | ${b.priorityCompletion.points} | ${b.priorityCompletion.completedWeight}/${b.priorityCompletion.totalPlannedWeight} weight |`
  );
  lines.push(
    `| Estimate Accuracy | ${b.estimateAccuracy.score}% | ${b.estimateAccuracy.weight * 100}% | ${b.estimateAccuracy.points} | ${b.estimateAccuracy.evaluatedTasksCount} evaluated |`
  );
  lines.push("");
  lines.push("### Tasks");
  lines.push(`- **Completed (${summary.tasksCompleted.length}):**`);
  if (summary.tasksCompleted.length === 0) {
    lines.push("  - _None_");
  } else {
    for (const t of summary.tasksCompleted) {
      lines.push(`  - [x] ${t.title}`);
    }
  }
  lines.push(`- **Missed / Overdue (${summary.tasksMissed.length}):**`);
  if (summary.tasksMissed.length === 0) {
    lines.push("  - _None_");
  } else {
    for (const t of summary.tasksMissed) {
      lines.push(`  - [ ] **${t.title}** (due: ${t.dueDate})`);
    }
  }
  lines.push("");
  lines.push("### Time & Categories");
  lines.push(`- **Total Time Logged:** ${formatDurationMinutes(summary.totalTimeMinutes)}`);
  lines.push(`- **Deep Work Focus:** ${formatDurationMinutes(summary.focusTimeMinutes)}`);
  if (summary.topActivity) {
    lines.push(
      `- **Top Activity:** ${summary.topActivity.activity} (${formatDurationMinutes(summary.topActivity.minutes)} [${summary.topActivity.category}])`
    );
  }
  lines.push("");
  if (summary.categoryBreakdown.length > 0) {
    lines.push("| Category | Time | Share | Logs |");
    lines.push("|---|---|---|---|");
    for (const c of summary.categoryBreakdown) {
      lines.push(
        `| ${c.category} | ${formatDurationMinutes(c.minutes)} | ${c.percentage}% | ${c.entryCount} |`
      );
    }
  }
  return lines.join("\n");
}
function formatWeeklySummaryMarkdown(summary) {
  const lines = [];
  lines.push(`# Dayflow Weekly Summary: ${summary.weekStart} \u2013 ${summary.weekEnd}`);
  lines.push("");
  lines.push(`- **Average Score:** **${summary.averageScore} / 100**`);
  lines.push(`- **Score Trend:** \`${summary.sparkline}\``);
  lines.push(`- **Total Tasks Done:** ${summary.totalTasksDone}`);
  lines.push(
    `- **Total Focus Time:** ${formatDurationMinutes(summary.totalFocusMinutes)} (${formatDurationMinutes(summary.totalTimeMinutes)} total)`
  );
  if (summary.bestDay)
    lines.push(`- **Best Day:** ${summary.bestDay.date} (${summary.bestDay.score}/100)`);
  if (summary.worstDay)
    lines.push(`- **Worst Day:** ${summary.worstDay.date} (${summary.worstDay.score}/100)`);
  if (summary.peakTimeWindow)
    lines.push(
      `- **Peak Time Window:** ${summary.peakTimeWindow.window} (${formatDurationMinutes(summary.peakTimeWindow.focusMinutes)} focus)`
    );
  lines.push("");
  lines.push("### Daily Trend");
  lines.push("| Day | Date | Score | Focus Time | Tasks Done |");
  lines.push("|---|---|---|---|---|");
  for (const d of summary.dailyTrend) {
    lines.push(
      `| ${d.dayOfWeek} | ${d.date} | ${d.score}/100 | ${formatDurationMinutes(d.focusMinutes)} | ${d.tasksCompleted} |`
    );
  }
  lines.push("");
  if (summary.categoryDistribution.length > 0) {
    lines.push("### Category Distribution");
    lines.push("| Category | Time | Share | Entries |");
    lines.push("|---|---|---|---|");
    for (const c of summary.categoryDistribution) {
      lines.push(
        `| ${c.category} | ${formatDurationMinutes(c.minutes)} | ${c.percentage}% | ${c.entryCount} |`
      );
    }
  }
  return lines.join("\n");
}

// src/cli/formatters/json.ts
function formatJson(data) {
  return JSON.stringify(data, null, 2);
}

// src/cli/index.ts
var program = new commander.Command();
var dayflow = new Dayflow();
program.name("dayflow").description("A lightweight, offline productivity engine and CLI").version("1.0.0");
program.command("add <title>").description("Add a new task").option("-t, --tag <tag>", "Category tag (e.g. work, health, study)").option("-p, --priority <priority>", "Priority: low, medium, high", "medium").option("-e, --estimate <minutes>", 'Time estimate in minutes or format like "45m", "1.5h"').option("-d, --due <date>", "Due date (YYYY-MM-DD, today, tomorrow)").action(async (title, options) => {
  try {
    await dayflow.init();
    let estimateMinutes;
    if (options.estimate) {
      estimateMinutes = parseDurationToMinutes(options.estimate);
    }
    const priority = options.priority?.toLowerCase();
    if (priority && !["low", "medium", "high"].includes(priority)) {
      throw new Error('Priority must be "low", "medium", or "high".');
    }
    let dueDate;
    if (options.due) {
      const cfg = dayflow.getConfig();
      dueDate = resolveDateString(options.due, /* @__PURE__ */ new Date(), cfg.timezone);
    }
    const task = await dayflow.addTask({
      title,
      tag: options.tag,
      priority: priority || "medium",
      estimate: estimateMinutes,
      dueDate
    });
    console.log(
      `${colors.green("\u2714")} Task added: ${colors.bold(task.title)} ${colors.dim(`(${task.id})`)}`
    );
  } catch (err) {
    console.error(colors.red(`Error: ${err.message}`));
    process.exit(1);
  }
});
program.command("list").description("List tasks with optional filters").option("--today", "Filter tasks for today").option("--week", "Filter tasks for this week").option("-s, --status <status>", "Filter by status: todo, in-progress, done").option("-t, --tag <tag>", "Filter by tag").option("-p, --priority <priority>", "Filter by priority").option("-f, --format <format>", "Output format: text, json, md", "text").action(async (options) => {
  try {
    await dayflow.init();
    let dateFilter;
    if (options.today) {
      dateFilter = "today";
    }
    let tasks = await dayflow.listTasks({
      date: dateFilter,
      status: options.status,
      tag: options.tag,
      priority: options.priority
    });
    if (options.week) {
      const cfg = dayflow.getConfig();
      const todayKey = resolveDateString("today", /* @__PURE__ */ new Date(), cfg.timezone);
      const { days } = getWeekRange(todayKey, cfg.weekStartsOn, cfg.timezone);
      const daySet = new Set(days);
      tasks = tasks.filter((t) => {
        if (t.dueDate && daySet.has(t.dueDate)) return true;
        if (t.completedAt) {
          const completedKey = resolveDateString(t.completedAt, /* @__PURE__ */ new Date(), cfg.timezone);
          if (daySet.has(completedKey)) return true;
        }
        const createdKey = resolveDateString(t.createdAt, /* @__PURE__ */ new Date(), cfg.timezone);
        return daySet.has(createdKey);
      });
    }
    if (options.format === "json") {
      console.log(formatJson(tasks));
    } else if (options.format === "md") {
      console.log(formatTaskListMarkdown(tasks));
    } else {
      console.log(formatTaskListText(tasks));
    }
  } catch (err) {
    console.error(colors.red(`Error: ${err.message}`));
    process.exit(1);
  }
});
program.command("done <id>").description("Mark a task as done").action(async (id) => {
  try {
    await dayflow.init();
    const task = await dayflow.completeTask(id);
    console.log(`${colors.green("\u2714")} Task completed: ${colors.bold(task.title)}`);
  } catch (err) {
    console.error(colors.red(`Error: ${err.message}`));
    process.exit(1);
  }
});
program.command("reopen <id>").description("Reopen a completed task").action(async (id) => {
  try {
    await dayflow.init();
    const task = await dayflow.reopenTask(id);
    console.log(`${colors.yellow("\u21BA")} Task reopened: ${colors.bold(task.title)}`);
  } catch (err) {
    console.error(colors.red(`Error: ${err.message}`));
    process.exit(1);
  }
});
program.command("edit <id>").description("Edit an existing task").option("-t, --title <title>", "New title").option("--tag <tag>", "New category tag").option("-p, --priority <priority>", "New priority: low, medium, high").option("-e, --estimate <minutes>", "New estimate").option("-d, --due <date>", "New due date").option("-s, --status <status>", "New status: todo, in-progress, done").action(async (id, options) => {
  try {
    await dayflow.init();
    let estimateMinutes;
    if (options.estimate !== void 0) {
      estimateMinutes = parseDurationToMinutes(options.estimate);
    }
    let dueDate;
    if (options.due !== void 0) {
      const cfg = dayflow.getConfig();
      dueDate = resolveDateString(options.due, /* @__PURE__ */ new Date(), cfg.timezone);
    }
    const task = await dayflow.updateTask(id, {
      title: options.title,
      tag: options.tag,
      priority: options.priority,
      estimate: estimateMinutes,
      dueDate,
      status: options.status
    });
    console.log(`${colors.green("\u2714")} Task updated: ${colors.bold(task.title)}`);
  } catch (err) {
    console.error(colors.red(`Error: ${err.message}`));
    process.exit(1);
  }
});
program.command("rm <id>").description("Delete a task").action(async (id) => {
  try {
    await dayflow.init();
    const task = await dayflow.deleteTask(id);
    console.log(`${colors.red("\u2716")} Deleted task: ${colors.bold(task.title)}`);
  } catch (err) {
    console.error(colors.red(`Error: ${err.message}`));
    process.exit(1);
  }
});
program.command("start <target>").description("Start a timer tied to a task ID or free-form activity").option(
  "-c, --category <category>",
  'Activity category (e.g. "deep work", "meetings", "admin", "break")'
).action(async (target, options) => {
  try {
    await dayflow.init();
    const { timer, previousEntry } = await dayflow.startTimer(target, options.category);
    if (previousEntry) {
      console.log(
        `${colors.dim("\u2139")} Previous timer on "${previousEntry.activity}" stopped (${formatDurationMinutes(previousEntry.durationMinutes)}).`
      );
    }
    console.log(
      `${colors.green("\u25B6")} Started timer on: ${colors.bold(timer.activity)} [${colors.cyan(timer.category)}]`
    );
  } catch (err) {
    console.error(colors.red(`Error: ${err.message}`));
    process.exit(1);
  }
});
program.command("stop").description("Stop the currently running timer").action(async () => {
  try {
    await dayflow.init();
    const entry = await dayflow.stopTimer();
    console.log(
      `${colors.green("\u25A0")} Stopped timer: ${colors.bold(entry.activity)} \u2014 logged ${colors.cyan(formatDurationMinutes(entry.durationMinutes))}.`
    );
  } catch (err) {
    console.error(colors.red(`Error: ${err.message}`));
    process.exit(1);
  }
});
program.command("pause").description("Pause the active timer").action(async () => {
  try {
    await dayflow.init();
    const timer = await dayflow.pauseTimer();
    const mins = Math.floor(timer.accumulatedSeconds / 60);
    console.log(
      `${colors.yellow("\u23F8")} Paused timer on: ${colors.bold(timer.activity)} (accumulated: ${mins}m)`
    );
  } catch (err) {
    console.error(colors.red(`Error: ${err.message}`));
    process.exit(1);
  }
});
program.command("resume").description("Resume a paused timer").action(async () => {
  try {
    await dayflow.init();
    const timer = await dayflow.resumeTimer();
    console.log(`${colors.green("\u25B6")} Resumed timer on: ${colors.bold(timer.activity)}`);
  } catch (err) {
    console.error(colors.red(`Error: ${err.message}`));
    process.exit(1);
  }
});
program.command("status").description("Check currently running timer status").action(async () => {
  try {
    await dayflow.init();
    const status = await dayflow.getTimerStatus();
    if (!status.active || !status.timer) {
      console.log(colors.dim("No active timer running."));
      return;
    }
    const t = status.timer;
    const mins = Math.floor(t.elapsedSeconds / 60);
    const secs = t.elapsedSeconds % 60;
    const stateStr = t.isPaused ? colors.yellow("[PAUSED]") : colors.green("[RUNNING]");
    console.log(
      `${stateStr} ${colors.bold(t.activity)} [${colors.cyan(t.category)}] \u2014 ${colors.bold(`${mins}m ${secs}s`)} elapsed`
    );
  } catch (err) {
    console.error(colors.red(`Error: ${err.message}`));
    process.exit(1);
  }
});
program.command("log <activity> <duration>").description('Manually log time spent (e.g. dayflow log "reading" 45m --date yesterday)').option("-c, --category <category>", "Activity category", "deep work").option("-d, --date <date>", "Date (today, yesterday, or YYYY-MM-DD)", "today").option("--task <taskId>", "Link to task ID").action(async (activity, durationStr, options) => {
  try {
    await dayflow.init();
    const durationMinutes = parseDurationToMinutes(durationStr);
    const entry = await dayflow.logTime({
      activity,
      durationMinutes,
      category: options.category,
      date: options.date,
      taskId: options.task
    });
    console.log(
      `${colors.green("\u2714")} Logged ${colors.bold(formatDurationMinutes(entry.durationMinutes))} on "${entry.activity}" [${entry.category}] for ${options.date}.`
    );
  } catch (err) {
    console.error(colors.red(`Error: ${err.message}`));
    process.exit(1);
  }
});
program.command("today").description("View daily productivity summary and score").option("-d, --date <date>", "Target date (today, yesterday, or YYYY-MM-DD)", "today").option("-f, --format <format>", "Output format: text, json, md", "text").action(async (options) => {
  try {
    await dayflow.init();
    const summary = await dayflow.getDailySummary(options.date);
    if (options.format === "json") {
      console.log(formatJson(summary));
    } else if (options.format === "md") {
      console.log(formatDailySummaryMarkdown(summary));
    } else {
      console.log(formatDailySummaryText(summary));
    }
  } catch (err) {
    console.error(colors.red(`Error: ${err.message}`));
    process.exit(1);
  }
});
program.command("week").description("View weekly summary, trends, and score comparisons").option("-d, --date <date>", "Any date in the target week (defaults to today)", "today").option("-f, --format <format>", "Output format: text, json, md", "text").action(async (options) => {
  try {
    await dayflow.init();
    const summary = await dayflow.getWeeklySummary(options.date);
    if (options.format === "json") {
      console.log(formatJson(summary));
    } else if (options.format === "md") {
      console.log(formatWeeklySummaryMarkdown(summary));
    } else {
      console.log(formatWeeklySummaryText(summary));
    }
  } catch (err) {
    console.error(colors.red(`Error: ${err.message}`));
    process.exit(1);
  }
});
program.command("export").description("Export all dayflow data as JSON").option("-o, --output <file>", "Save export to file instead of stdout").action(async (options) => {
  try {
    await dayflow.init();
    const data = await dayflow.exportData();
    const json = JSON.stringify(data, null, 2);
    if (options.output) {
      await fs__default.default.writeFile(options.output, json, "utf-8");
      console.log(`${colors.green("\u2714")} Exported data to ${options.output}`);
    } else {
      console.log(json);
    }
  } catch (err) {
    console.error(colors.red(`Error: ${err.message}`));
    process.exit(1);
  }
});
program.command("import <file>").description("Import dayflow data from a JSON file").action(async (file) => {
  try {
    await dayflow.init();
    const content = await fs__default.default.readFile(file, "utf-8");
    const data = JSON.parse(content);
    await dayflow.importData(data);
    console.log(`${colors.green("\u2714")} Successfully imported data from ${file}`);
  } catch (err) {
    console.error(colors.red(`Error: ${err.message}`));
    process.exit(1);
  }
});
program.command("config").description("View or update configuration").option("--list", "Show all configuration settings").option("--set-target <minutes>", "Set daily focus target in minutes").option("--set-weekstart <mon|sun>", "Set week start day (monday or sunday)").action(async (options) => {
  try {
    await dayflow.init();
    if (options.setTarget) {
      const mins = parseInt(options.setTarget, 10);
      if (isNaN(mins) || mins <= 0) throw new Error("Target must be a positive integer.");
      await dayflow.updateConfig({ targetFocusMinutes: mins });
      console.log(`${colors.green("\u2714")} Focus target updated to ${mins} minutes.`);
    }
    if (options.setWeekstart) {
      const ws = options.setWeekstart.toLowerCase().startsWith("sun") ? "sunday" : "monday";
      await dayflow.updateConfig({ weekStartsOn: ws });
      console.log(`${colors.green("\u2714")} Week start updated to ${ws}.`);
    }
    const cfg = dayflow.getConfig();
    console.log(colors.bold("Current Dayflow Configuration:"));
    console.log(JSON.stringify(cfg, null, 2));
  } catch (err) {
    console.error(colors.red(`Error: ${err.message}`));
    process.exit(1);
  }
});
program.parse(process.argv);
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map