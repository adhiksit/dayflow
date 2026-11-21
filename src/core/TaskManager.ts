import { Task, TaskFilter, TaskPriority, TaskStatus } from '../types/models.js';
import { generateId } from '../utils/id.js';
import { Clock } from '../utils/clock.js';
import { formatDateKey, isTimestampOnDate } from '../utils/date.js';

export interface CreateTaskOptions {
  title: string;
  tag?: string;
  priority?: TaskPriority;
  estimate?: number;
  dueDate?: string; // YYYY-MM-DD
}

export interface UpdateTaskOptions {
  title?: string;
  tag?: string;
  priority?: TaskPriority;
  estimate?: number;
  dueDate?: string;
  status?: TaskStatus;
}

export class TaskManager {
  private tasks: Task[];
  private clock: Clock;
  private timezone: string;

  constructor(tasks: Task[], clock: Clock, timezone: string) {
    this.tasks = tasks;
    this.clock = clock;
    this.timezone = timezone;
  }

  getTasks(): Task[] {
    return this.tasks;
  }

  addTask(options: CreateTaskOptions): Task {
    if (!options.title || !options.title.trim()) {
      throw new Error('Task title cannot be empty.');
    }

    const task: Task = {
      id: generateId('t'),
      title: options.title.trim(),
      tag: options.tag?.trim() || undefined,
      priority: options.priority || 'medium',
      estimate: options.estimate !== undefined ? Math.max(0, options.estimate) : undefined,
      dueDate: options.dueDate?.trim() || undefined,
      status: 'todo',
      createdAt: this.clock.now().toISOString(),
    };

    this.tasks.push(task);
    return task;
  }

  getTask(id: string): Task | undefined {
    return this.tasks.find((t) => t.id === id);
  }

  updateTask(id: string, updates: UpdateTaskOptions): Task {
    const task = this.getTask(id);
    if (!task) {
      throw new Error(`Task with ID "${id}" not found.`);
    }

    if (updates.title !== undefined) {
      if (!updates.title.trim()) {
        throw new Error('Task title cannot be empty.');
      }
      task.title = updates.title.trim();
    }

    if (updates.tag !== undefined) {
      task.tag = updates.tag.trim() || undefined;
    }

    if (updates.priority !== undefined) {
      task.priority = updates.priority;
    }

    if (updates.estimate !== undefined) {
      task.estimate = Math.max(0, updates.estimate);
    }

    if (updates.dueDate !== undefined) {
      task.dueDate = updates.dueDate.trim() || undefined;
    }

    if (updates.status !== undefined) {
      if (updates.status === 'done' && task.status !== 'done') {
        task.status = 'done';
        task.completedAt = this.clock.now().toISOString();
      } else if (updates.status !== 'done' && task.status === 'done') {
        task.status = updates.status;
        task.completedAt = undefined;
      } else {
        task.status = updates.status;
      }
    }

    return task;
  }

  completeTask(id: string): Task {
    const task = this.getTask(id);
    if (!task) {
      throw new Error(`Task with ID "${id}" not found.`);
    }

    task.status = 'done';
    task.completedAt = this.clock.now().toISOString();
    return task;
  }

  reopenTask(id: string): Task {
    const task = this.getTask(id);
    if (!task) {
      throw new Error(`Task with ID "${id}" not found.`);
    }

    task.status = 'todo';
    task.completedAt = undefined;
    return task;
  }

  deleteTask(id: string): Task {
    const index = this.tasks.findIndex((t) => t.id === id);
    if (index === -1) {
      throw new Error(`Task with ID "${id}" not found.`);
    }

    const [deleted] = this.tasks.splice(index, 1);
    return deleted!;
  }

  listTasks(filter?: TaskFilter): Task[] {
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
        // Matches if dueDate matches targetDate
        if (t.dueDate === targetDate) return true;
        // Or if completed on targetDate
        if (t.completedAt && isTimestampOnDate(t.completedAt, targetDate, this.timezone)) {
          return true;
        }
        // Or if created on targetDate and still todo/in-progress
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
  getOverdueTasks(asOfDateKey?: string): Task[] {
    const refDate = asOfDateKey || formatDateKey(this.clock.now(), this.timezone);
    return this.tasks.filter((t) => {
      if (t.status === 'done') return false;
      if (!t.dueDate) return false;
      return t.dueDate < refDate;
    });
  }
}
