import { Task, TimeEntry, ActiveTimer } from './models.js';
import { ProductivityScore } from './score.js';

export interface DayflowEvents {
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
