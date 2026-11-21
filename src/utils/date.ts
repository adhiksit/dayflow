/**
 * Date and timezone helper functions.
 * Storing UTC ISO strings for timestamps, but performing day/week boundary
 * calculations in the user's configured timezone.
 */

export interface DateParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number;
  minute: number;
  second: number;
}

/**
 * Formats a Date object to YYYY-MM-DD in the specified timezone.
 */
export function formatDateKey(date: Date, timezone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date);
  } catch {
    // Fallback if invalid timezone
    return date.toISOString().slice(0, 10);
  }
}

/**
 * Parses YYYY-MM-DD or keywords like 'today', 'yesterday' relative to clock and timezone.
 */
export function resolveDateString(input: string | undefined, now: Date, timezone: string): string {
  if (!input || input.toLowerCase() === 'today') {
    return formatDateKey(now, timezone);
  }
  if (input.toLowerCase() === 'yesterday') {
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return formatDateKey(yesterday, timezone);
  }
  if (input.toLowerCase() === 'tomorrow') {
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    return formatDateKey(tomorrow, timezone);
  }

  // Check if standard YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return input;
  }

  // Try parsing natural or other format
  const parsed = new Date(input);
  if (!isNaN(parsed.getTime())) {
    return formatDateKey(parsed, timezone);
  }

  throw new Error(`Invalid date format: "${input}". Expected YYYY-MM-DD, "today", or "yesterday".`);
}

/**
 * Gets the start and end of a week (YYYY-MM-DD) containing targetDateKey.
 */
export function getWeekRange(
  dateKey: string,
  weekStartsOn: 'monday' | 'sunday',
  _timezone?: string,
): { weekStart: string; weekEnd: string; days: string[] } {
  // Parse dateKey into UTC midday to avoid any local DST shifting
  const [year, month, day] = dateKey.split('-').map(Number);
  if (!year || !month || !day) {
    throw new Error(`Invalid date key: ${dateKey}`);
  }

  // Create date in UTC
  const utcDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const dayOfWeek = utcDate.getUTCDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday

  let diffToStart = 0;
  if (weekStartsOn === 'monday') {
    // Monday is 1; Sunday is 0 -> 7
    const adjustedDay = dayOfWeek === 0 ? 7 : dayOfWeek;
    diffToStart = adjustedDay - 1;
  } else {
    // Sunday is 0
    diffToStart = dayOfWeek;
  }

  const startDate = new Date(utcDate.getTime() - diffToStart * 24 * 60 * 60 * 1000);
  const days: string[] = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dt = String(d.getUTCDate()).padStart(2, '0');
    days.push(`${y}-${m}-${dt}`);
  }

  return {
    weekStart: days[0]!,
    weekEnd: days[6]!,
    days,
  };
}

/**
 * Checks whether an ISO timestamp falls on a given YYYY-MM-DD in the specified timezone.
 */
export function isTimestampOnDate(isoString: string, dateKey: string, timezone: string): boolean {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return false;
    return formatDateKey(d, timezone) === dateKey;
  } catch {
    return false;
  }
}

/**
 * Calculates human duration string from minutes.
 * e.g., 45 -> "45m", 125 -> "2h 5m", 0 -> "0m"
 */
export function formatDurationMinutes(minutes: number): string {
  const rounded = Math.round(minutes);
  if (rounded < 60) {
    return `${rounded}m`;
  }
  const hours = Math.floor(rounded / 60);
  const remainingMins = rounded % 60;
  return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
}

/**
 * Parses duration strings like "45m", "1.5h", "2h30m", "90" (minutes) into minutes.
 */
export function parseDurationToMinutes(input: string): number {
  const trimmed = input.trim().toLowerCase();

  // Pure number = minutes
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return parseFloat(trimmed);
  }

  // Complex e.g. "1h 30m" or "1h30m"
  const comboMatch = trimmed.match(
    /^(\d+(?:\.\d+)?)\s*h(?:ours?)?(?:\s*(\d+(?:\.\d+)?)\s*m(?:in(?:ute)?s?)?)?$/,
  );
  if (comboMatch) {
    const hours = parseFloat(comboMatch[1] || '0');
    const mins = parseFloat(comboMatch[2] || '0');
    return hours * 60 + mins;
  }

  // Pure minutes e.g. "45m", "45 mins"
  const minMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*m(?:in(?:ute)?s?)?$/);
  if (minMatch) {
    return parseFloat(minMatch[1]!);
  }

  // Pure hours e.g. "2h", "1.5h"
  const hourMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*h(?:ours?)?$/);
  if (hourMatch) {
    return parseFloat(hourMatch[1]!) * 60;
  }

  throw new Error(`Invalid duration format: "${input}". Examples: "45m", "1h", "1.5h", "1h30m".`);
}
