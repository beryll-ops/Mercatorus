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
  // WARIANT 1: Głosiciel na terenie (Inside polygon)
  if (distanceResult?.isInside) {
    return (
      <div className="flex items-center justify-between gap-2.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-2xl shadow-xl backdrop-blur-md bg-emerald-950/90 border border-emerald-500/60 text-emerald-100 transition-all">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-emerald-500/20 text-emerald-400 shrink-0">
            <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-xs sm:text-sm tracking-wide leading-snug truncate">
              Jesteś na terenie
            </span>
            <div className="flex items-center gap-2 text-[10px] sm:text-[11px] text-emerald-200/80">
              {gpsAccuracy !== undefined ? (
                <span>Dokładność: &plusmn;{Math.round(gpsAccuracy)}m</span>
              ) : (
                <span>Lokalizacja aktywna</span>
              )}
              {isMock && (
                <span className="px-1.5 py-0.5 rounded bg-blue-500/30 text-blue-300 font-mono text-[9px]">
                  SYMULACJA
                </span>
              )}
            </div>
          </div>
        </div>

        {onOpenGpsSimModal && (
          <button
            onClick={onOpenGpsSimModal}
            className="text-xs min-h-[36px] px-2.5 py-1 rounded-xl bg-emerald-900/40 hover:bg-emerald-900/60 text-emerald-200 border border-emerald-500/40 shrink-0 transition cursor-pointer active:scale-95 flex items-center justify-center font-medium"
            title="Zmień punkt testowy"
          >
            Symuluj
          </button>
        )}
      </div>
    );
  }

  // WARIANT 2: Głosiciel poza terenem z aktywnym GPS (Outside polygon)
  if (distanceResult && !distanceResult.isInside) {
    return (
      <div className="flex items-center justify-between gap-2.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-2xl shadow-xl backdrop-blur-md bg-amber-950/90 border border-amber-500/60 text-amber-100 transition-all">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-amber-500/20 text-amber-400 shrink-0">
            <Compass className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-xs sm:text-sm tracking-wide leading-snug truncate">
              Jesteś poza terenem (odległość do granicy: {distanceResult.distanceMeters} m)
            </span>
            <div className="flex items-center gap-2 text-[10px] sm:text-[11px] text-amber-200/80">
              {gpsAccuracy !== undefined ? (
                <span>Dokładność: &plusmn;{Math.round(gpsAccuracy)}m</span>
              ) : (
                <span>Odległość w linii prostej</span>
              )}
              {isMock && (
                <span className="px-1.5 py-0.5 rounded bg-blue-500/30 text-blue-300 font-mono text-[9px]">
                  SYMULACJA
                </span>
              )}
            </div>
          </div>
        </div>

        {onOpenGpsSimModal && (
          <button
            onClick={onOpenGpsSimModal}
            className="text-xs min-h-[36px] px-2.5 py-1 rounded-xl bg-amber-900/40 hover:bg-amber-900/60 text-amber-200 border border-amber-500/40 shrink-0 transition cursor-pointer active:scale-95 flex items-center justify-center font-medium"
            title="Zmień punkt testowy"
          >
            Symuluj
          </button>
        )}
      </div>
    );
  }

  // WARIANT 3: Brak GPS / oczekiwanie na sygnał (Compact third variant)
  const isDenied = gpsStatus === 'denied';
  const isLoading = gpsStatus === 'loading';
  const isUnavailable = gpsStatus === 'unavailable';

  return (
    <div
      onClick={onRequestGps}
      className={`flex items-center justify-between gap-2.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-2xl shadow-xl backdrop-blur-md border transition-all cursor-pointer ${
        isDenied
          ? 'bg-rose-950/90 border-rose-800/80 text-rose-100 hover:bg-rose-950'
          : isUnavailable
          ? 'bg-amber-950/90 border-amber-800/80 text-amber-100 hover:bg-amber-950'
          : 'bg-slate-900/95 border-slate-700/80 text-slate-200 hover:bg-slate-900'
      }`}
      title="Kliknij, aby włączyć lub odświeżyć geolokalizację GPS"
      role="button"
      tabIndex={0}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className={`flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full shrink-0 ${
            isDenied
              ? 'bg-rose-500/20 text-rose-400'
              : isUnavailable
              ? 'bg-amber-500/20 text-amber-400'
              : 'bg-blue-500/20 text-blue-400'
          }`}
        >
          {isLoading ? (
            <Radio className="w-4 h-4 animate-pulse" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
        </div>
        <div className="flex flex-col min-w-0">
          <span className="font-bold text-xs sm:text-sm tracking-wide leading-snug truncate">
            {isDenied
              ? 'Brak uprawnień GPS'
              : isUnavailable
              ? 'Szukanie sygnału GPS...'
              : 'Ustalanie pozycji GPS...'}
          </span>
          <p className="text-[10px] sm:text-[11px] text-slate-300/80 truncate">
            {isDenied
              ? 'Dotknij, aby włączyć geolokalizację'
              : isUnavailable
              ? 'Oczekiwanie na sygnał satelitarny'
              : 'Pobieranie współrzędnych...'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
        {onRequestGps && (
          <button
            onClick={onRequestGps}
            disabled={isLoading}
            className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer active:scale-95 flex items-center justify-center ${
              isLoading
                ? 'bg-slate-800 text-slate-300 border border-slate-700/60 cursor-wait opacity-90'
                : isDenied
                ? 'bg-rose-900 hover:bg-rose-800 text-white border border-rose-700/50'
                : 'bg-amber-900 hover:bg-amber-800 text-white border border-amber-700/50'
            }`}
          >
            {isLoading ? 'Szukanie...' : isDenied ? 'Włącz' : 'Odśwież'}
          </button>
        )}
        {onOpenGpsSimModal && (
          <button
            onClick={onOpenGpsSimModal}
            className="min-h-[40px] px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer active:scale-95 flex items-center justify-center"
          >
            Symuluj
          </button>
        )}
      </div>
    </div>
  );
};
