import type { Response } from 'express';

type Listener = (payload: unknown) => void;

class Bus {
  private listeners = new Map<string, Set<Listener>>();

  subscribe(channel: string, fn: Listener): () => void {
    let set = this.listeners.get(channel);
    if (!set) {
      set = new Set();
      this.listeners.set(channel, set);
    }
    set.add(fn);
    return () => {
      set!.delete(fn);
      if (set!.size === 0) this.listeners.delete(channel);
    };
  }

  publish(channel: string, payload: unknown): void {
    const set = this.listeners.get(channel);
    if (!set) return;
    for (const fn of set) {
      try {
        fn(payload);
      } catch {
        /* ignore listener errors */
      }
    }
  }
}

export const bus = new Bus();

export function writeSseHeaders(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
}

export function sendSse(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function channelFor(userId: string): string {
  return `user:${userId}`;
}

export function broadcastChannel(): string {
  return 'broadcast';
}