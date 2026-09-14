import type { TerritoryCollection, TerritoryFeature } from '../types';

const STORAGE_KEY = 'mercatorus_custom_territories';

/**
 * Loads territories: first checks localStorage for custom imported ones,
 * otherwise fetches default from public/data/territories.geojson.
 */
export async function loadTerritories(): Promise<{
  collection: TerritoryCollection;
  isCustom: boolean;
}> {
  // Check localStorage
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved) as TerritoryCollection;
      if (parsed.type === 'FeatureCollection' && Array.isArray(parsed.features) && parsed.features.length > 0) {
        return { collection: parsed, isCustom: true };
      }
    } catch (e) {
      console.warn('Failed to parse cached territories from localStorage', e);
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  // Load from static file (handling any Vite base URL)
  try {
    const metaEnv = (import.meta as unknown as { env?: { BASE_URL?: string } })?.env;
    const basePath = metaEnv?.BASE_URL || '/';
    const jsonUrl = `${basePath.endsWith('/') ? basePath : basePath + '/'}data/territories.geojson`;
    const res = await fetch(jsonUrl);
    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }
    const data = (await res.json()) as TerritoryCollection;
    return { collection: data, isCustom: false };
  } catch (err) {
    console.error('Failed to load default territories.geojson', err);
    return {
      collection: {
        type: 'FeatureCollection',
        features: [],
      },
      isCustom: false,
    };
  }
}

/**
 * Saves custom imported territories to localStorage
 */
export function saveCustomTerritories(collection: TerritoryCollection): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(collection));
}

/**
 * Clears custom imported territories and reverts to default
 */
export function resetToDefaultTerritories(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Finds a territory feature by its ID or number, with case-insensitive
 * matching and numeric equality fallback (e.g. "1" matches "01").
 */
export function findTerritoryById(
  collection: TerritoryCollection,
  id: string
): TerritoryFeature | undefined {
  if (!id) return undefined;
  const normalizedId = id.trim().toLowerCase();
  const numId = parseInt(normalizedId, 10);
  const isNumeric = !isNaN(numId);

  return collection.features.find((f) => {
    const fId = String(f.id ?? '').trim().toLowerCase();
    const pId = String(f.properties?.id ?? '').trim().toLowerCase();
    const pNum = String(f.properties?.number ?? '').trim().toLowerCase();

    if (fId === normalizedId || pId === normalizedId || pNum === normalizedId) {
      return true;
    }

    if (isNumeric) {
      const fNum = parseInt(fId, 10);
      const pIdNum = parseInt(pId, 10);
      const pNumNum = parseInt(pNum, 10);
      if (
        (!isNaN(fNum) && fNum === numId) ||
        (!isNaN(pIdNum) && pIdNum === numId) ||
        (!isNaN(pNumNum) && pNumNum === numId)
      ) {
        return true;
      }
    }

    return false;
  });
}
