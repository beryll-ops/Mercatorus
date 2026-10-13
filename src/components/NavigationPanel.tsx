import React, { useState, useEffect, useRef } from 'react';
import type { RouteInfo, BoundaryDistanceResult, TerritoryFeature } from '../types';
import { getGoogleMapsUrl } from '../utils/osrm';
import { getTerritoryInteriorPoint } from '../utils/turfUtils';
import { ExternalLink, Navigation2, Clock, Footprints, Car } from 'lucide-react';

interface NavigationPanelProps {
  route: RouteInfo | null;
  distanceResult: BoundaryDistanceResult | null;
  territory: TerritoryFeature;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export const NavigationPanel: React.FC<NavigationPanelProps> = ({
  route,
  distanceResult,
  territory,
  isExpanded = false,
  onToggleExpand,
}) => {
  const isInside = distanceResult?.isInside ?? false;

  // Smart default: for long distances (>= 3 km) default to driving, for walking distances (< 3 km) default to walking
  const [travelMode, setTravelMode] = useState<'walking' | 'driving'>('walking');

  // Gesture state for swipe-down-to-dismiss
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartYRef = useRef(0);
  const dragStartTimeRef = useRef(0);
  const isPointerDownRef = useRef(false);
  const hasMovedRef = useRef(false);

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

  // Gesture Handlers: Dual-threshold swipe-to-dismiss (Distance: >= 50px | Velocity: >= 0.4 px/ms)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture fails
    }
    dragStartYRef.current = e.clientY;
    dragStartTimeRef.current = Date.now();
    isPointerDownRef.current = true;
    hasMovedRef.current = false;
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPointerDownRef.current) return;
    const deltaY = e.clientY - dragStartYRef.current;
    if (Math.abs(deltaY) > 4) {
      hasMovedRef.current = true;
    }
    if (deltaY > 0) {
      // 1:1 real-time drag translation downwards
      setDragY(deltaY);
    } else {
      // Rubber-band resistance when dragging upwards
      setDragY(deltaY * 0.15);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPointerDownRef.current) return;
    isPointerDownRef.current = false;
    setIsDragging(false);

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }

    const deltaY = e.clientY - dragStartYRef.current;
    const timeElapsed = Math.max(1, Date.now() - dragStartTimeRef.current);
    const velocity = deltaY / timeElapsed; // px / ms

    // Dual-threshold check:
    // 1. Distance threshold: dragged down >= 50px
    // 2. Velocity threshold (flick): velocity >= 0.4 px/ms with >= 15px downward motion
    const shouldDismiss = deltaY >= 50 || (velocity >= 0.4 && deltaY >= 15);

    if (shouldDismiss && onToggleExpand) {
      onToggleExpand();
    } else if (!hasMovedRef.current && onToggleExpand) {
      // Tap without dragging: collapse immediately
      onToggleExpand();
    }

    setDragY(0);
  };

  // COMPACT COLLAPSED VIEW: Subdued, centered button with upward chevron and no gradient
  if (!isExpanded) {
    return (
      <div className="w-full">
        <button
          onClick={onToggleExpand}
          className="w-full min-h-[50px] py-2 px-4 bg-slate-900/95 hover:bg-slate-800/95 text-slate-100 rounded-2xl shadow-xl flex flex-col items-center justify-center gap-1 border border-slate-700/80 backdrop-blur-xl transition active:scale-[0.98] cursor-pointer group"
          title="Rozwiń menu nawigacji do terenu"
          aria-label="Rozwiń menu nawigacji"
        >
          {/* Chevron handle pointing up */}
          <svg
            className="w-[50px] h-2.5 text-slate-400/80 group-hover:text-slate-200 transition-all transform group-hover:-translate-y-0.5"
            viewBox="0 0 40 10"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 7.5L20 2L37 7.5" />
          </svg>

          {/* Centered content */}
          <div className="flex items-center justify-center gap-2">
            <Navigation2 className="w-4 h-4 text-sky-400 shrink-0" />
            <span className="text-sm font-semibold tracking-wide text-white">Nawiguj</span>
            {route && !isInside && (
              <span className="text-xs text-slate-400 font-normal">
                • {route.distanceMeters >= 1000 ? `${(route.distanceMeters / 1000).toFixed(1)} km` : `${route.distanceMeters} m`}
              </span>
            )}
          </div>
        </button>
      </div>
    );
  }

  // EXPANDED VIEW: Bottom sheet with centered chevron handle and drag-to-dismiss gesture
  return (
    <div
      style={{
        transform: `translateY(${Math.max(0, dragY)}px)`,
        transition: isDragging ? 'none' : 'transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)',
      }}
      className="bg-slate-900/95 border border-slate-700/80 backdrop-blur-xl rounded-2xl pt-1 pb-3 px-3 sm:pt-1.5 sm:pb-4 sm:px-4 shadow-2xl space-y-2 animate-fadeIn select-none"
    >
      {/* Top Drag & Tap Bar: Full-width touch edge with wide, borderless chevron positioned near top edge */}
      {onToggleExpand && (
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="w-full pt-0.5 pb-1 flex items-center justify-center touch-none cursor-grab active:cursor-grabbing select-none group"
          title="Przeciągnij w dół lub kliknij, aby zwinąć"
          aria-label="Zwiń nawigację"
          role="button"
          tabIndex={0}
        >
          <svg
            className="w-[50px] h-3 text-slate-400/80 group-hover:text-slate-200 transition-all transform group-active:translate-y-0.5"
            viewBox="0 0 40 10"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 2.5L20 8L37 2.5" />
          </svg>
        </div>
      )}

      {/* Route estimation & Travel Mode Switch (Zielone - zachowane) */}
      {route && !isInside && (
        <div className="space-y-1.5 sm:space-y-2">
          {/* Mode Switch Tabs */}
          <div className="grid grid-cols-2 p-1 bg-slate-800/90 rounded-xl border border-slate-700/60 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setTravelMode('walking')}
              className={`flex items-center justify-center gap-1.5 py-2 px-2.5 sm:px-3 rounded-lg transition min-h-[44px] cursor-pointer ${
                travelMode === 'walking'
                  ? 'bg-sky-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Footprints className="w-4 h-4" />
              <span>Pieszo</span>
            </button>
            <button
              type="button"
              onClick={() => setTravelMode('driving')}
              className={`flex items-center justify-center gap-1.5 py-2 px-2.5 sm:px-3 rounded-lg transition min-h-[44px] cursor-pointer ${
                travelMode === 'driving'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Car className="w-4 h-4" />
              <span>Samochód</span>
            </button>
          </div>

          {/* Stats Display: Clean distance and duration */}
          <div className="flex items-center justify-between px-3 py-2 bg-slate-800/80 rounded-xl border border-slate-700/50">
            <div className="flex items-center gap-2">
              <span className="text-sm sm:text-base font-bold text-slate-100">
                {route.distanceMeters >= 1000
                  ? `${(route.distanceMeters / 1000).toFixed(1)} km`
                  : `${route.distanceMeters} m`}
              </span>
              <span className="text-slate-500">•</span>
              <span className={`flex items-center gap-1 text-xs sm:text-sm font-semibold ${
                travelMode === 'walking' ? 'text-sky-300' : 'text-indigo-300'
              }`}>
                <Clock className="w-3.5 h-3.5" />
                {formatDuration(activeDurationSeconds)}
              </span>
            </div>

            {route.isFallback && (
              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-medium border border-amber-500/30">
                Wektor
              </span>
            )}
          </div>
        </div>
      )}

      {/* Primary Action Button: Navigate in Google Maps (solid blue, no gradient) */}
      <a
        href={googleMapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full min-h-[44px] sm:min-h-[48px] px-3.5 py-2.5 sm:px-4 sm:py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition active:scale-[0.98] border border-blue-400/30 text-xs sm:text-sm md:text-base cursor-pointer"
        title="Otwórz nawigację krok po kroku w aplikacji Google Maps"
      >
        <Navigation2 className="w-4 h-4 sm:w-5 sm:h-5 text-white shrink-0" />
        <span className="truncate">
          {travelMode === 'walking' ? 'Nawiguj pieszo w Google Maps' : 'Nawiguj autem w Google Maps'}
        </span>
        <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-200 ml-auto shrink-0" />
      </a>
    </div>
  );
};
