/**
 * Caravan maths: how long would a camel caravan take compared with a car?
 * Historians commonly estimate a loaded Silk Road caravan covered 25–40 km per day;
 * we use 30 km/day as a midpoint.
 */
export const CARAVAN_KM_PER_DAY = 30;

export function caravanDays(distanceMeters: number, kmPerDay: number = CARAVAN_KM_PER_DAY): number {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) return 0;
  if (kmPerDay <= 0) throw new RangeError('kmPerDay must be positive');
  return Math.max(1, Math.round(distanceMeters / 1000 / kmPerDay));
}

export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return '—';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toLocaleString('en-US', { maximumFractionDigits: meters < 10_000 ? 1 : 0 })} km`;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const totalMinutes = Math.round(seconds / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** How many times faster the car is than the caravan for the same distance. */
export function speedup(distanceMeters: number, durationSeconds: number): number {
  if (durationSeconds <= 0 || distanceMeters <= 0) return 0;
  const caravanSeconds = (distanceMeters / 1000 / CARAVAN_KM_PER_DAY) * 86_400;
  return Math.round(caravanSeconds / durationSeconds);
}
