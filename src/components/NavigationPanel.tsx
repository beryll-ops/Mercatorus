import React, { useState, useEffect } from 'react';
import type { RouteInfo, BoundaryDistanceResult, TerritoryFeature } from '../types';
import { getGoogleMapsUrl } from '../utils/osrm';
import { getTerritoryInteriorPoint } from '../utils/turfUtils';
import { ExternalLink, Navigation2, Clock, Footprints, Car, MapPin } from 'lucide-react';

interface NavigationPanelProps {
  route: RouteInfo | null;
  distanceResult: BoundaryDistanceResult | null;
  territory: TerritoryFeature;
}

export const NavigationPanel: React.FC<NavigationPanelProps> = ({
  route,
  distanceResult,
  territory,
}) => {
  const territoryName = territory.properties.name;
  const isInside = distanceResult?.isInside ?? false;

  // Smart default: for long distances (>= 3 km) default to driving, for walking distances (< 3 km) default to walking
  const [travelMode, setTravelMode] = useState<'walking' | 'driving'>('walking');

  useEffect(() => {
    if (route) {
      if (route.distanceMeters >= 3000) {
        setTravelMode('driving');
      } else {
        setTravelMode('walking');
      }
    }
  }, [route?.distanceMeters]);

  // Determine navigation destination coordinates [lng, lat]
  // When worker is inside territory or GPS is not yet acquired, navigate to territory interior point.
  // Only navigate to nearest boundary point when worker is strictly outside territory.
  const targetPoint = (distanceResult && !distanceResult.isInside)
    ? distanceResult.nearestPoint
    : getTerritoryInteriorPoint(territory);

  const destLng = Number.isFinite(targetPoint?.[0]) ? targetPoint[0] : 0;
  const destLat = Number.isFinite(targetPoint?.[1]) ? targetPoint[1] : 0;

  const googleMapsUrl = getGoogleMapsUrl(destLat, destLng, travelMode);

  // Format duration
  const formatDuration = (seconds: number) => {
    const mins = Math.ceil(seconds / 60);
    if (mins < 60) return `${mins} min`;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    if (hrs < 24) {
      return remMins > 0 ? `${hrs} h ${remMins} min` : `${hrs} h`;
    }
    const days = Math.floor(hrs / 24);
    const remHrs = hrs % 24;
    return remHrs > 0 ? `${days} d ${remHrs} h` : `${days} d`;
  };

  const activeDurationSeconds =
    travelMode === 'walking'
      ? route?.durationSeconds ?? 0
      : route?.drivingDurationSeconds ?? 0;

  return (
    <div className="bg-slate-900/95 border border-slate-700/80 backdrop-blur-xl rounded-2xl p-4 shadow-2xl space-y-3">
      {/* Route estimation & Travel Mode Switch */}
      {route && !isInside && (
        <div className="space-y-2">
          {/* Mode Switch Tabs */}
          <div className="grid grid-cols-2 p-1 bg-slate-800/90 rounded-xl border border-slate-700/60 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setTravelMode('walking')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg transition min-h-[44px] cursor-pointer ${
                travelMode === 'walking'
                  ? 'bg-sky-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Footprints className="w-4 h-4" />
              <span>Pieszo (~4.5 km/h)</span>
            </button>
            <button
              type="button"
              onClick={() => setTravelMode('driving')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg transition min-h-[44px] cursor-pointer ${
                travelMode === 'driving'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Car className="w-4 h-4" />
              <span>Samochód</span>
            </button>
          </div>

          {/* Stats Display */}
          <div className="flex items-center justify-between px-3 py-2 bg-slate-800/80 rounded-xl border border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${
                travelMode === 'walking' ? 'bg-sky-500/20 text-sky-400' : 'bg-indigo-500/20 text-indigo-400'
              }`}>
                {travelMode === 'walking' ? (
                  <Footprints className="w-5 h-5" />
                ) : (
                  <Car className="w-5 h-5" />
                )}
              </div>
              <div>
                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                  {travelMode === 'walking'
                    ? (route.isFallback ? 'Dojście piesze (linia prosta)' : 'Dojście piesze do granicy')
                    : (route.isFallback ? 'Dojazd autem (linia prosta)' : 'Dojazd samochodem do granicy')}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-slate-100">
                    {route.distanceMeters >= 1000
                      ? `${(route.distanceMeters / 1000).toFixed(1)} km`
                      : `${route.distanceMeters} m`}
                  </span>
                  <span className="text-slate-500">•</span>
                  <span className={`flex items-center gap-1 text-xs font-semibold ${
                    travelMode === 'walking' ? 'text-sky-300' : 'text-indigo-300'
                  }`}>
                    <Clock className="w-3.5 h-3.5" />
                    {formatDuration(activeDurationSeconds)}
                  </span>
                </div>
              </div>
            </div>

            {route.isFallback && (
              <span className="px-2 py-1 rounded bg-amber-500/20 text-amber-300 text-[10px] font-medium border border-amber-500/30">
                Wektor
              </span>
            )}
          </div>
        </div>
      )}

      {/* When GPS is not yet acquired, show informative target indicator */}
      {!distanceResult && (
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/60 rounded-xl text-xs text-slate-300 border border-slate-700/40">
          <MapPin className="w-4 h-4 text-sky-400 shrink-0" />
          <span>Cel nawigacji: środek terenu ({territoryName})</span>
        </div>
      )}

      {/* Target coordinates badge */}
      <div className="flex items-center justify-between text-xs text-slate-400 px-1">
        <span className="truncate max-w-[150px]" title={territoryName}>
          {distanceResult ? (isInside ? 'Teren aktywny:' : 'Punkt docelowy:') : 'Środek terenu:'}
        </span>
        <span className="font-mono text-slate-300">
          {destLat.toFixed(5)}°N, {destLng.toFixed(5)}°E
        </span>
      </div>

      {/* Primary Action Button: Navigate in Google Maps */}
      <a
        href={googleMapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full min-h-[48px] px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2.5 transition active:scale-[0.98] border border-blue-400/30 text-sm md:text-base cursor-pointer"
        title="Otwórz nawigację krok po kroku w aplikacji Google Maps"
      >
        <Navigation2 className="w-5 h-5 text-white" />
        <span>
          {travelMode === 'walking' ? 'Nawiguj pieszo w Google Maps' : 'Nawiguj autem w Google Maps'}
        </span>
        <ExternalLink className="w-4 h-4 text-blue-200 ml-auto" />
      </a>
    </div>
  );
};
