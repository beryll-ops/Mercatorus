import React, { useState, useMemo } from 'react';
import type { TerritoryFeature } from '../types';
import { Search, X, ArrowRight } from 'lucide-react';

interface TerritorySelectorProps {
  isOpen: boolean;
  onClose: () => void;
  territories: TerritoryFeature[];
  onSelect: (id: string) => void;
}

export const TerritorySelector: React.FC<TerritorySelectorProps> = ({
  isOpen,
  onClose,
  territories,
  onSelect,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTerritories = useMemo(() => {
    if (!searchQuery.trim()) return territories;
    const q = searchQuery.toLowerCase();
    return territories.filter((t) => {
      const name = (t.properties.name || '').toLowerCase();
      const num = (t.properties.number || '').toLowerCase();
      const desc = (t.properties.description || '').toLowerCase();
      const city = (t.properties.city || '').toLowerCase();
      return name.includes(q) || num.includes(q) || desc.includes(q) || city.includes(q);
    });
  }, [territories, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[600] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full sm:max-w-lg bg-slate-900 border border-slate-700/80 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] transition-all">
        {/* Top Search & Close Bar */}
        <div className="p-3 sm:p-4 border-b border-slate-800 flex items-center gap-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Szukaj po nazwie, numerze terenu, ulicy..."
              className="w-full pl-10 pr-4 min-h-[44px] py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center min-w-[44px] min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer active:scale-95 shrink-0"
            aria-label="Zamknij"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Territory List */}
        <div className="overflow-y-auto p-4 space-y-2.5 divide-y divide-slate-800/40">
          {filteredTerritories.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm">
              {territories.length === 0
                ? 'Brak wgranych terenów. Zsynchronizuj mapę lub wgraj plik KML.'
                : `Brak terenów pasujących do frazy "${searchQuery}"`}
            </div>
          ) : (
            filteredTerritories.map((t) => {
              const props = t.properties;
              return (
                <button
                  key={props.id}
                  onClick={() => {
                    onSelect(props.id);
                    onClose();
                  }}
                  className="w-full min-h-[52px] pt-2.5 first:pt-0 text-left group flex items-center justify-between p-3 rounded-xl hover:bg-slate-800/70 border border-transparent hover:border-slate-700 transition cursor-pointer active:scale-[0.99]"
                >
                  <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white group-hover:text-blue-400 transition">
                          {props.name}
                        </span>
                        {props.city && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                            {props.city}
                          </span>
                        )}
                      </div>
                      {props.description && (
                        <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                          {props.description}
                        </p>
                      )}
                    </div>
                  <div className="p-2 rounded-lg bg-slate-800 text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition shrink-0">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
