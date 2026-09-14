import * as turf from '@turf/turf';
import type { Feature, Polygon, MultiPolygon } from 'geojson';
import type { TerritoryFeature, BoundaryDistanceResult } from '../types';

/**
 * Calculates distance from user GPS to territory boundary.
 * Strictly calculates to the polygon boundary (edge), NOT the centroid.
 */
export function calculateBoundaryDistance(
  userLngLat: [number, number], // [lng, lat]
  territory: TerritoryFeature
): BoundaryDistanceResult {
  if (
    !userLngLat ||
    typeof userLngLat[0] !== 'number' ||
    typeof userLngLat[1] !== 'number' ||
    isNaN(userLngLat[0]) ||
    isNaN(userLngLat[1])
  ) {
    return {
      isInside: false,
      distanceMeters: 0,
      nearestPoint: [0, 0],
    };
  }

  try {
    const pt = turf.point(userLngLat);

    // 1. Check if user is inside the polygon
    const isInside = turf.booleanPointInPolygon(
      pt,
      territory as unknown as Feature<Polygon | MultiPolygon>
    );

    // 2. Extract boundaries
    const line = turf.polygonToLine(
      territory as unknown as Feature<Polygon | MultiPolygon>
    );

    let minDistance = Infinity;
    let closestCoord: [number, number] = userLngLat;

    if (line.type === 'FeatureCollection') {
      for (const feat of line.features) {
        const nearest = turf.nearestPointOnLine(feat, pt, { units: 'meters' });
        const d = turf.distance(pt, nearest, { units: 'meters' });
        if (d < minDistance) {
          minDistance = d;
          closestCoord = [nearest.geometry.coordinates[0], nearest.geometry.coordinates[1]];
        }
      }
    } else {
      const nearest = turf.nearestPointOnLine(line, pt, { units: 'meters' });
      minDistance = turf.distance(pt, nearest, { units: 'meters' });
      closestCoord = [nearest.geometry.coordinates[0], nearest.geometry.coordinates[1]];
    }

    if (isInside) {
      return {
        isInside: true,
        distanceMeters: 0,
        nearestPoint: closestCoord,
      };
    }

    return {
      isInside: false,
      distanceMeters: Math.round(minDistance),
      nearestPoint: closestCoord,
    };
  } catch (err) {
    console.error('Error calculating boundary distance:', err);
    return {
      isInside: false,
      distanceMeters: 0,
      nearestPoint: userLngLat,
    };
  }
}

/**
 * Returns Bounding Box [minLng, minLat, maxLng, maxLat]
 */
export function getTerritoryBounds(territory: TerritoryFeature): [number, number, number, number] {
  return turf.bbox(territory) as [number, number, number, number];
}

/**
 * Returns Bounding Box for an entire collection of features
 */
export function getCollectionBounds(features: TerritoryFeature[]): [number, number, number, number] | null {
  if (!features.length) return null;
  const collection = turf.featureCollection(features);
  return turf.bbox(collection) as [number, number, number, number];
}

/**
 * Returns polygon centroid [lng, lat]
 */
export function getTerritoryCentroid(territory: TerritoryFeature): [number, number] {
  try {
    const center = turf.centerOfMass(territory);
    return [center.geometry.coordinates[0], center.geometry.coordinates[1]];
  } catch {
    const bounds = getTerritoryBounds(territory);
    return [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2];
  }
}

/**
 * Returns a point guaranteed to be strictly on/inside the territory feature.
 * Unlike centroid or centerOfMass (which can fall outside concave, horseshoe,
 * or disconnected multi-polygons), pointOnFeature is mathematically guaranteed
 * to be on the polygon surface.
 */
export function getTerritoryInteriorPoint(territory: TerritoryFeature): [number, number] {
  try {
    const pt = turf.pointOnFeature(territory);
    return [pt.geometry.coordinates[0], pt.geometry.coordinates[1]];
  } catch {
    return getTerritoryCentroid(territory);
  }
}
