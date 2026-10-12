import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';
import { kml as parseKmlToGeojson } from '@tmcw/togeojson';
import * as turf from '@turf/turf';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const GEOJSON_PATH = path.join(rootDir, 'public', 'data', 'territories.geojson');
const CONFIG_PATH = path.join(rootDir, 'config', 'map-source.json');

/**
 * Normalizes KML 8-digit hex color (aabbggrr) to CSS 6-digit hex (#rrggbb)
 */
function normalizeKmlColor(color) {
  if (!color || typeof color !== 'string') return '#2563eb';
  const clean = color.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{6}$/.test(clean)) return `#${clean.toLowerCase()}`;
  if (/^[0-9a-fA-F]{8}$/.test(clean)) {
    const bb = clean.substring(2, 4);
    const gg = clean.substring(4, 6);
    const rr = clean.substring(6, 8);
    return `#${rr}${gg}${bb}`.toLowerCase();
  }
  return color;
}

/**
 * Extracts canonical territory ID from name or properties
 */
function extractCanonicalId(rawName, props, index) {
  // Check explicit property
  const explicit = props.id || props.number || props.numer || props.kod;
  if (explicit && String(explicit).trim()) {
    return String(explicit).trim().toUpperCase();
  }

  // Look for leading territory number like "88-1", "12A", "NR 5", "Teren 119/1"
  const prefixMatch = rawName.match(/^(?:nr\.?|no\.?|teren|obszar)?\s*([0-9]+(?:[-_/][0-9a-zA-Z]+|[a-zA-Z])?)\b/i);
  if (prefixMatch && prefixMatch[1]) {
    return prefixMatch[1].replace(/[/_]/g, '-').toUpperCase();
  }

  // Fallback to any standalone number or sub-territory code in string
  const generalMatch = rawName.match(/\b([0-9]+(?:[-_/][0-9a-zA-Z]+|[a-zA-Z])?)\b/);
  if (generalMatch && generalMatch[1]) {
    return generalMatch[1].replace(/[/_]/g, '-').toUpperCase();
  }

  return String(index);
}

/**
 * Resolves Google Map ID from argv, env, or config file
 */
function resolveMapId() {
  const argId = process.argv[2];
  if (argId && argId.trim()) return argId.trim();

  if (process.env.GOOGLE_MAP_ID && process.env.GOOGLE_MAP_ID.trim()) {
    return process.env.GOOGLE_MAP_ID.trim();
  }

  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const conf = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      if (conf.googleMapId && conf.googleMapId.trim()) {
        return conf.googleMapId.trim();
      }
    } catch {
      // ignore config read error
    }
  }

  return null;
}

/**
 * Main Sync Pipeline
 */
async function syncGoogleMap() {
  console.log('=== MERCATORUS: GOOGLE MY MAPS AUTO-SYNC PIPELINE ===');

  const mapId = resolveMapId();
  if (!mapId) {
    console.error('\n[BŁĄD] Brak identyfikatora mapy Google My Maps!');
    console.error('Ustaw GOOGLE_MAP_ID jako argument, zmienną środowiskową lub w pliku config/map-source.json.');
    console.error('Przykład: node scripts/sync-google-map.mjs 1AbCdEfGhIjKlMnOpQrStUvWxYz');
    process.exit(1);
  }

  const exportUrl = `https://www.google.com/maps/d/kml?mid=${encodeURIComponent(mapId)}&forcekml=1`;
  console.log(`Pobieranie KML z Google My Maps: ${exportUrl}`);

  let kmlText = '';
  try {
    const res = await fetch(exportUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MercatorusSyncBot/1.0)',
      },
    });

    if (!res.ok) {
      throw new Error(`Serwer Google zwrócił status HTTP ${res.status} (${res.statusText})`);
    }

    kmlText = await res.text();
  } catch (err) {
    console.error('\n[BŁĄD SIECIOWY] Nie udało się pobrać pliku KML z Google My Maps:', err.message);
    process.exit(1);
  }

  // Detect if Google returned an HTML login page or error instead of KML
  if (kmlText.includes('<!DOCTYPE html>') || kmlText.includes('<html') || kmlText.includes('accounts.google.com')) {
    console.error('\n[BŁĄD UPRAWNIEŃ] Google zwróciło stronę logowania zamiast pliku KML!');
    console.error('Upewnij się, że w opcjach udostępniania mapy Google My Maps wybrano:');
    console.error('"Każdy mający link może wyświetlać" (wersja publiczna).');
    process.exit(1);
  }

  // Parse KML XML
  const dom = new JSDOM(kmlText, { contentType: 'text/xml' });
  const xmlDoc = dom.window.document;
  const rawGeoJson = parseKmlToGeojson(xmlDoc);

  if (!rawGeoJson || !Array.isArray(rawGeoJson.features) || rawGeoJson.features.length === 0) {
    console.error('\n[BŁĄD] Parsowanie KML powiodło się, ale nie znaleziono żadnych obiektów w pliku!');
    process.exit(1);
  }

  console.log(`Znaleziono ${rawGeoJson.features.length} obiektów w pobranym pliku KML.`);

  // Load existing GeoJSON to preserve IDs and aliases
  let existingCollection = { type: 'FeatureCollection', features: [] };
  if (fs.existsSync(GEOJSON_PATH)) {
    try {
      existingCollection = JSON.parse(fs.readFileSync(GEOJSON_PATH, 'utf8'));
    } catch (e) {
      console.warn('Ostrzeżenie: Nie udało się odczytać dotychczasowego pliku territories.geojson:', e.message);
    }
  }

  const existingFeatures = existingCollection.features || [];
  console.log(`Dotychczasowa baza zawiera ${existingFeatures.length} terenów.`);

  // Build lookup of existing features with geometry centroids for geometric locking
  const existingLookup = existingFeatures.map((feat) => {
    let centroid = null;
    let bbox = null;
    try {
      centroid = turf.centroid(feat);
      bbox = turf.bbox(feat);
    } catch {
      // ignore geometry error
    }
    return {
      id: String(feat.id || feat.properties?.id || '').trim(),
      number: String(feat.properties?.number || '').trim(),
      name: String(feat.properties?.name || '').trim(),
      aliases: Array.isArray(feat.properties?.aliases) ? feat.properties.aliases : [],
      centroid,
      bbox,
      feature: feat,
    };
  });

  const parsedFeatures = [];
  const usedIds = new Set();
  let lockedByIdCount = 0;
  let lockedByGeometryCount = 0;
  let newTerritoriesCount = 0;

  let idx = 1;
  for (const rawFeat of rawGeoJson.features) {
    if (!rawFeat.geometry) continue;

    let geometry = rawFeat.geometry;
    if (geometry.type === 'GeometryCollection' && Array.isArray(geometry.geometries)) {
      const poly = geometry.geometries.find((g) => g.type === 'Polygon' || g.type === 'MultiPolygon');
      if (poly) geometry = poly;
    }

    if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') {
      continue;
    }

    const props = rawFeat.properties || {};
    const rawName = props.name ? String(props.name).trim() : `Teren ${idx}`;
    const candidateId = extractCanonicalId(rawName, props, idx);

    let centroid = null;
    try {
      centroid = turf.centroid(rawFeat);
    } catch {
      // ignore
    }

    // 1. Try matching with existing territory by ID or alias
    let matchedExisting = existingLookup.find(
      (e) => e.id === candidateId || e.number === candidateId || e.aliases.includes(candidateId)
    );

    let finalId = candidateId;
    let accumulatedAliases = [];

    if (matchedExisting) {
      finalId = matchedExisting.id;
      accumulatedAliases = [...matchedExisting.aliases];
      if (candidateId !== finalId && !accumulatedAliases.includes(candidateId)) {
        accumulatedAliases.push(candidateId);
      }
      lockedByIdCount++;
    } else if (centroid) {
      // 2. Geometric match: check if a territory closely overlaps an existing one
      // (prevents ID loss if coordinator renamed the territory in Google My Maps without number)
      const geoMatch = existingLookup.find((e) => {
        if (!e.centroid) return false;
        const distMeters = turf.distance(centroid, e.centroid, { units: 'meters' });
        return distMeters < 75; // centroid within 75m
      });

      if (geoMatch) {
        console.log(`[GEOMETRIC LOCK] Teren "${rawName}" dopasowano geometrycznie do istniejącego ID "${geoMatch.id}" (${geoMatch.name})`);
        finalId = geoMatch.id;
        accumulatedAliases = [...geoMatch.aliases];
        if (candidateId !== finalId && !accumulatedAliases.includes(candidateId)) {
          accumulatedAliases.push(candidateId);
        }
        lockedByGeometryCount++;
      } else {
        newTerritoriesCount++;
      }
    } else {
      newTerritoriesCount++;
    }

    // Disambiguate duplicate IDs if needed while saving original as alias
    if (usedIds.has(finalId)) {
      accumulatedAliases.push(finalId);
      finalId = `${finalId}-${idx}`;
    }
    usedIds.add(finalId);

    const rawColor = props.stroke || props.fill || props['fill-color'] || props.color;
    const color = normalizeKmlColor(rawColor);

    const territory = {
      type: 'Feature',
      id: finalId,
      properties: {
        id: finalId,
        name: rawName,
        number: candidateId,
        description: props.description ? String(props.description).trim() : undefined,
        color,
        aliases: accumulatedAliases.length > 0 ? Array.from(new Set(accumulatedAliases)) : undefined,
      },
      geometry,
    };

    parsedFeatures.push(territory);
    idx++;
  }

  if (parsedFeatures.length === 0) {
    console.error('\n[BŁĄD] W pliku KML nie znaleziono żadnych wielokątów typu Polygon ani MultiPolygon!');
    process.exit(1);
  }

  const updatedCollection = {
    type: 'FeatureCollection',
    features: parsedFeatures,
  };

  const jsonContent = JSON.stringify(updatedCollection, null, 2);

  // Check if content actually changed
  let hasChanged = true;
  if (fs.existsSync(GEOJSON_PATH)) {
    const existingContent = fs.readFileSync(GEOJSON_PATH, 'utf8');
    if (existingContent === jsonContent) {
      hasChanged = false;
    }
  }

  if (hasChanged) {
    fs.writeFileSync(GEOJSON_PATH, jsonContent, 'utf8');
    console.log(`\n[SUKCES] Zapisano ${parsedFeatures.length} terenów do pliku public/data/territories.geojson`);
    console.log(`- Zablokowane po ID: ${lockedByIdCount}`);
    console.log(`- Zablokowane po geometrii: ${lockedByGeometryCount}`);
    console.log(`- Nowe tereny: ${newTerritoriesCount}`);
  } else {
    console.log('\n[INFO] Brak zmian w danych mapy. Plik territories.geojson jest już aktualny.');
  }

  console.log('Synchronizacja zakończona pomyślnie.');
}

syncGoogleMap().catch((err) => {
  console.error('Nieobsługiwany błąd podczas synchronizacji:', err);
  process.exit(1);
});
