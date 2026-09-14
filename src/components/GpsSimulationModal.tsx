import React from 'react';
import type { GPSPosition, TerritoryFeature } from '../types';
import { getTerritoryBounds, getTerritoryInteriorPoint } from '../utils/turfUtils';
import { X, MapPin, CheckCircle, Navigation } from 'lucide-react';

interface GpsSimulationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTerritory: TerritoryFeature | null;
  onSetGps: (pos: GPSPosition | null) => void;
  isMock: boolean;
}

export const GpsSimulationModal: React.FC<GpsSimulationModalProps> = ({
  isOpen,
  onClose,
  currentTerritory,
  onSetGps,
  isMock,
}) => {
  if (!isOpen) return null;

  const handleSimulateInside = () => {
    if (!currentTerritory) return;
    const [lng, lat] = getTerritoryInteriorPoint(currentTerritory);
    onSetGps({
      latitude: lat,
      longitude: lng,
      accuracy: 5,
      timestamp: Date.now(),
    });
    onClose();
  };

  const handleSimulateOutsideNear = () => {
    if (!currentTerritory) return;
    // Shift slightly north of the bounding box (~50-80 meters)
    // 1 deg lat is ~111,000 m -> 0.0005 deg is ~55 meters
    const bounds = getTerritoryBounds(currentTerritory);
    const midLng = (bounds[0] + bounds[2]) / 2;
    const outsideLat = bounds[3] + 0.0006; // ~66m north of top border
    onSetGps({
      latitude: outsideLat,
      longitude: midLng,
      accuracy: 8,
      timestamp: Date.now(),
    });
    onClose();
  };

  const handleSimulateOutsideFar = () => {
    if (!currentTerritory) return;
    const bounds = getTerritoryBounds(currentTerritory);
    const midLng = (bounds[0] + bounds[2]) / 2;
    const farLat = bounds[3] + 0.01; // ~1.1 km north
    onSetGps({
      latitude: farLat,
      longitude: midLng,
      accuracy: 12,
      timestamp: Date.now(),
    });
    onClose();
  };

  const handleResetToRealGps = () => {
    onSetGps(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[650] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Navigation className="w-5 h-5 text-sky-400" />
            <h3 className="font-bold text-base text-white">Narzędzie Symulacji GPS</h3>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center min-w-[44px] min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer active:scale-95"
            aria-label="Zamknij"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          Użyj tego narzędzia do weryfikacji działania aplikacji bez konieczności wychodzenia w teren.
          Możesz sprawdzić zmianę statusu, odległość do krawędzi oraz wyliczanie trasy OSRM.
        </p>

        <div className="space-y-2.5">
          <button
            onClick={handleSimulateInside}
            disabled={!currentTerritory}
            className="w-full min-h-[50px] flex items-center justify-between p-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-left border border-slate-700 hover:border-emerald-500/50 transition cursor-pointer active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
              <div>
                <span className="font-semibold text-sm text-emerald-300 block">
                  Symuluj pozycję WEWNĄTRZ terenu
                </span>
                <span className="text-[11px] text-slate-400">
                  Status zmieni się na &quot;Jesteś na terenie&quot;
                </span>
              </div>
            </div>
            <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
          </button>

          <button
            onClick={handleSimulateOutsideNear}
            disabled={!currentTerritory}
            className="w-full min-h-[50px] flex items-center justify-between p-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-left border border-slate-700 hover:border-amber-500/50 transition cursor-pointer active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-amber-500"></span>
              <div>
                <span className="font-semibold text-sm text-amber-300 block">
                  Symuluj ~60m POZA granicą
                </span>
                <span className="text-[11px] text-slate-400">
                  Pokaże odległość w metrach i wyrysuje trasę do granicy
                </span>
              </div>
            </div>
            <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
          </button>

          <button
            onClick={handleSimulateOutsideFar}
            disabled={!currentTerritory}
            className="w-full min-h-[50px] flex items-center justify-between p-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-left border border-slate-700 hover:border-sky-500/50 transition cursor-pointer active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-sky-500"></span>
              <div>
                <span className="font-semibold text-sm text-sky-300 block">
                  Symuluj ~1 km POZA granicą
                </span>
                <span className="text-[11px] text-slate-400">
                  Testuje dojazd drogowy OSRM oraz przycisk Google Maps
                </span>
              </div>
            </div>
            <MapPin className="w-4 h-4 text-sky-400 shrink-0" />
          </button>

          {isMock && (
            <button
              onClick={handleResetToRealGps}
              className="w-full min-h-[44px] flex items-center justify-center gap-2 p-3 rounded-xl bg-red-950/60 hover:bg-red-900 border border-red-800/80 text-red-200 text-xs font-semibold transition cursor-pointer active:scale-[0.99]"
            >
              <CheckCircle className="w-4 h-4 text-red-400" />
              <span>Wyłącz symulację (przywróć fizyczny GPS)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
