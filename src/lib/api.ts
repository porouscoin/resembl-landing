/**
 * Use the backend directly (port 8000) to avoid Next.js proxy timeouts
 * on long-running requests like /analyze.
 */
const API_BASE = typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.hostname}:8000/api`
  : 'http://localhost:8000/api';

export async function apiFetch<T = any>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, options);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export function apiFormPost<T = any>(path: string, data: Record<string, string | Blob>): Promise<T> {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) fd.append(k, v);
  return apiFetch<T>(path, { method: 'POST', body: fd });
}

export function apiJsonPost<T = any>(path: string, body: object): Promise<T> {
  return apiFetch<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function createSSEStream(path: string, onMessage: (data: any) => void, onError?: (err: any) => void) {
  const es = new EventSource(`${API_BASE}${path}`);
  es.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      onMessage(data);
    } catch {
      /* ignore parse errors */
    }
  };
  es.onerror = (e) => {
    onError?.(e);
    es.close();
  };
  return es;
}

/**
 * POST-based SSE stream reader. Returns an AbortController to cancel.
 * Hits the backend directly (port 8000) to bypass Next.js proxy buffering.
 */
const SSE_BASE = API_BASE;

export function apiStreamPost(
  path: string,
  body: object,
  onEvent: (data: any) => void,
  onError?: (err: any) => void,
): AbortController {
  const controller = new AbortController();
  (async () => {
    try {
      const res = await fetch(`${SSE_BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No readable stream');
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            try {
              const data = JSON.parse(trimmed.slice(6));
              onEvent(data);
            } catch { /* skip */ }
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') onError?.(err);
    }
  })();
  return controller;
}
