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

  // Load from static file (handling any Vite base URL with resilient fallbacks)
  const base = import.meta.env.BASE_URL || '/';
  const primaryUrl = `${base.endsWith('/') ? base : base + '/'}data/territories.geojson`;
  const candidateUrls: string[] = [
    primaryUrl,
    './data/territories.geojson',
    'data/territories.geojson',
  ];

  for (const url of candidateUrls) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = (await res.json()) as TerritoryCollection;
        if (data && Array.isArray(data.features)) {
          return { collection: data, isCustom: false };
        }
      }
    } catch {
      // Try next candidate URL
    }
  }

  console.error('Failed to load default territories.geojson from candidate URLs:', candidateUrls);
  return {
    collection: {
      type: 'FeatureCollection',
      features: [],
    },
    isCustom: false,
  };
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
 * Finds a territory feature by its ID, number, alias, or canonical name prefix,
 * with case-insensitive matching, sub-territory format normalization (e.g. "88/1" matches "88-1"),
 * and strict pure-integer equality (e.g. "01" matches "1", but "88-1" never collides with "88").
 */
export function findTerritoryById(
  collection: TerritoryCollection,
  id: string
): TerritoryFeature | undefined {
  if (!id) return undefined;
  const normalizedId = id.trim().toLowerCase();
  const unifiedId = normalizedId.replace(/[/_]/g, '-');

  // Only perform integer-based equality if input consists PURELY of digits (e.g. "01" == "1")
  // Prevents parseInt("88-1") === 88 from corrupting sub-territory lookups!
  const isPureInteger = /^\d+$/.test(normalizedId);
  const numId = isPureInteger ? parseInt(normalizedId, 10) : null;

  return collection.features.find((f) => {
    const fId = String(f.id ?? '').trim().toLowerCase();
    const pId = String(f.properties?.id ?? '').trim().toLowerCase();
    const pNum = String(f.properties?.number ?? '').trim().toLowerCase();
    const unifiedFId = fId.replace(/[/_]/g, '-');
    const unifiedPId = pId.replace(/[/_]/g, '-');
    const unifiedPNum = pNum.replace(/[/_]/g, '-');

    // 1. Direct or unified ID / number match
    if (
      fId === normalizedId ||
      pId === normalizedId ||
      pNum === normalizedId ||
      unifiedFId === unifiedId ||
      unifiedPId === unifiedId ||
      unifiedPNum === unifiedId
    ) {
      return true;
    }

    // 2. Check aliases list if present
    const aliases = f.properties?.aliases;
    if (Array.isArray(aliases)) {
      const hasAlias = aliases.some((a) => {
        const normA = String(a).trim().toLowerCase();
        return normA === normalizedId || normA.replace(/[/_]/g, '-') === unifiedId;
      });
      if (hasAlias) return true;
    }

    // 3. Strict pure integer comparison (e.g. "01" matches "1")
    if (isPureInteger && numId !== null) {
      const matchPureInt = (val: string) => {
        if (/^\d+$/.test(val)) {
          return parseInt(val, 10) === numId;
        }
        return false;
      };
      if (matchPureInt(fId) || matchPureInt(pId) || matchPureInt(pNum)) {
        return true;
      }
    }

    // 4. Match territory name prefix (e.g. name "88-1 Staromieście" matches id "88-1")
    const rawName = String(f.properties?.name ?? '').trim().toLowerCase();
    const unifiedName = rawName.replace(/[/_]/g, '-');
    if (
      unifiedName.startsWith(unifiedId + ' ') ||
      unifiedName.startsWith(unifiedId + '-') ||
      unifiedName.startsWith(unifiedId + '.') ||
      unifiedName === unifiedId
    ) {
      return true;
    }

    return false;
  });
}
