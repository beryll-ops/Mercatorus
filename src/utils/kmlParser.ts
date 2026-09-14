import { kml as parseKmlToGeojson } from '@tmcw/togeojson';
import JSZip from 'jszip';
import type { TerritoryCollection, TerritoryFeature } from '../types';
import type { Polygon, MultiPolygon } from 'geojson';

/**
 * Normalizes KML style colors to standard CSS 6-digit hex format (#rrggbb).
 * KML colors are often specified in 'aabbggrr' format.
 */
export function normalizeKmlColor(color: unknown): string {
  if (!color || typeof color !== 'string') return '#2563eb';
  const clean = color.trim().replace(/^#/, '');

  // 6-digit hex (#rrggbb)
  if (/^[0-9a-fA-F]{6}$/.test(clean)) {
    return `#${clean.toLowerCase()}`;
  }

  // 8-digit KML hex (aabbggrr -> rrggbb)
  if (/^[0-9a-fA-F]{8}$/.test(clean)) {
    const bb = clean.substring(2, 4);
    const gg = clean.substring(4, 6);
    const rr = clean.substring(6, 8);
    return `#${rr}${gg}${bb}`.toLowerCase();
  }

  // 3-digit hex (#rgb -> #rrggbb)
  if (/^[0-9a-fA-F]{3}$/.test(clean)) {
    const r = clean[0];
    const g = clean[1];
    const b = clean[2];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }

  return color;
}

/**
 * Extracts KML string from either a KML or KMZ file/blob
 */
export async function extractKmlText(file: File | Blob, fileName?: string): Promise<string> {
  const name = 'name' in file ? (file as File).name : (fileName || '');
  const type = 'type' in file ? (file as File).type : '';
  const isKmz =
    name.toLowerCase().endsWith('.kmz') ||
    type.includes('kmz') ||
    type.includes('zip');

  if (isKmz) {
    try {
      const zip = await JSZip.loadAsync(file);
      // Find the main .kml file inside the KMZ archive
      const kmlFile = Object.values(zip.files).find(
        (f) => !f.dir && f.name.toLowerCase().endsWith('.kml')
      );
      if (kmlFile) {
        return await kmlFile.async('string');
      }
    } catch {
      // If zip reading fails, try reading as text below
    }
  }

  // Otherwise, read directly as text
  return await file.text();
}

/**
 * Parses KML text into standard Mercatorus TerritoryCollection (GeoJSON)
 */
export function parseKmlToTerritories(kmlText: string): TerritoryCollection {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(kmlText, 'text/xml');

  // Check for XML parse errors
  const parseError = xmlDoc.querySelector('parsererror');
  if (parseError) {
    throw new Error('Błąd parsowania pliku KML/XML: ' + parseError.textContent);
  }

  const rawGeoJson = parseKmlToGeojson(xmlDoc);

  const territoryFeatures: TerritoryFeature[] = [];
  const usedIds = new Set<string>();

  let idx = 1;
  for (const feature of rawGeoJson.features) {
    if (!feature.geometry) continue;

    let geometry = feature.geometry;
    // Extract polygon if wrapped in GeometryCollection
    if (geometry.type === 'GeometryCollection' && Array.isArray((geometry as { geometries: unknown[] }).geometries)) {
      const poly = (geometry as { geometries: { type: string }[] }).geometries.find(
        (g) => g.type === 'Polygon' || g.type === 'MultiPolygon'
      );
      if (poly) {
        geometry = poly as Polygon | MultiPolygon;
      }
    }

    // We only care about Polygons and MultiPolygons for territory boundaries
    if (
      geometry.type !== 'Polygon' &&
      geometry.type !== 'MultiPolygon'
    ) {
      continue;
    }

    const props = feature.properties || {};
    const rawName = props.name ? String(props.name).trim() : `Teren ${idx}`;
    
    // Extract ID: prefer existing id, or match numbers in name, or fallback to sequential idx
    let id = String(feature.id || props.id || '').trim();
    if (!id) {
      const match = rawName.match(/\d+/);
      id = match ? match[0] : String(idx);
    }

    // Disambiguate duplicate IDs
    if (usedIds.has(id)) {
      id = `${id}-${idx}`;
    }
    usedIds.add(id);

    // Color extraction from KML styles if present
    const rawColor = props.stroke || props.fill || props['fill-color'] || props.color;
    const color = normalizeKmlColor(rawColor);

    const territory: TerritoryFeature = {
      type: 'Feature',
      id: id,
      properties: {
        id: id,
        name: rawName,
        number: id,
        description: props.description ? String(props.description).trim() : undefined,
        color,
      },
      geometry: geometry as TerritoryFeature['geometry'],
    };

    territoryFeatures.push(territory);
    idx++;
  }

  if (territoryFeatures.length === 0) {
    throw new Error('Plik nie zawiera żadnych obszarów typu Polygon lub MultiPolygon.');
  }

  return {
    type: 'FeatureCollection',
    features: territoryFeatures,
  };
}
