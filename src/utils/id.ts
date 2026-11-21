import crypto from 'node:crypto';

/**
 * Generates a short, collision-resistant unique ID with an optional prefix.
 * e.g., t_a7b9c1 or te_f4e2d8
 */
export function generateId(prefix?: string): string {
  const randomBytes = crypto.randomBytes(4).toString('hex');
  return prefix ? `${prefix}_${randomBytes}` : randomBytes;
}
