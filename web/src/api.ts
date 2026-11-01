import type { IsolineResult, LngLat, PlacesResult, RouteResult } from './types';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const TIMEOUT_MS = 15_000;

async function request<T>(base: string, path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${base}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      throw new ApiError(`Unexpected response from server (${res.status})`, res.status);
    }
    if (!res.ok) {
      const msg = (data as { error?: string } | null)?.error ?? `Request failed (${res.status})`;
      throw new ApiError(res.status === 429 ? 'Too many requests — please wait a moment and retry.' : msg, res.status);
    }
    return data as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof DOMException && err.name === 'AbortError') throw new ApiError('The request timed out. Check your connection.', 0);
    throw new ApiError('Network error — are you offline?', 0);
  } finally {
    clearTimeout(timer);
  }
}

export function createApi(base: string) {
  return {
    route: (waypoints: LngLat[], optimize: boolean) =>
      request<RouteResult>(base, '/route', { method: 'POST', body: JSON.stringify({ waypoints, optimize }) }),
    isoline: (origin: LngLat, minutes: number[]) =>
      request<IsolineResult>(base, '/isoline', { method: 'POST', body: JSON.stringify({ origin, minutes }) }),
    search: (q: string) => request<PlacesResult>(base, `/search?${new URLSearchParams({ q }).toString()}`),
    reverse: ([lon, lat]: LngLat) =>
      request<PlacesResult>(base, `/reverse?${new URLSearchParams({ lon: String(lon), lat: String(lat) }).toString()}`),
  };
}

export type Api = ReturnType<typeof createApi>;
