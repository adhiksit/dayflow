# dayflow

A lightweight, offline-first productivity engine and CLI that tracks tasks, timers, calculates explainable productivity scores (0-100), and generates daily and weekly summaries. No network, no telemetry -- your data stays on your machine.

## Features

- **Task tracking** -- add, edit, complete, reopen, delete, list with filters (date, status, tag, priority)
- **Time tracking** -- start/stop/pause timers, manual time logging, crash-safe recovery
- **Productivity score** -- 0-100 with a full breakdown so you know exactly where points come from
- **Summaries** -- daily and weekly reports with sparklines, trends, category breakdowns
- **Offline and private** -- all data stored locally, zero network requests
- **Dual interface** -- use as a CLI tool or as a programmatic TypeScript/JavaScript library

## Install

```bash
npm install @adhiksit/dayflow        # as a library dependency
npm install -g @adhiksit/dayflow     # as a global CLI
npx @adhiksit/dayflow --help         # or run directly
```

## Quick Start (CLI)

```bash
# Add some tasks
dayflow add "Write quarterly report" --tag work --priority high --estimate 90 --due today
dayflow add "Review pull requests" --tag code --priority medium --estimate 30

# Start a timer
dayflow start "Write quarterly report"
# ... work for a while ...
dayflow stop

# Log time manually
dayflow log "Team standup" 30m --category meetings

# See your day
dayflow today

# See your week
dayflow week
```

## CLI Reference

| Command | Description |
|---|---|
| `dayflow add <title> [options]` | Add a task (`--tag`, `--priority`, `--estimate`, `--due`) |
| `dayflow list [options]` | List tasks (`--today`, `--week`, `--status`, `--tag`, `--priority`, `--format`) |
| `dayflow done <id>` | Mark a task as done |
| `dayflow reopen <id>` | Reopen a completed task |
| `dayflow edit <id> [options]` | Edit a task |
| `dayflow rm <id>` | Delete a task |
| `dayflow start <id or activity>` | Start a timer (`--category`) |
| `dayflow stop` | Stop the running timer |
| `dayflow pause` | Pause the running timer |
| `dayflow resume` | Resume a paused timer |
| `dayflow status` | Show current timer status |
| `dayflow log <activity> <duration>` | Log time manually (`--category`, `--date`) |
| `dayflow today [options]` | Daily summary (`--date`, `--format text\|json\|md`) |
| `dayflow week [options]` | Weekly summary (`--date`, `--format text\|json\|md`) |
| `dayflow export [--output file]` | Export all data as JSON |
| `dayflow import <file>` | Import data from JSON |
| `dayflow config` | View or update settings |

## Programmatic API

```typescript
import { Dayflow, MemoryStorageAdapter } from '@adhiksit/dayflow';

const df = new Dayflow({
  storage: new MemoryStorageAdapter(),
  config: { timezone: 'America/New_York' },
});
await df.init();

// Tasks
const task = await df.addTask({ title: 'Ship feature', priority: 'high', estimate: 120 });
await df.completeTask(task.id);

// Timers
await df.startTimer('Deep coding session', 'deep work');
// ... later ...
const entry = await df.stopTimer();

// Manual logging
await df.logTime({ activity: 'Reading', durationMinutes: 45, category: 'deep work' });

// Scoring and summaries
const score = await df.getScore();          // today's score
const daily = await df.getDailySummary();    // today's summary
const weekly = await df.getWeeklySummary();  // this week's summary

// Events
df.on('taskCompleted', (task) => console.log('Done:', task.title));
df.on('timerStopped', (entry) => console.log('Logged:', entry.durationMinutes, 'min'));
```

## Scoring Formula

The productivity score (0-100) is computed from four weighted components plus modifiers:

| Component | Default Weight | How It Works |
|---|---|---|
| Task Completion | 25% | done / planned tasks |
| Focus Time | 30% | deep work minutes / target (default 4h) |
| Priority Completion | 25% | priority-weighted done / planned |
| Estimate Accuracy | 20% | average accuracy of actual vs estimated time |

**Modifiers:** -5 per overdue task (max -20), +2 per streak day with score >= 60 (max +10).

The API returns a full `breakdown` object so every point is traceable. Run `dayflow today --format json` to see the raw breakdown.

## Storage Adapters

dayflow ships with two storage adapters:

- **JsonFileStorageAdapter** (default for CLI) -- atomic writes (temp file + rename) to the OS data directory
- **MemoryStorageAdapter** -- in-memory, ideal for tests and embedding

Create your own by implementing the `StorageAdapter` interface:

```typescript
interface StorageAdapter {
  load(): Promise<DayflowData>;
  save(data: DayflowData): Promise<void>;
}
```

Data directory defaults: macOS `~/Library/Application Support/dayflow`, Linux `~/.local/share/dayflow`, Windows `%APPDATA%/dayflow`. Override with `DAYFLOW_DATA_DIR`.

## Configuration

```bash
dayflow config --set-target 300    # 5 hours focus target
dayflow config --set-weekstart sun # weeks start on Sunday
dayflow config                     # view current config
```

Weights, penalties, bonuses, working hours, and timezone are all configurable via the API or the JSON data file.

## Requirements

- Node.js 18 or later
- Works on macOS, Linux, and Windows
