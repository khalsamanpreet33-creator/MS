import { useAuthStore } from '../store/auth';

const BASE = '/api';

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  init?: RequestInit,
): Promise<T> {
  const token = useAuthStore.getState().token;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (init?.headers) Object.assign(headers, init.headers as Record<string, string>);

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    ...init,
  });

  if (res.status === 401) {
    useAuthStore.getState().logout();
    throw new ApiError(401, 'unauthorized');
  }

  const text = await res.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (!res.ok) {
    const message =
      data && typeof data === 'object' && 'message' in data
        ? String((data as { message?: string }).message ?? res.statusText)
        : res.statusText;
    throw new ApiError(res.status, message, data);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, init?: RequestInit) => request<T>('GET', path, undefined, init),
  post: <T>(path: string, body?: unknown, init?: RequestInit) => request<T>('POST', path, body, init),
  patch: <T>(path: string, body?: unknown, init?: RequestInit) => request<T>('PATCH', path, body, init),
  put: <T>(path: string, body?: unknown, init?: RequestInit) => request<T>('PUT', path, body, init),
  delete: <T>(path: string, init?: RequestInit) => request<T>('DELETE', path, undefined, init),
};

export function downloadFile(path: string, filename: string): void {
  const token = useAuthStore.getState().token;
  fetch(`${BASE}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
    .then((r) => r.blob())
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    })
    .catch((e) => console.error('download failed', e));
}