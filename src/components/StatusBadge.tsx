import React from 'react';
import type { BoundaryDistanceResult, GPSStatus } from '../types';

interface StatusBadgeProps {
  distanceResult: BoundaryDistanceResult | null;
  gpsStatus: GPSStatus;
  gpsAccuracy?: number;
  isMock?: boolean;
  onRequestGps?: () => void;
  onOpenGpsSimModal?: () => void;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  distanceResult,
  onRequestGps,
}) => {
  // WARIANT 1: Głosiciel na terenie (w kolorze zielonym)
  if (distanceResult?.isInside) {
    return (
      <div className="flex items-center justify-center px-3.5 py-1 sm:py-1.5 rounded-lg border backdrop-blur-md shadow-sm bg-slate-900/85 border-emerald-500/30 text-emerald-400 text-[11px] sm:text-xs font-normal select-none text-center whitespace-nowrap">
        <span>Jesteś na terenie</span>
      </div>
    );
  }

  // WARIANT 2: Głosiciel poza terenem (w kolorze neutralnym, z warunkowym km >999m)
  if (distanceResult && !distanceResult.isInside) {
    const formattedDistance =
      distanceResult.distanceMeters > 999
        ? `${(distanceResult.distanceMeters / 1000).toFixed(1)} km do terenu`
        : `${Math.round(distanceResult.distanceMeters)} metrów do terenu`;

    return (
      <div className="flex items-center justify-center px-3.5 py-1 sm:py-1.5 rounded-lg border backdrop-blur-md shadow-sm bg-slate-900/85 border-slate-700/60 text-slate-300 text-[11px] sm:text-xs font-normal select-none text-center whitespace-nowrap">
        <span>{formattedDistance}</span>
      </div>
    );
  }

  // WARIANT 3: Lokalizacja wyłączona (w kolorze blado czerwonym, nie kłujący w oczy)
  return (
    <div
      onClick={onRequestGps}
      className={`flex items-center justify-center px-3.5 py-1 sm:py-1.5 rounded-lg border backdrop-blur-md shadow-sm bg-slate-900/85 border-rose-900/30 text-rose-300/80 text-[11px] sm:text-xs font-normal select-none text-center whitespace-nowrap ${
        onRequestGps ? 'cursor-pointer' : ''
      }`}
      title={onRequestGps ? 'Dotknij, aby ponowić próbę włączenia lokalizacji' : undefined}
    >
      <span>Lokalizacja wyłączona</span>
    </div>
  );
};
