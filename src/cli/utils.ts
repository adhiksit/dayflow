import pc from 'picocolors';

export function isColorSupported(): boolean {
  if (process.env['NO_COLOR'] !== undefined || process.env['NODE_DISABLE_COLORS'] !== undefined) {
    return false;
  }
  return Boolean(process.stdout && process.stdout.isTTY);
}

export const colors = {
  bold: (s: string) => (isColorSupported() ? pc.bold(s) : s),
  dim: (s: string) => (isColorSupported() ? pc.dim(s) : s),
  green: (s: string) => (isColorSupported() ? pc.green(s) : s),
  yellow: (s: string) => (isColorSupported() ? pc.yellow(s) : s),
  blue: (s: string) => (isColorSupported() ? pc.blue(s) : s),
  magenta: (s: string) => (isColorSupported() ? pc.magenta(s) : s),
  cyan: (s: string) => (isColorSupported() ? pc.cyan(s) : s),
  red: (s: string) => (isColorSupported() ? pc.red(s) : s),
  gray: (s: string) => (isColorSupported() ? pc.gray(s) : s),
};

export function renderScorePill(score: number): string {
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

export function renderProgressBar(percentage: number, width = 20): string {
  const clamped = Math.max(0, Math.min(100, percentage));
  const filledChars = Math.round((clamped / 100) * width);
  const emptyChars = width - filledChars;
  const bar = '█'.repeat(filledChars) + '░'.repeat(emptyChars);
  return `${colors.cyan(bar)} ${clamped}%`;
}
