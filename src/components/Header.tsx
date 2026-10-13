import React from 'react';
import type { TerritoryFeature, GPSStatus } from '../types';
import { ArrowLeft, QrCode, Radio, ListFilter } from 'lucide-react';

interface HeaderProps {
  currentTerritory: TerritoryFeature | null;
  gpsStatus: GPSStatus;
  onBackToLanding: () => void;
  onOpenTerritoryDrawer: () => void;
  onOpenQrGenerator: () => void;
  onRequestGps?: () => void;
  isInvalidIdSpecified?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentTerritory,
  gpsStatus,
  onBackToLanding,
  onOpenTerritoryDrawer,
  onOpenQrGenerator,
  onRequestGps,
  isInvalidIdSpecified,
}) => {
  return (
    <header className="relative z-[500] h-16 shrink-0 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-3 md:px-5 flex items-center justify-between shadow-md">
      {/* Left side: Back button and Title (when viewing a territory or error) */}
      <div className="flex items-center gap-2.5 min-w-0">
        {(currentTerritory || isInvalidIdSpecified) && (
          <button
            onClick={onBackToLanding}
            className="flex items-center justify-center gap-1.5 min-w-[44px] min-h-[44px] px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 transition active:scale-95 cursor-pointer shrink-0"
            title="Wróć do listy wszystkich terenów"
            aria-label="Wróć do listy wszystkich terenów"
          >
            <ArrowLeft className="w-5 h-5 text-slate-300" />
            <span className="hidden sm:inline text-xs font-semibold">Wszystkie</span>
          </button>
        )}

        {/* Center/Title Info */}
        {currentTerritory ? (
          <div className="flex flex-col truncate pl-1">
            <h1 className="text-sm md:text-base font-bold text-white truncate">
              {currentTerritory.properties.name}
            </h1>
          </div>
        ) : isInvalidIdSpecified ? (
          <div className="flex flex-col truncate pl-1">
            <div className="flex items-center gap-2">
              <div>
                <h1 className="text-sm md:text-base font-bold text-rose-300">Nie znaleziono terenu</h1>
                <p className="text-[11px] text-rose-400">Nieprawidłowy ID w adresie URL</p>
              </div>
              <button
                onClick={onOpenTerritoryDrawer}
                className="flex items-center justify-center gap-1.5 min-w-[44px] min-h-[44px] px-3.5 rounded-xl bg-rose-900/40 text-rose-200 border border-rose-700/50 text-xs font-semibold hover:bg-rose-900/60 transition cursor-pointer active:scale-95"
                title="Wybierz inny teren z listy"
              >
                <ListFilter className="w-4 h-4 text-rose-300" />
                <span className="hidden sm:inline">Wybierz inny</span>
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Right side: Action icons */}
      <div className="flex items-center gap-2 shrink-0">
        {/* GPS status button (interactive) */}
        <button
          onClick={onRequestGps}
          className="flex items-center justify-center gap-1.5 min-w-[44px] min-h-[44px] px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700/80 text-xs transition cursor-pointer active:scale-95"
          title={`Status GPS: ${gpsStatus === 'granted' ? 'aktywny' : gpsStatus === 'mock' ? 'symulowany' : gpsStatus === 'loading' ? 'szukanie...' : 'niedostępny/brak uprawnień'}. Kliknij, aby sprawdzić/odświeżyć.`}
          aria-label={`Status GPS: ${gpsStatus}`}
        >
          <Radio
            className={`w-3.5 h-3.5 ${
              gpsStatus === 'granted' || gpsStatus === 'mock'
                ? 'text-emerald-400 animate-pulse'
                : gpsStatus === 'loading'
                ? 'text-amber-400 animate-spin'
                : 'text-rose-400'
            }`}
          />
          <span className="hidden md:inline text-[11px] font-medium text-slate-300">
            {gpsStatus === 'granted' ? 'GPS aktywny' : gpsStatus === 'mock' ? 'GPS symulowany' : gpsStatus === 'loading' ? 'Szukanie GPS' : 'Brak GPS'}
          </span>
        </button>

        {/* QR Codes Button - visible strictly on the main landing page */}
        {!currentTerritory && !isInvalidIdSpecified && (
          <button
            onClick={onOpenQrGenerator}
            className="flex items-center justify-center gap-1.5 min-w-[44px] min-h-[44px] px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-md border border-blue-400/20 transition active:scale-95 cursor-pointer"
            title="Kody QR"
          >
            <QrCode className="w-4 h-4" />
            <span>Kody QR</span>
          </button>
        )}
      </div>
    </header>
  );
};
