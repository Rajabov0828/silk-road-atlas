import type { Category } from './types';

export interface AppConfig {
  region: string;
  mapsApiKey: string | null;
  apiBase: string;
}

export function loadConfig(env: Record<string, string | undefined> = import.meta.env): AppConfig {
  const key = env.VITE_LOCATION_API_KEY?.trim();
  return {
    region: env.VITE_AWS_REGION?.trim() || 'us-east-1',
    mapsApiKey: key ? key : null,
    apiBase: (env.VITE_API_BASE?.trim() || '/api').replace(/\/$/, ''),
  };
}

/** Amazon Location Service (Maps v2) style descriptor URL. */
export function amazonStyleUrl(cfg: AppConfig, style: 'Standard' | 'Monochrome' | 'Hybrid' | 'Satellite', dark: boolean): string | null {
  if (!cfg.mapsApiKey) return null;
  const params = new URLSearchParams({ key: cfg.mapsApiKey });
  if (style === 'Standard' || style === 'Monochrome') params.set('color-scheme', dark ? 'Dark' : 'Light');
  return `https://maps.geo.${cfg.region}.amazonaws.com/v2/styles/${style}/descriptor?${params.toString()}`;
}

export const CATEGORY_META: Record<Category, { label: string; color: string; icon: string }> = {
  caravanserai: { label: 'Caravanserais', color: '#f59e0b', icon: '🐫' },
  madrasa: { label: 'Madrasas', color: '#38bdf8', icon: '📜' },
  mosque: { label: 'Mosques', color: '#22c55e', icon: '🕌' },
  mausoleum: { label: 'Mausoleums', color: '#a78bfa', icon: '🏛️' },
  fortress: { label: 'Fortresses & ruins', color: '#ef4444', icon: '🏰' },
  archaeology: { label: 'Archaeology', color: '#d97706', icon: '⛏️' },
  museum: { label: 'Museums', color: '#ec4899', icon: '🖼️' },
  monument: { label: 'Monuments', color: '#94a3b8', icon: '🗿' },
  attraction: { label: 'Attractions', color: '#14b8a6', icon: '⭐' },
};

export const UZ_BOUNDS: [[number, number], [number, number]] = [
  [55.9, 37.1],
  [73.2, 45.6],
];
