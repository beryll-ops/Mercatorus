import type { RouteInfo } from '../types';
import * as turf from '@turf/turf';

async function fetchOsrmProfile(
  profile: 'foot' | 'driving',
  startLng: number,
  startLat: number,
  destLng: number,
  destLat: number,
  timeoutMs = 2500
): Promise<RouteInfo | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `https://router.project-osrm.org/route/v1/${profile}/${startLng},${startLat};${destLng},${destLat}?overview=full&geometries=geojson`;
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;

    const data = await response.json();
    if (data.code !== 'Ok' || !data.routes || !data.routes.length) {
      return null;
    }

    const route = data.routes[0];
    // GeoJSON route coordinates are [lng, lat] -> Leaflet requires [lat, lng]
    const leafletCoords: [number, number][] = route.geometry.coordinates.map(
      (coord: [number, number]) => [coord[1], coord[0]]
    );

    const distanceMeters = Math.round(route.distance);
    // Publiczny serwer router.project-osrm.org zwraca czas jazdy samochodem (np. 5 min dla 2 km, 7 h dla 700 km).
    // Prawdziwy czas marszu pieszego wyliczamy ściśle z prędkości chodu (~1.25 m/s lub 4.5 km/h).
    const walkingDurationSeconds = Math.round(distanceMeters / 1.25);
    const drivingDurationSeconds = Math.round(route.duration);

    return {
      coordinates: leafletCoords,
      distanceMeters,
      durationSeconds: walkingDurationSeconds,
      drivingDurationSeconds,
      isFallback: false,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetches routing geometry between start [lng, lat] and destination [lng, lat].
 * Prefers OSRM pedestrian profile (/foot/) and falls back to driving (/driving/).
 * Falls back silently to straight bearing line on any error or timeout.
 */
export async function fetchRoute(
  startLngLat: [number, number], // [lng, lat]
  destLngLat: [number, number]   // [lng, lat]
): Promise<RouteInfo> {
  const [startLng, startLat] = startLngLat;
  const [destLng, destLat] = destLngLat;

  // Fallback straight-line calculation
  const straightDistanceMeters = Math.round(
    turf.distance(turf.point(startLngLat), turf.point(destLngLat), { units: 'meters' })
  );
  // Estimate ~4.5 km/h (~1.25 m/s) walking time for fallback
  const estimatedWalkingDuration = Math.round(straightDistanceMeters / 1.25);
  // Estimate ~50 km/h (~13.8 m/s) driving time for fallback (min 60s)
  const estimatedDrivingDuration = Math.max(60, Math.round(straightDistanceMeters / 13.8));

  const fallbackRoute: RouteInfo = {
    coordinates: [
      [startLat, startLng],
      [destLat, destLng],
    ],
    distanceMeters: straightDistanceMeters,
    durationSeconds: estimatedWalkingDuration,
    drivingDurationSeconds: estimatedDrivingDuration,
    isFallback: true,
  };

  // If distance is very tiny (< 5m), straight line is already exact
  if (straightDistanceMeters < 5) {
    return {
      ...fallbackRoute,
      isFallback: false,
    };
  }

  try {
    // 1. Try pedestrian profile (/foot/) first with independent 2500ms timeout
    const footRoute = await fetchOsrmProfile('foot', startLng, startLat, destLng, destLat, 2500);
    if (footRoute) {
      return footRoute;
    }

    // 2. Fallback to driving profile (/driving/) with fresh independent 2500ms timeout
    const drivingRoute = await fetchOsrmProfile('driving', startLng, startLat, destLng, destLat, 2500);
    if (drivingRoute) {
      return drivingRoute;
    }

    return fallbackRoute;
  } catch {
    // Network error, abort, or parsing error -> silent fallback
    return fallbackRoute;
  }
}

/**
 * Builds standard Google Maps Universal URL to navigate to destination.
 */
export function getGoogleMapsUrl(lat: number, lng: number, mode: 'walking' | 'driving' = 'walking'): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat.toFixed(6)},${lng.toFixed(6)}&travelmode=${mode}`;
}
