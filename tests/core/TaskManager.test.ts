import { describe, it, expect, beforeEach } from 'vitest';
import { TaskManager } from '../../src/core/TaskManager.js';
import { SettableClock } from '../../src/utils/clock.js';
import { Task } from '../../src/types/models.js';

describe('TaskManager', () => {
  let clock: SettableClock;
  let tasks: Task[];
  let manager: TaskManager;

  beforeEach(() => {
    clock = new SettableClock('2026-11-22T10:00:00.000Z');
    tasks = [];
    manager = new TaskManager(tasks, clock, 'UTC');
  });

  it('adds a task with default and custom values', () => {
    const task = manager.addTask({
      title: 'Write docs',
      tag: 'work',
      priority: 'high',
      estimate: 60,
      dueDate: '2026-11-25',
    });

    expect(task.id).toMatch(/^t_/);
    expect(task.title).toBe('Write docs');
    expect(task.tag).toBe('work');
    expect(task.priority).toBe('high');
    expect(task.estimate).toBe(60);
    expect(task.dueDate).toBe('2026-11-25');
    expect(task.status).toBe('todo');
    expect(task.createdAt).toBe('2026-11-22T10:00:00.000Z');
    expect(tasks).toHaveLength(1);
  });

  it('throws on empty title', () => {
    expect(() => manager.addTask({ title: '   ' })).toThrow('Task title cannot be empty.');
  });

  it('updates task properties and status transition', () => {
    const task = manager.addTask({ title: 'Initial task' });
    clock.advanceMinutes(30);

    const updated = manager.updateTask(task.id, {
      title: 'Renamed task',
      tag: 'urgent',
      priority: 'high',
      estimate: 45,
      status: 'done',
    });

    expect(updated.title).toBe('Renamed task');
    expect(updated.tag).toBe('urgent');
    expect(updated.priority).toBe('high');
    expect(updated.estimate).toBe(45);
    expect(updated.status).toBe('done');
    expect(updated.completedAt).toBe('2026-11-22T10:30:00.000Z');

    // Revert status to in-progress
    manager.updateTask(task.id, { status: 'in-progress' });
    expect(task.status).toBe('in-progress');
    expect(task.completedAt).toBeUndefined();
  });

  it('completes and reopens tasks', () => {
    const task = manager.addTask({ title: 'Review PR' });
    clock.advanceMinutes(15);

    manager.completeTask(task.id);
    expect(task.status).toBe('done');
    expect(task.completedAt).toBe('2026-11-22T10:15:00.000Z');

    manager.reopenTask(task.id);
    expect(task.status).toBe('todo');
    expect(task.completedAt).toBeUndefined();
  });

  it('deletes a task', () => {
    const task1 = manager.addTask({ title: 'Task 1' });
    const task2 = manager.addTask({ title: 'Task 2' });

    const deleted = manager.deleteTask(task1.id);
    expect(deleted.id).toBe(task1.id);
    expect(tasks).toHaveLength(1);
    expect(manager.getTask(task1.id)).toBeUndefined();
    expect(manager.getTask(task2.id)).toBeDefined();

    expect(() => manager.deleteTask('non-existent')).toThrow();
  });

  it('filters tasks by status, priority, tag, and date', () => {
    manager.addTask({
      title: 'Task 1',
      status: 'todo',
      priority: 'high',
      tag: 'dev',
      dueDate: '2026-11-22',
    });
    const t2 = manager.addTask({
      title: 'Task 2',
      status: 'todo',
      priority: 'low',
      tag: 'dev',
      dueDate: '2026-11-23',
    });
    manager.addTask({ title: 'Task 3', status: 'todo', priority: 'medium', tag: 'admin' });
    manager.completeTask(t2.id);

    expect(manager.listTasks({ status: 'done' })).toHaveLength(1);
    expect(manager.listTasks({ priority: 'high' })).toHaveLength(1);
    expect(manager.listTasks({ tag: 'dev' })).toHaveLength(2);
    // Task 1: dueDate 2026-11-22
    // Task 2: completed on 2026-11-22
    // Task 3: created on 2026-11-22
    expect(manager.listTasks({ date: '2026-11-22' })).toHaveLength(3);
  });

  it('identifies overdue tasks', () => {
    manager.addTask({ title: 'Overdue task', dueDate: '2026-11-20' });
    manager.addTask({ title: 'Today task', dueDate: '2026-11-22' });
    const completedOverdue = manager.addTask({ title: 'Done overdue', dueDate: '2026-11-19' });
    manager.completeTask(completedOverdue.id);

    const overdue = manager.getOverdueTasks('2026-11-22');
    expect(overdue).toHaveLength(1);
    expect(overdue[0]!.title).toBe('Overdue task');
  });
});
