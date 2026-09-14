import type { Feature, FeatureCollection, Polygon, MultiPolygon } from 'geojson';

export interface TerritoryProperties {
  id: string;
  name: string;
  number?: string;
  description?: string;
  city?: string;
  color?: string;
  [key: string]: unknown;
}

export type TerritoryFeature = Feature<Polygon | MultiPolygon, TerritoryProperties>;

export type TerritoryCollection = FeatureCollection<Polygon | MultiPolygon, TerritoryProperties>;

export interface GPSPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
  heading?: number | null;
  speed?: number | null;
  timestamp: number;
}

export type GPSStatus = 'prompt' | 'granted' | 'denied' | 'unavailable' | 'loading' | 'mock';

export interface BoundaryDistanceResult {
  isInside: boolean;
  distanceMeters: number;
  nearestPoint: [number, number]; // [longitude, latitude]
}

export interface RouteInfo {
  coordinates: [number, number][]; // [lat, lng] for Leaflet
  distanceMeters: number;
  durationSeconds: number; // Pedestrian walking duration in seconds (~1.25 m/s or 4.5 km/h)
  drivingDurationSeconds: number; // Vehicular driving duration in seconds
  isFallback: boolean; // true if straight line fallback
}

export type MapLayerType = 'streets' | 'satellite';
