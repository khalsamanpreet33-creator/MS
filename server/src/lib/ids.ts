import { randomBytes } from 'node:crypto';

/** URL-safe random ID with prefix. Example: id('usr') -> 'usr_a8f3...' */
export function id(prefix: string): string {
  const bytes = randomBytes(9);
  const b64 = bytes
    .toString('base64')
    .replace(/\+/g, '0')
    .replace(/\//g, '0')
    .replace(/=+$/, '');
  return `${prefix}_${b64}`;
}

/** Generates a human-friendly receipt / invoice number like RCP-20250824-3F2A. */
export function publicNo(prefix: string): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const tag = randomBytes(2).toString('hex').toUpperCase();
  return `${prefix}-${date}-${tag}`;
}