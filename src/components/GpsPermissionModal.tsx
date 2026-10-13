import React from 'react';
import { X, Navigation } from 'lucide-react';

interface GpsPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRetry: () => void;
  permissionState?: PermissionState | null;
  onOpenGpsSimModal?: () => void;
}

export const GpsPermissionModal: React.FC<GpsPermissionModalProps> = ({
  isOpen,
  onClose,
  onRetry,
  onOpenGpsSimModal,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[650] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-4 sm:p-5 space-y-3 sm:space-y-3.5 max-h-[92dvh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 sm:pb-3">
          <h3 className="font-bold text-sm sm:text-base text-white">Jak włączyć lokalizację GPS?</h3>
          <button
            onClick={onClose}
            className="flex items-center justify-center min-w-[44px] min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer active:scale-95"
            aria-label="Zamknij okno instrukcji"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Why it happens */}
        <p className="text-[11px] sm:text-xs text-slate-300 leading-relaxed">
          Przeglądarka zablokowała dostęp do Lokalizacji, aby ją włączyć i widzieć swoją pozycję na mapie terenu, postępuj zgodnie z krokami poniżej:
        </p>

        {/* Step-by-step instructions as simple bulleted list */}
        <ul className="list-disc pl-5 space-y-2.5 text-xs text-slate-300 leading-relaxed">
          <li>
            <strong className="text-white">Włącz lokalizację w telefonie:</strong> przesuń palcem od samej góry ekranu w dół i upewnij się, że ikona <strong>Lokalizacja (GPS)</strong> jest włączona (podświetlona).
          </li>
          <li>
            <strong className="text-white">Zezwól na dostęp na stronie:</strong> na samej górze ekranu, tuż obok adresu strony, dotknij małej ikonki (kłódka 🔒, suwaki ⚙️ lub aA), wybierz <strong>Uprawnienia</strong> i włącz <strong>Lokalizację</strong>.
          </li>
        </ul>

        {/* Action buttons */}
        <div className="pt-2 space-y-2">
          <button
            onClick={onRetry}
            className="w-full min-h-[48px] px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg flex items-center justify-center transition active:scale-[0.98] cursor-pointer text-sm"
          >
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
