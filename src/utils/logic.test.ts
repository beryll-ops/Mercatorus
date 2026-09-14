// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { calculateBoundaryDistance, getTerritoryCentroid, getTerritoryInteriorPoint } from './turfUtils';
import { parseKmlToTerritories, normalizeKmlColor } from './kmlParser';
import { findTerritoryById } from './storage';
import { getGoogleMapsUrl } from './osrm';
import type { TerritoryFeature, TerritoryCollection } from '../types';
import * as turf from '@turf/turf';

// Sample polygon: a 100m x 100m box around Kraków center
// Center roughly [19.935, 50.060]
const sampleTerritory: TerritoryFeature = {
  type: 'Feature',
  id: '1',
  properties: {
    id: '1',
    number: '01',
    name: 'Teren Testowy',
    city: 'Kraków',
  },
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [19.930, 50.060],
        [19.940, 50.060],
        [19.940, 50.070],
        [19.930, 50.070],
        [19.930, 50.060],
      ],
    ],
  },
};

const sampleCollection: TerritoryCollection = {
  type: 'FeatureCollection',
  features: [sampleTerritory],
};

describe('Turf Boundary Distance Calculation', () => {
  it('identifies point inside polygon with 0 distance', () => {
    // Inside the box: [19.935, 50.065]
    const res = calculateBoundaryDistance([19.935, 50.065], sampleTerritory);
    expect(res.isInside).toBe(true);
    expect(res.distanceMeters).toBe(0);
  });

  it('calculates distance strictly to the boundary edge, NOT to the centroid', () => {
    // Centroid of the box is at [19.935, 50.065]
    // Point outside just south of bottom edge: [19.935, 50.059] (~111m south of edge lat 50.060)
    const outsidePoint: [number, number] = [19.935, 50.059];
    const res = calculateBoundaryDistance(outsidePoint, sampleTerritory);

    expect(res.isInside).toBe(false);
    // Distance to edge (50.060 - 50.059 = 0.001 deg lat ~ 111 meters)
    expect(res.distanceMeters).toBeGreaterThan(90);
    expect(res.distanceMeters).toBeLessThan(130);

    // Distance to centroid would be ~50.065 - 50.059 = 0.006 deg lat ~ 660 meters
    const centroid = getTerritoryCentroid(sampleTerritory);
    const distToCentroid = turf.distance(turf.point(outsidePoint), turf.point(centroid), {
      units: 'meters',
    });
    expect(distToCentroid).toBeGreaterThan(600);

    // The boundary distance MUST be significantly less than distance to centroid
    expect(res.distanceMeters).toBeLessThan(distToCentroid - 400);

    // Nearest point must be on the bottom edge (lat 50.060)
    expect(res.nearestPoint[1]).toBeCloseTo(50.060, 4);
    expect(res.nearestPoint[0]).toBeCloseTo(19.935, 4);
  });

  it('safely handles invalid or NaN coordinates without throwing', () => {
    const res = calculateBoundaryDistance([NaN, NaN], sampleTerritory);
    expect(res.isInside).toBe(false);
    expect(res.distanceMeters).toBe(0);
  });

  it('guarantees interior point is strictly inside the polygon', () => {
    const pt = getTerritoryInteriorPoint(sampleTerritory);
    const isInside = turf.booleanPointInPolygon(turf.point(pt), sampleTerritory);
    expect(isInside).toBe(true);
  });
});

describe('Territory Storage and Lookup', () => {
  it('finds territory by exact ID', () => {
    const found = findTerritoryById(sampleCollection, '1');
    expect(found).toBeDefined();
    expect(found?.properties.name).toBe('Teren Testowy');
  });

  it('finds territory by number property', () => {
    const found = findTerritoryById(sampleCollection, '01');
    expect(found).toBeDefined();
    expect(found?.properties.id).toBe('1');
  });

  it('matches numeric equivalent when leading zeros differ', () => {
    const testCollection: TerritoryCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: '07',
          properties: { id: '07', name: 'Teren 07' },
          geometry: sampleTerritory.geometry,
        },
      ],
    };
    // Searching for "7" should find "07"
    const found = findTerritoryById(testCollection, '7');
    expect(found).toBeDefined();
    expect(found?.properties.name).toBe('Teren 07');
  });

  it('returns undefined for non-existent ID', () => {
    const found = findTerritoryById(sampleCollection, '999');
    expect(found).toBeUndefined();
  });
});

describe('Google Maps Deep Link Generator', () => {
  it('creates valid Google Maps Universal URL format with walking travelmode', () => {
    const url = getGoogleMapsUrl(50.061912, 19.936845);
    expect(url).toBe('https://www.google.com/maps/dir/?api=1&destination=50.061912,19.936845&travelmode=walking');
  });
});

describe('KML to GeoJSON Parser', () => {
  it('parses valid KML XML with polygons into TerritoryCollection', () => {
    const kmlXml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Moje Tereny</name>
    <Placemark>
      <name>Teren 10 - Rynek</name>
      <description>Opis terenu nr 10</description>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>
              19.93,50.06,0
              19.94,50.06,0
              19.94,50.07,0
              19.93,50.07,0
              19.93,50.06,0
            </coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
  </Document>
</kml>`;

    const parsed = parseKmlToTerritories(kmlXml);
    expect(parsed.features.length).toBe(1);
    expect(parsed.features[0].properties.name).toBe('Teren 10 - Rynek');
    expect(parsed.features[0].properties.id).toBe('10');
    expect(parsed.features[0].properties.description).toBe('Opis terenu nr 10');
    expect(parsed.features[0].geometry.type).toBe('Polygon');
  });

  it('disambiguates duplicate IDs from KML placemarks', () => {
    const kmlWithDuplicates = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>Teren 5 - Sektor A</name>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>19.93,50.06,0 19.94,50.06,0 19.94,50.07,0 19.93,50.06,0</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
    <Placemark>
      <name>Teren 5 - Sektor B</name>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>19.95,50.06,0 19.96,50.06,0 19.96,50.07,0 19.95,50.06,0</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
  </Document>
</kml>`;

    const parsed = parseKmlToTerritories(kmlWithDuplicates);
    expect(parsed.features.length).toBe(2);
    expect(parsed.features[0].properties.id).toBe('5');
    expect(parsed.features[1].properties.id).toBe('5-2');
  });

  it('normalizes 8-digit KML hex colors to standard 6-digit hex', () => {
    // KML format aabbggrr: ff0000ff -> rr=ff, gg=00, bb=00 -> #ff0000 (red)
    expect(normalizeKmlColor('ff0000ff')).toBe('#ff0000');
    // Standard #rrggbb
    expect(normalizeKmlColor('#2563eb')).toBe('#2563eb');
  });

  it('throws helpful error on malformed XML or empty polygons', () => {
    const emptyKml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Brak Poligonów</name>
    <Placemark>
      <name>Tylko Punkt</name>
      <Point><coordinates>19.93,50.06,0</coordinates></Point>
    </Placemark>
  </Document>
</kml>`;

    expect(() => parseKmlToTerritories(emptyKml)).toThrow('Plik nie zawiera żadnych obszarów');
  });
});
