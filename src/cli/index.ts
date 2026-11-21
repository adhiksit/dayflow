#!/usr/bin/env node

import { Command } from 'commander';
import fs from 'node:fs/promises';
import { Dayflow } from '../core/Dayflow.js';
import { colors } from './utils.js';
import {
  formatTaskListText,
  formatDailySummaryText,
  formatWeeklySummaryText,
} from './formatters/text.js';
import {
  formatTaskListMarkdown,
  formatDailySummaryMarkdown,
  formatWeeklySummaryMarkdown,
} from './formatters/markdown.js';
import { formatJson } from './formatters/json.js';
import {
  parseDurationToMinutes,
  formatDurationMinutes,
  resolveDateString,
  getWeekRange,
} from '../utils/date.js';
import { TaskPriority, TaskStatus } from '../types/models.js';

const program = new Command();
const dayflow = new Dayflow();

program
  .name('dayflow')
  .description('A lightweight, offline productivity engine and CLI')
  .version('1.0.0');

// ADD TASK
program
  .command('add <title>')
  .description('Add a new task')
  .option('-t, --tag <tag>', 'Category tag (e.g. work, health, study)')
  .option('-p, --priority <priority>', 'Priority: low, medium, high', 'medium')
  .option('-e, --estimate <minutes>', 'Time estimate in minutes or format like "45m", "1.5h"')
  .option('-d, --due <date>', 'Due date (YYYY-MM-DD, today, tomorrow)')
  .action(async (title: string, options) => {
    try {
      await dayflow.init();
      let estimateMinutes: number | undefined;
      if (options.estimate) {
        estimateMinutes = parseDurationToMinutes(options.estimate);
      }

      const priority = options.priority?.toLowerCase() as TaskPriority;
      if (priority && !['low', 'medium', 'high'].includes(priority)) {
        throw new Error('Priority must be "low", "medium", or "high".');
      }

      let dueDate: string | undefined;
      if (options.due) {
        const cfg = dayflow.getConfig();
        dueDate = resolveDateString(options.due, new Date(), cfg.timezone);
      }

      const task = await dayflow.addTask({
        title,
        tag: options.tag,
        priority: priority || 'medium',
        estimate: estimateMinutes,
        dueDate,
      });

      console.log(
        `${colors.green('✔')} Task added: ${colors.bold(task.title)} ${colors.dim(`(${task.id})`)}`,
      );
    } catch (err: unknown) {
      console.error(colors.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }
  });

// LIST TASKS
program
  .command('list')
  .description('List tasks with optional filters')
  .option('--today', 'Filter tasks for today')
  .option('--week', 'Filter tasks for this week')
  .option('-s, --status <status>', 'Filter by status: todo, in-progress, done')
  .option('-t, --tag <tag>', 'Filter by tag')
  .option('-p, --priority <priority>', 'Filter by priority')
  .option('-f, --format <format>', 'Output format: text, json, md', 'text')
  .action(async (options) => {
    try {
      await dayflow.init();
      let dateFilter: string | undefined;
      if (options.today) {
        dateFilter = 'today';
      }

      let tasks = await dayflow.listTasks({
        date: dateFilter,
        status: options.status as TaskStatus,
        tag: options.tag,
        priority: options.priority as TaskPriority,
      });

      if (options.week) {
        const cfg = dayflow.getConfig();
        const todayKey = resolveDateString('today', new Date(), cfg.timezone);
        const { days } = getWeekRange(todayKey, cfg.weekStartsOn, cfg.timezone);
        const daySet = new Set(days);
        tasks = tasks.filter((t) => {
          if (t.dueDate && daySet.has(t.dueDate)) return true;
          if (t.completedAt) {
            const completedKey = resolveDateString(t.completedAt, new Date(), cfg.timezone);
            if (daySet.has(completedKey)) return true;
          }
          const createdKey = resolveDateString(t.createdAt, new Date(), cfg.timezone);
          return daySet.has(createdKey);
        });
      }

      if (options.format === 'json') {
        console.log(formatJson(tasks));
      } else if (options.format === 'md') {
        console.log(formatTaskListMarkdown(tasks));
      } else {
        console.log(formatTaskListText(tasks));
      }
    } catch (err: unknown) {
      console.error(colors.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }
  });

// DONE TASK
program
  .command('done <id>')
  .description('Mark a task as done')
  .action(async (id: string) => {
    try {
      await dayflow.init();
      const task = await dayflow.completeTask(id);
      console.log(`${colors.green('✔')} Task completed: ${colors.bold(task.title)}`);
    } catch (err: unknown) {
      console.error(colors.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }
  });

// REOPEN TASK
program
  .command('reopen <id>')
  .description('Reopen a completed task')
  .action(async (id: string) => {
    try {
      await dayflow.init();
      const task = await dayflow.reopenTask(id);
      console.log(`${colors.yellow('↺')} Task reopened: ${colors.bold(task.title)}`);
    } catch (err: unknown) {
      console.error(colors.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }
  });

// EDIT TASK
program
  .command('edit <id>')
  .description('Edit an existing task')
  .option('-t, --title <title>', 'New title')
  .option('--tag <tag>', 'New category tag')
  .option('-p, --priority <priority>', 'New priority: low, medium, high')
  .option('-e, --estimate <minutes>', 'New estimate')
  .option('-d, --due <date>', 'New due date')
  .option('-s, --status <status>', 'New status: todo, in-progress, done')
  .action(async (id: string, options) => {
    try {
      await dayflow.init();
      let estimateMinutes: number | undefined;
      if (options.estimate !== undefined) {
        estimateMinutes = parseDurationToMinutes(options.estimate);
      }

      let dueDate: string | undefined;
      if (options.due !== undefined) {
        const cfg = dayflow.getConfig();
        dueDate = resolveDateString(options.due, new Date(), cfg.timezone);
      }

      const task = await dayflow.updateTask(id, {
        title: options.title,
        tag: options.tag,
        priority: options.priority as TaskPriority,
        estimate: estimateMinutes,
        dueDate,
        status: options.status as TaskStatus,
      });

      console.log(`${colors.green('✔')} Task updated: ${colors.bold(task.title)}`);
    } catch (err: unknown) {
      console.error(colors.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }
  });

// DELETE TASK
program
  .command('rm <id>')
  .description('Delete a task')
  .action(async (id: string) => {
    try {
      await dayflow.init();
      const task = await dayflow.deleteTask(id);
      console.log(`${colors.red('✖')} Deleted task: ${colors.bold(task.title)}`);
    } catch (err: unknown) {
      console.error(colors.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }
  });

// START TIMER
program
  .command('start <target>')
  .description('Start a timer tied to a task ID or free-form activity')
  .option(
    '-c, --category <category>',
    'Activity category (e.g. "deep work", "meetings", "admin", "break")',
  )
  .action(async (target: string, options) => {
    try {
      await dayflow.init();
      const { timer, previousEntry } = await dayflow.startTimer(target, options.category);

      if (previousEntry) {
        console.log(
          `${colors.dim('ℹ')} Previous timer on "${previousEntry.activity}" stopped (${formatDurationMinutes(previousEntry.durationMinutes)}).`,
        );
      }

      console.log(
        `${colors.green('▶')} Started timer on: ${colors.bold(timer.activity)} [${colors.cyan(timer.category)}]`,
      );
    } catch (err: unknown) {
      console.error(colors.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }
  });

// STOP TIMER
program
  .command('stop')
  .description('Stop the currently running timer')
  .action(async () => {
    try {
      await dayflow.init();
      const entry = await dayflow.stopTimer();
      console.log(
        `${colors.green('■')} Stopped timer: ${colors.bold(entry.activity)} — logged ${colors.cyan(formatDurationMinutes(entry.durationMinutes))}.`,
      );
    } catch (err: unknown) {
      console.error(colors.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }
  });

// PAUSE TIMER
program
  .command('pause')
  .description('Pause the active timer')
  .action(async () => {
    try {
      await dayflow.init();
      const timer = await dayflow.pauseTimer();
      const mins = Math.floor(timer.accumulatedSeconds / 60);
      console.log(
        `${colors.yellow('⏸')} Paused timer on: ${colors.bold(timer.activity)} (accumulated: ${mins}m)`,
      );
    } catch (err: unknown) {
      console.error(colors.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }
  });

// RESUME TIMER
program
  .command('resume')
  .description('Resume a paused timer')
  .action(async () => {
    try {
      await dayflow.init();
      const timer = await dayflow.resumeTimer();
      console.log(`${colors.green('▶')} Resumed timer on: ${colors.bold(timer.activity)}`);
    } catch (err: unknown) {
      console.error(colors.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }
  });

// TIMER STATUS
program
  .command('status')
  .description('Check currently running timer status')
  .action(async () => {
    try {
      await dayflow.init();
      const status = await dayflow.getTimerStatus();
      if (!status.active || !status.timer) {
        console.log(colors.dim('No active timer running.'));
        return;
      }

      const t = status.timer;
      const mins = Math.floor(t.elapsedSeconds / 60);
      const secs = t.elapsedSeconds % 60;
      const stateStr = t.isPaused ? colors.yellow('[PAUSED]') : colors.green('[RUNNING]');

      console.log(
        `${stateStr} ${colors.bold(t.activity)} [${colors.cyan(t.category)}] — ${colors.bold(`${mins}m ${secs}s`)} elapsed`,
      );
    } catch (err: unknown) {
      console.error(colors.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }
  });

// LOG MANUAL TIME
program
  .command('log <activity> <duration>')
  .description('Manually log time spent (e.g. dayflow log "reading" 45m --date yesterday)')
  .option('-c, --category <category>', 'Activity category', 'deep work')
  .option('-d, --date <date>', 'Date (today, yesterday, or YYYY-MM-DD)', 'today')
  .option('--task <taskId>', 'Link to task ID')
  .action(async (activity: string, durationStr: string, options) => {
    try {
      await dayflow.init();
      const durationMinutes = parseDurationToMinutes(durationStr);
      const entry = await dayflow.logTime({
        activity,
        durationMinutes,
        category: options.category,
        date: options.date,
        taskId: options.task,
      });

      console.log(
        `${colors.green('✔')} Logged ${colors.bold(formatDurationMinutes(entry.durationMinutes))} on "${entry.activity}" [${entry.category}] for ${options.date}.`,
      );
    } catch (err: unknown) {
      console.error(colors.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }
  });

// DAILY SUMMARY
program
  .command('today')
  .description('View daily productivity summary and score')
  .option('-d, --date <date>', 'Target date (today, yesterday, or YYYY-MM-DD)', 'today')
  .option('-f, --format <format>', 'Output format: text, json, md', 'text')
  .action(async (options) => {
    try {
      await dayflow.init();
      const summary = await dayflow.getDailySummary(options.date);

      if (options.format === 'json') {
        console.log(formatJson(summary));
      } else if (options.format === 'md') {
        console.log(formatDailySummaryMarkdown(summary));
      } else {
        console.log(formatDailySummaryText(summary));
      }
    } catch (err: unknown) {
      console.error(colors.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }
  });

// WEEKLY SUMMARY
program
  .command('week')
  .description('View weekly summary, trends, and score comparisons')
  .option('-d, --date <date>', 'Any date in the target week (defaults to today)', 'today')
  .option('-f, --format <format>', 'Output format: text, json, md', 'text')
  .action(async (options) => {
    try {
      await dayflow.init();
      const summary = await dayflow.getWeeklySummary(options.date);

      if (options.format === 'json') {
        console.log(formatJson(summary));
      } else if (options.format === 'md') {
        console.log(formatWeeklySummaryMarkdown(summary));
      } else {
        console.log(formatWeeklySummaryText(summary));
      }
    } catch (err: unknown) {
      console.error(colors.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }
  });

// EXPORT
program
  .command('export')
  .description('Export all dayflow data as JSON')
  .option('-o, --output <file>', 'Save export to file instead of stdout')
  .action(async (options) => {
    try {
      await dayflow.init();
      const data = await dayflow.exportData();
      const json = JSON.stringify(data, null, 2);

      if (options.output) {
        await fs.writeFile(options.output, json, 'utf-8');
        console.log(`${colors.green('✔')} Exported data to ${options.output}`);
      } else {
        console.log(json);
      }
    } catch (err: unknown) {
      console.error(colors.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }
  });

// IMPORT
program
  .command('import <file>')
  .description('Import dayflow data from a JSON file')
  .action(async (file: string) => {
    try {
      await dayflow.init();
      const content = await fs.readFile(file, 'utf-8');
      const data = JSON.parse(content);
      await dayflow.importData(data);
      console.log(`${colors.green('✔')} Successfully imported data from ${file}`);
    } catch (err: unknown) {
      console.error(colors.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }
  });

// CONFIG
program
  .command('config')
  .description('View or update configuration')
  .option('--list', 'Show all configuration settings')
  .option('--set-target <minutes>', 'Set daily focus target in minutes')
  .option('--set-weekstart <mon|sun>', 'Set week start day (monday or sunday)')
  .action(async (options) => {
    try {
      await dayflow.init();

      if (options.setTarget) {
        const mins = parseInt(options.setTarget, 10);
        if (isNaN(mins) || mins <= 0) throw new Error('Target must be a positive integer.');
        await dayflow.updateConfig({ targetFocusMinutes: mins });
        console.log(`${colors.green('✔')} Focus target updated to ${mins} minutes.`);
      }

      if (options.setWeekstart) {
        const ws = options.setWeekstart.toLowerCase().startsWith('sun') ? 'sunday' : 'monday';
        await dayflow.updateConfig({ weekStartsOn: ws });
        console.log(`${colors.green('✔')} Week start updated to ${ws}.`);
      }

      const cfg = dayflow.getConfig();
      console.log(colors.bold('Current Dayflow Configuration:'));
      console.log(JSON.stringify(cfg, null, 2));
    } catch (err: unknown) {
      console.error(colors.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }
  });

program.parse(process.argv);
