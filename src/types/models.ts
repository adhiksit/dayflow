export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskStatus = 'todo' | 'in-progress' | 'done';

export interface Task {
  id: string;
  title: string;
  tag?: string;
  priority: TaskPriority;
  estimate?: number; // in minutes
  dueDate?: string; // 'YYYY-MM-DD'
  status: TaskStatus;
  createdAt: string; // UTC ISO 8601 string
  completedAt?: string; // UTC ISO 8601 string
}

export type ActivityCategory = 'deep work' | 'meetings' | 'admin' | 'break' | string;

export interface TimeEntry {
  id: string;
  taskId?: string;
  activity: string;
  category: ActivityCategory;
  startTime: string; // UTC ISO 8601 string
  endTime: string; // UTC ISO 8601 string
  durationMinutes: number; // rounded to 2 decimal places
  isManual: boolean;
}

export interface ActiveTimer {
  id: string;
  taskId?: string;
  activity: string;
  category: ActivityCategory;
  startTime: string; // UTC ISO 8601 string when segment started
  pausedAt?: string; // UTC ISO 8601 string if currently paused
  accumulatedSeconds: number; // Seconds tracked before current segment
}

export interface TaskFilter {
  date?: string; // 'YYYY-MM-DD' (matches dueDate or createdAt/completedAt in user's timezone)
  status?: TaskStatus;
  tag?: string;
  priority?: TaskPriority;
}
