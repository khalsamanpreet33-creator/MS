import { useEffect, useRef } from 'react';
import { useAuthStore } from '../store/auth';

type Handler = (event: string, payload: unknown) => void;

export function useSse(handler: Handler): void {
  const token = useAuthStore((s) => s.token);
  const ref = useRef(handler);
  ref.current = handler;

  useEffect(() => {
    if (!token) return;
    const es = new EventSource(`/api/events?access_token=${encodeURIComponent(token)}`);
    // EventSource doesn't support custom Authorization headers in browsers; pass via query for simplicity.
    const onMessage = (event: MessageEvent) => {
      try {
        ref.current(event.type, JSON.parse(event.data));
      } catch { /* ignore */ }
    };
    es.addEventListener('hello', onMessage as EventListener);
    es.addEventListener('message', onMessage as EventListener);
    es.addEventListener('broadcast', onMessage as EventListener);
    es.addEventListener('heartbeat', onMessage as EventListener);
    es.onerror = () => { /* browser will auto-reconnect */ };
    return () => es.close();
  }, [token]);
}