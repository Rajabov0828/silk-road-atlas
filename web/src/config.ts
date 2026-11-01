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
  caravanserai: { label: 'Caravanserais', color: '#2563eb', icon: '🐫' },
  madrasa: { label: 'Madrasas', color: '#0284c7', icon: '📜' },
  mosque: { label: 'Mosques', color: '#059669', icon: '🕌' },
  mausoleum: { label: 'Mausoleums', color: '#7c3aed', icon: '🏛️' },
  fortress: { label: 'Fortresses & ruins', color: '#dc2626', icon: '🏰' },
  archaeology: { label: 'Archaeology', color: '#0d9488', icon: '⛏️' },
  museum: { label: 'Museums', color: '#db2777', icon: '🖼️' },
  monument: { label: 'Monuments', color: '#475569', icon: '🗿' },
  attraction: { label: 'Attractions', color: '#4f46e5', icon: '⭐' },
};

export const UZ_BOUNDS: [[number, number], [number, number]] = [
  [55.9, 37.1],
  [73.2, 45.6],
];
