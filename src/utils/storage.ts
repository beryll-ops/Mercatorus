import type { TerritoryCollection, TerritoryFeature } from '../types';

/**
 * Loads territories directly from synchronized public/data/territories.geojson.
 */
export async function loadTerritories(): Promise<{
  collection: TerritoryCollection;
}> {
  // Clear any legacy custom territories from old versions
  try {
    localStorage.removeItem('mercatorus_custom_territories');
  } catch {
    // ignore
  }

  // Load from static file (handling any Vite base URL with resilient fallbacks and cache-busting)
  const base = import.meta.env.BASE_URL || '/';
  const timestamp = Date.now();
  const primaryUrl = `${base.endsWith('/') ? base : base + '/'}data/territories.geojson?v=${timestamp}`;
  const candidateUrls: string[] = [
    primaryUrl,
    `./data/territories.geojson?v=${timestamp}`,
    `data/territories.geojson?v=${timestamp}`,
  ];

  for (const url of candidateUrls) {
    try {
      const res = await fetch(url, { cache: 'no-cache' });
      if (res.ok) {
        const data = (await res.json()) as TerritoryCollection;
        if (data && Array.isArray(data.features)) {
          return { collection: data };
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
  };
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
