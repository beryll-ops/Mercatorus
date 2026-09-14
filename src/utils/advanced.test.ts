// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { fetchRoute } from './osrm';
import { extractKmlText, parseKmlToTerritories } from './kmlParser';
import { calculateBoundaryDistance } from './turfUtils';
import type { TerritoryFeature } from '../types';
import JSZip from 'jszip';

describe('OSRM Routing & Silent Fallback', () => {
  it('falls back silently to straight bearing line when fetch fails', async () => {
    // Mock global fetch to fail (network error / offline)
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));

    const start: [number, number] = [19.930, 50.060];
    const end: [number, number] = [19.940, 50.070];

    const route = await fetchRoute(start, end);

    expect(route.isFallback).toBe(true);
    expect(route.coordinates).toHaveLength(2);
    // Leaflet coordinates should be [lat, lng]
    expect(route.coordinates[0]).toEqual([50.060, 19.930]);
    expect(route.coordinates[1]).toEqual([50.070, 19.940]);
    expect(route.distanceMeters).toBeGreaterThan(0);
    expect(route.durationSeconds).toBeGreaterThan(0);

    global.fetch = originalFetch;
  });

  it('falls back silently when API returns non-200 or invalid code', async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    const start: [number, number] = [19.930, 50.060];
    const end: [number, number] = [19.940, 50.070];

    const route = await fetchRoute(start, end);

    expect(route.isFallback).toBe(true);
    expect(route.coordinates).toHaveLength(2);

    global.fetch = originalFetch;
  });

  it('queries foot profile first and uses pedestrian duration when foot succeeds', async () => {
    const originalFetch = global.fetch;
    const fetchCalls: string[] = [];

    global.fetch = vi.fn().mockImplementation((url: string) => {
      fetchCalls.push(url);
      if (url.includes('/foot/')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            code: 'Ok',
            routes: [
              {
                geometry: {
                  coordinates: [
                    [19.930, 50.060],
                    [19.940, 50.070],
                  ],
                },
                distance: 1200,
                duration: 960,
              },
            ],
          }),
        } as Response);
      }
      return Promise.reject(new Error('Should not call driving when foot succeeds'));
    });

    const start: [number, number] = [19.930, 50.060];
    const end: [number, number] = [19.940, 50.070];

    const route = await fetchRoute(start, end);

    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0]).toContain('/foot/');
    expect(route.isFallback).toBe(false);
    expect(route.distanceMeters).toBe(1200);
    expect(route.durationSeconds).toBe(960);

    global.fetch = originalFetch;
  });

  it('queries foot profile first and falls back to driving profile with walking duration when foot fails', async () => {
    const originalFetch = global.fetch;
    const fetchCalls: string[] = [];

    global.fetch = vi.fn().mockImplementation((url: string) => {
      fetchCalls.push(url);
      if (url.includes('/foot/')) {
        // Foot profile fails (e.g., 404 or unsupported on demo server)
        return Promise.resolve({
          ok: false,
          status: 404,
        } as Response);
      }
      if (url.includes('/driving/')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            code: 'Ok',
            routes: [
              {
                geometry: {
                  coordinates: [
                    [19.930, 50.060],
                    [19.935, 50.065],
                    [19.940, 50.070],
                  ],
                },
                distance: 1450,
                duration: 120, // Car driving time ~2 mins
              },
            ],
          }),
        } as Response);
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    const start: [number, number] = [19.930, 50.060];
    const end: [number, number] = [19.940, 50.070];

    const route = await fetchRoute(start, end);

    expect(fetchCalls).toHaveLength(2);
    expect(fetchCalls[0]).toContain('/foot/');
    expect(fetchCalls[1]).toContain('/driving/');
    expect(route.isFallback).toBe(false);
    expect(route.distanceMeters).toBe(1450);
    // Driving duration should be converted to walking speed (~1.25 m/s): 1450 / 1.25 = 1160s (~19 mins)
    expect(route.durationSeconds).toBe(1160);
    expect(route.coordinates).toEqual([
      [50.060, 19.930],
      [50.065, 19.935],
      [50.070, 19.940],
    ]);

    global.fetch = originalFetch;
  });

  it('attempts driving profile even if foot profile request rejects or aborts', async () => {
    const originalFetch = global.fetch;
    const fetchCalls: string[] = [];

    global.fetch = vi.fn().mockImplementation((url: string) => {
      fetchCalls.push(url);
      if (url.includes('/foot/')) {
        const err = new Error('The user aborted a request.');
        err.name = 'AbortError';
        return Promise.reject(err);
      }
      if (url.includes('/driving/')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            code: 'Ok',
            routes: [
              {
                geometry: {
                  coordinates: [
                    [19.930, 50.060],
                    [19.940, 50.070],
                  ],
                },
                distance: 1000,
                duration: 90,
              },
            ],
          }),
        } as Response);
      }
      return Promise.reject(new Error('Unknown'));
    });

    const route = await fetchRoute([19.930, 50.060], [19.940, 50.070]);
    expect(fetchCalls).toHaveLength(2);
    expect(fetchCalls[1]).toContain('/driving/');
    expect(route.isFallback).toBe(false);
    expect(route.distanceMeters).toBe(1000);
    expect(route.durationSeconds).toBe(800); // 1000 / 1.25

    global.fetch = originalFetch;
  });
});

describe('KMZ Archive Extraction & Parsing', () => {
  it('extracts and parses doc.kml from a valid KMZ zip file', async () => {
    const sampleKml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>KMZ Teren 42</name>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>
              19.93,50.06,0
              19.94,50.06,0
              19.94,50.07,0
              19.93,50.06,0
            </coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
  </Document>
</kml>`;

    const zip = new JSZip();
    zip.file('doc.kml', sampleKml);
    const blob = await zip.generateAsync({ type: 'blob' });
    const kmzFile = new File([blob], 'terytorium.kmz', {
      type: 'application/vnd.google-earth.kmz',
    });

    const extractedText = await extractKmlText(kmzFile);
    expect(extractedText).toContain('<name>KMZ Teren 42</name>');

    const collection = parseKmlToTerritories(extractedText);
    expect(collection.features.length).toBe(1);
    expect(collection.features[0].properties.id).toBe('42');
    expect(collection.features[0].properties.name).toBe('KMZ Teren 42');
  });
});

describe('MultiPolygon and Complex Geometry Support', () => {
  it('correctly handles MultiPolygon geometries and nearest point on any ring', () => {
    const multiPolygonTerritory: TerritoryFeature = {
      type: 'Feature',
      id: 'multi-1',
      properties: {
        id: 'multi-1',
        name: 'Teren Dwuobszarowy',
      },
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          // Polygon A: around lat 50.060
          [
            [
              [19.92, 50.05],
              [19.93, 50.05],
              [19.93, 50.06],
              [19.92, 50.06],
              [19.92, 50.05],
            ],
          ],
          // Polygon B: around lat 50.080
          [
            [
              [19.92, 50.08],
              [19.93, 50.08],
              [19.93, 50.09],
              [19.92, 50.09],
              [19.92, 50.08],
            ],
          ],
        ],
      },
    };

    // User inside Polygon A
    const resInside = calculateBoundaryDistance([19.925, 50.055], multiPolygonTerritory);
    expect(resInside.isInside).toBe(true);
    expect(resInside.distanceMeters).toBe(0);

    // User outside both, closer to Polygon B (at lat 50.085, lng 19.925)
    const resOutsideNearB = calculateBoundaryDistance([19.925, 50.092], multiPolygonTerritory);
    expect(resOutsideNearB.isInside).toBe(false);
    expect(resOutsideNearB.distanceMeters).toBeGreaterThan(0);
    // Nearest point must be on top edge of Polygon B (~50.090)
    expect(resOutsideNearB.nearestPoint[1]).toBeCloseTo(50.090, 3);
  });

  it('correctly calculates distance for a Polygon with an inner hole', () => {
    // 100m outer square with a 20m hole inside
    const polygonWithHole: TerritoryFeature = {
      type: 'Feature',
      id: 'donut-1',
      properties: {
        id: 'donut-1',
        name: 'Teren z Wewnętrznym Wycięciem',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          // Outer boundary
          [
            [19.920, 50.050],
            [19.940, 50.050],
            [19.940, 50.070],
            [19.920, 50.070],
            [19.920, 50.050],
          ],
          // Hole in the middle
          [
            [19.928, 50.058],
            [19.932, 50.058],
            [19.932, 50.062],
            [19.928, 50.062],
            [19.928, 50.058],
          ],
        ],
      },
    };

    // Outside the hole, inside the solid polygon
    const resSolid = calculateBoundaryDistance([19.925, 50.055], polygonWithHole);
    expect(resSolid.isInside).toBe(true);
    expect(resSolid.distanceMeters).toBe(0);

    // Inside the hole (so mathematically outside the polygon territory)
    const resInHole = calculateBoundaryDistance([19.930, 50.060], polygonWithHole);
    expect(resInHole.isInside).toBe(false);
    expect(resInHole.distanceMeters).toBeGreaterThan(0);
  });
});

describe('KML GeometryCollection Placemark Support', () => {
  it('extracts polygon from KML placemark wrapped in GeometryCollection', () => {
    const kmlWithCollection = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>Teren z Kolekcją Geometrii</name>
      <MultiGeometry>
        <Point>
          <coordinates>19.93,50.06,0</coordinates>
        </Point>
        <Polygon>
          <outerBoundaryIs>
            <LinearRing>
              <coordinates>19.92,50.05,0 19.94,50.05,0 19.94,50.07,0 19.92,50.07,0 19.92,50.05,0</coordinates>
            </LinearRing>
          </outerBoundaryIs>
        </Polygon>
      </MultiGeometry>
    </Placemark>
  </Document>
</kml>`;

    const collection = parseKmlToTerritories(kmlWithCollection);
    expect(collection.features.length).toBe(1);
    expect(collection.features[0].geometry.type).toBe('Polygon');
    expect(collection.features[0].properties.name).toBe('Teren z Kolekcją Geometrii');
  });
});
