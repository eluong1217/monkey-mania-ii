import type { SocketLike } from '../connection';

export interface SimNetworkOptions {
  /** Added round-trip latency in ms, split evenly between the two directions. */
  lagMs: number;
  /** Probability (0..1) that a server `snapshot` message is dropped. */
  drop: number;
  random?: () => number;
}

/** Reads the dev-only `?lag=150&drop=0.05` flags. Returns null if neither is set. */
export function simNetworkFromQuery(search: string): SimNetworkOptions | null {
  const q = new URLSearchParams(search);
  const lagMs = Math.max(0, Number(q.get('lag')) || 0);
  const drop = Math.min(1, Math.max(0, Number(q.get('drop')) || 0));
  return lagMs || drop ? { lagMs, drop } : null;
}

function isSnapshot(data: unknown): boolean {
  if (typeof data !== 'string') return false;
  try {
    return (JSON.parse(data) as { type?: unknown }).type === 'snapshot';
  } catch {
    return false;
  }
}

/**
 * Wraps a socket to fake a worse network: messages in both directions are delayed (in order)
 * and some snapshots never arrive. Dev only; see `main.ts`.
 */
export function withSimNetwork(inner: SocketLike, opts: SimNetworkOptions): SocketLike {
  const half = opts.lagMs / 2;
  const random = opts.random ?? Math.random;
  const later = (fn: () => void): void => {
    if (half > 0) setTimeout(fn, half);
    else fn();
  };
  const outer: SocketLike = {
    onopen: null,
    onclose: null,
    onerror: null,
    onmessage: null,
    send: (data) => later(() => inner.send(data)),
    close: () => inner.close(),
  };
  inner.onopen = () => outer.onopen?.();
  inner.onclose = () => outer.onclose?.();
  inner.onerror = () => outer.onerror?.();
  inner.onmessage = (ev) => {
    if (opts.drop > 0 && isSnapshot(ev.data) && random() < opts.drop) return;
    later(() => outer.onmessage?.(ev));
  };
  return outer;
}
