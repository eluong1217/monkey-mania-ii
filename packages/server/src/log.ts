import { createHash, randomBytes } from 'node:crypto';

/** Structured event log: one event name plus plain JSON data. */
export type Log = (event: string, data?: Record<string, unknown>) => void;

export const noLog: Log = () => {};

/** One JSON line per event on stdout (stderr for errors), for the host's log viewer. */
export const jsonLog: Log = (event, data = {}) => {
  const line = JSON.stringify({ t: new Date().toISOString(), event, ...data });
  if (/error/i.test(event)) console.error(line);
  else console.log(line);
};

const salt = randomBytes(16);

/**
 * Logs never hold a raw IP. This salted hash (salt is per process, never stored) still lets
 * one run's lines be grouped by client without recording who the client was.
 */
export function ipTag(ip: string): string {
  return createHash('sha256').update(salt).update(ip).digest('hex').slice(0, 10);
}
