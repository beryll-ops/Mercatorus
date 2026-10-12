import React from 'react';
import { X, Navigation, ShieldAlert, RefreshCw, Smartphone } from 'lucide-react';

interface GpsPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRetry: () => void;
  permissionState: PermissionState | null;
  onOpenGpsSimModal?: () => void;
}

export const GpsPermissionModal: React.FC<GpsPermissionModalProps> = ({
  isOpen,
  onClose,
  onRetry,
  permissionState,
  onOpenGpsSimModal,
}) => {
  if (!isOpen) return null;

  const isGranted = permissionState === 'granted';
  const isDenied = permissionState === 'denied';

  return (
    <div className="fixed inset-0 z-[650] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-4 sm:p-5 space-y-3 sm:space-y-3.5 max-h-[92dvh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 sm:pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-white">Jak włączyć lokalizację GPS?</h3>
              <p className="text-[10px] sm:text-[11px] text-slate-400">Wymagana do wskazywania granic terenu</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center min-w-[44px] min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer active:scale-95"
            aria-label="Zamknij okno instrukcji"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status preview */}
        <div className="p-2.5 sm:p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-300 font-medium">Uprawnienie przeglądarki:</span>
          </div>
          <span
            className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono ${
              isGranted
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : isDenied
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
            }`}
          >
            {isGranted ? 'Zezwolono' : isDenied ? 'Zablokowano' : 'Wymaga potwierdzenia'}
          </span>
        </div>

        {/* Why it happens */}
        <p className="text-[11px] sm:text-xs text-slate-300 leading-relaxed">
          Przeglądarka zablokowała automatyczne zapytanie o pozycję. Aby aplikacja mogła nawigować, odblokuj uprawnienie w dwóch krokach:
        </p>

        {/* Step-by-step instructions */}
        <div className="space-y-2 sm:space-y-2.5">
          {/* Step 1 */}
          <div className="p-2.5 sm:p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 flex gap-2.5 items-start">
            <div className="flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-blue-500/20 text-blue-400 font-bold text-xs shrink-0 mt-0.5">
              1
            </div>
            <div className="space-y-0.5">
              <h4 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                <span>Odblokuj w pasku adresu URL</span>
              </h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Dotknij <strong>kłódki / suwaków (🔒/⚙)</strong> obok adresu strony na samej górze ekranu → <strong>Uprawnienia</strong> → <strong>Lokalizacja: Zezwalaj</strong>.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="p-2.5 sm:p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 flex gap-2.5 items-start">
            <div className="flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-blue-500/20 text-blue-400 font-bold text-xs shrink-0 mt-0.5">
              2
            </div>
            <div className="space-y-0.5">
              <h4 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-blue-400" />
                <span>Włącz GPS w telefonie</span>
              </h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Upewnij się, że w belce powiadomień Androida lub iOS włączona jest <strong>Lokalizacja / GPS</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="pt-2 space-y-2">
          <button
            onClick={onRetry}
            className="w-full min-h-[48px] px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition active:scale-[0.98] cursor-pointer text-sm"
          >
            <RefreshCw className="w-4 h-4 text-white shrink-0" />
            <span>Sprawdź ponownie i włącz GPS</span>
          </button>

          {onOpenGpsSimModal && (
            <button
              onClick={() => {
                onClose();
                onOpenGpsSimModal();
              }}
              className="w-full min-h-[44px] px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 rounded-xl font-semibold transition active:scale-[0.98] cursor-pointer text-xs flex items-center justify-center gap-2"
            >
              <Navigation className="w-3.5 h-3.5 text-sky-400" />
              <span>Użyj symulacji pozycji (tryb testowy)</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="w-full min-h-[44px] px-3 py-2 text-slate-400 hover:text-slate-200 text-xs font-medium transition cursor-pointer"
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
};
