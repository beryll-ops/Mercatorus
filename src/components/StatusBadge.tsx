import React from 'react';
import type { BoundaryDistanceResult, GPSStatus } from '../types';
import { ShieldCheck, AlertCircle, Compass, Radio } from 'lucide-react';

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
  gpsStatus,
  gpsAccuracy,
  isMock,
  onRequestGps,
  onOpenGpsSimModal,
}) => {
  // If GPS is denied or unavailable
  if (gpsStatus === 'denied') {
    return (
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-red-950/90 border border-red-800/80 rounded-2xl shadow-xl backdrop-blur-md text-red-200 text-sm">
        <div className="flex items-center gap-2.5">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <div>
            <p className="font-semibold text-xs uppercase tracking-wider text-red-400">Brak uprawnień GPS</p>
            <p className="text-xs text-red-300">Włącz geolokalizację, aby śledzić odległość do granic.</p>
          </div>
        </div>
        {onOpenGpsSimModal && (
          <button
            onClick={onOpenGpsSimModal}
            className="min-h-[44px] px-3.5 py-2 bg-red-800 hover:bg-red-700 text-white rounded-xl text-xs font-semibold whitespace-nowrap transition active:scale-95 cursor-pointer flex items-center justify-center"
          >
            Symuluj GPS
          </button>
        )}
      </div>
    );
  }

  if (gpsStatus === 'unavailable') {
    return (
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-amber-950/90 border border-amber-800/80 rounded-2xl shadow-xl backdrop-blur-md text-amber-200 text-sm">
        <div className="flex items-center gap-2.5">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
          <div>
            <p className="font-semibold text-xs uppercase tracking-wider text-amber-400">Szukanie sygnału GPS</p>
            <p className="text-xs text-amber-300">Oczekiwanie na precyzyjny sygnał satelitarny...</p>
          </div>
        </div>
        <div className="flex gap-2">
          {onRequestGps && (
            <button
              onClick={onRequestGps}
              className="min-h-[44px] px-3.5 py-2 bg-amber-800 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center justify-center"
            >
              Odśwież
            </button>
          )}
          {onOpenGpsSimModal && (
            <button
              onClick={onOpenGpsSimModal}
              className="min-h-[44px] px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center justify-center"
            >
              Symuluj
            </button>
          )}
        </div>
      </div>
    );
  }

  if (gpsStatus === 'loading' && !distanceResult) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-slate-900/90 border border-slate-700 rounded-2xl shadow-xl backdrop-blur-md text-slate-300 text-sm">
        <Radio className="w-5 h-5 text-blue-400 animate-pulse shrink-0" />
        <span className="text-xs font-medium">Ustalanie Twojej pozycji GPS...</span>
      </div>
    );
  }

  if (!distanceResult) {
    return null;
  }

  // Exact requirement text:
  // When inside polygon, badge strictly says "Jesteś na terenie".
  // When outside, badge says "Jesteś poza terenem (odległość do granicy: X m)".
  const { isInside, distanceMeters } = distanceResult;

  return (
    <div
      className={`flex items-center justify-between px-3 py-2 sm:px-4 sm:py-2.5 rounded-2xl shadow-xl backdrop-blur-md border transition-all ${
        isInside
          ? 'bg-emerald-950/90 border-emerald-500/60 text-emerald-100'
          : 'bg-amber-950/90 border-amber-500/60 text-amber-100'
      }`}
    >
      <div className="flex items-center gap-2.5 sm:gap-3">
        {isInside ? (
          <div className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-emerald-500/20 text-emerald-400 shrink-0">
            <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        ) : (
          <div className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-amber-500/20 text-amber-400 shrink-0">
            <Compass className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        )}

        <div className="flex flex-col min-w-0">
          <span className="font-bold text-xs sm:text-sm tracking-wide leading-snug">
            {isInside
              ? 'Jesteś na terenie'
              : `Jesteś poza terenem (odległość do granicy: ${distanceMeters} m)`}
          </span>
          <div className="flex items-center gap-2 text-[11px] text-slate-300/80">
            {gpsAccuracy !== undefined && (
              <span>Dokładność GPS: &plusmn;{Math.round(gpsAccuracy)}m</span>
            )}
            {isMock && (
              <span className="px-1.5 py-0.5 rounded bg-blue-500/30 text-blue-300 font-mono text-[10px]">
                TRYB SYMULACJI
              </span>
            )}
          </div>
        </div>
      </div>

      {onOpenGpsSimModal && (
        <button
          onClick={onOpenGpsSimModal}
          className="text-xs min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/60 shrink-0 transition cursor-pointer active:scale-95 flex items-center justify-center font-medium"
          title="Zmień punkt testowy"
        >
          Symulacja
        </button>
      )}
    </div>
  );
};
