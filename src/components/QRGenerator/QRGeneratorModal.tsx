import React, { useState, useEffect, useRef, useMemo } from 'react';
import QRCode from 'qrcode';
import type { TerritoryFeature, TerritoryCollection } from '../../types';
import { extractKmlText, parseKmlToTerritories } from '../../utils/kmlParser';
import {
  X,
  Upload,
  Printer,
  FileCode,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Download,
} from 'lucide-react';

interface QRGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  territories: TerritoryFeature[];
  onImportSuccess: (collection: TerritoryCollection) => void;
  onResetDefault: () => void;
  isCustomLoaded: boolean;
}

interface GeneratedCard {
  id: string;
  name: string;
  displayName: string;
  number?: string;
  city?: string;
  description?: string;
  qrDataUrl: string;
  fullUrl: string;
}

export const QRGeneratorModal: React.FC<QRGeneratorModalProps> = ({
  isOpen,
  onClose,
  territories,
  onImportSuccess,
  onResetDefault,
  isCustomLoaded,
}) => {
  const [cards, setCards] = useState<GeneratedCard[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [importStatus, setImportStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  type LayoutDensity = 'grid-4x6' | 'grid-3x6' | 'grid-5x6';
  const [layoutDensity, setLayoutDensity] = useState<LayoutDensity>('grid-4x6');

  // Group cards into pages for clean, predictable A4 print pagination
  const cardPages = useMemo(() => {
    const pages: GeneratedCard[][] = [];
    const pageSize = layoutDensity === 'grid-4x6' ? 24 : layoutDensity === 'grid-3x6' ? 18 : 30;
    for (let i = 0; i < cards.length; i += pageSize) {
      pages.push(cards.slice(i, i + pageSize));
    }
    return pages;
  }, [cards, layoutDensity]);

  // Generate QR codes for all territories
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsGenerating(true);

    const generateAll = async () => {
      const baseUrl = window.location.origin + window.location.pathname;
      const results: GeneratedCard[] = [];

      for (const t of territories) {
        const id = String(t.properties.id ?? t.id ?? '').trim();
        const targetUrl = `${baseUrl}?id=${encodeURIComponent(id)}`;
        const rawName = String(t.properties.name || '').trim();
        const rawNum = String(t.properties.number || id).trim();

        // Territory name: ensure number is included if not already present
        const displayName = rawName.startsWith(rawNum)
          ? rawName
          : rawNum && rawNum !== rawName
          ? `${rawNum} ${rawName}`
          : rawName || `Teren ${id}`;

        try {
          const qrDataUrl = await QRCode.toDataURL(targetUrl, {
            width: 360,
            margin: 1,
            color: {
              dark: '#0f172a',
              light: '#ffffff',
            },
          });

          results.push({
            id,
            name: rawName,
            displayName,
            number: rawNum,
            city: t.properties.city,
            description: t.properties.description,
            qrDataUrl,
            fullUrl: targetUrl,
          });
        } catch (err) {
          console.error('Failed to generate QR for', id, err);
        }
      }

      if (isMounted) {
        setCards(results);
        setIsGenerating(false);
      }
    };

    generateAll();

    return () => {
      isMounted = false;
    };
  }, [isOpen, territories]);

  if (!isOpen) return null;

  // Handle File Upload (KML or KMZ)
  const handleProcessFile = async (file: File) => {
    setImportStatus(null);
    try {
      const kmlString = await extractKmlText(file);
      const collection = parseKmlToTerritories(kmlString);
      onImportSuccess(collection);
      setImportStatus({
        type: 'success',
        message: `Pomyślnie zaimportowano ${collection.features.length} terenów z pliku ${file.name}!`,
      });
    } catch (err) {
      console.error('Błąd importu pliku:', err);
      setImportStatus({
        type: 'error',
        message:
          err instanceof Error
            ? err.message
            : 'Wystąpił nieoczekiwany błąd podczas przetwarzania pliku KML/KMZ.',
      });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadGeoJson = () => {
    const data: TerritoryCollection = {
      type: 'FeatureCollection',
      features: territories,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/geo+json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mercatorus_tereny_${new Date().toISOString().slice(0, 10)}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-[700] flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-md overflow-y-auto print:p-0 print:bg-white print:static print:z-auto">
      {/* Modal Card */}
      <div className="w-full max-w-5xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[95vh] print:max-h-none print:h-auto print:border-none print:shadow-none print:bg-white print:rounded-none">
        {/* Header - Screen only */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/90 print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400">
              <FileCode className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Generator Kart QR & Importer KML/KMZ</h2>
              <p className="text-xs text-slate-400">
                Wgrywaj pliki z Google My Maps i generuj arkusze A4 do druku
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={isGenerating || cards.length === 0}
              className="flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow transition active:scale-95 cursor-pointer"
              title="Drukuj arkusze kart (Ctrl+P)"
            >
              <Printer className="w-4 h-4" />
              <span>Drukuj A4</span>
            </button>
            <button
              onClick={onClose}
              className="flex items-center justify-center min-w-[44px] min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer active:scale-95"
              aria-label="Zamknij"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action Toolbar & Upload - Screen only */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/60 space-y-4 print:hidden">
          {/* Drag & Drop Zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-blue-400 bg-blue-500/10'
                : 'border-slate-700 hover:border-slate-500 bg-slate-800/50'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleProcessFile(e.target.files[0]);
                }
              }}
              accept=".kml,.kmz"
              className="hidden"
            />
            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="p-3 bg-blue-600/20 text-blue-400 rounded-full">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-white">
                Przeciągnij i upuść plik <span className="text-blue-400">.kml</span> lub <span className="text-indigo-400">.kmz</span> tutaj
              </p>
              <p className="text-xs text-slate-400">
                lub kliknij, aby wybrać plik wyeksportowany z Google Moje Mapy
              </p>
            </div>
          </div>

          {/* Import Status Alert */}
          {importStatus && (
            <div
              className={`p-3 rounded-xl flex items-center gap-2.5 text-xs font-medium ${
                importStatus.type === 'success'
                  ? 'bg-emerald-950/80 border border-emerald-700 text-emerald-200'
                  : 'bg-rose-950/80 border border-rose-700 text-rose-200'
              }`}
            >
              {importStatus.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{importStatus.message}</span>
            </div>
          )}

          {/* Secondary Actions & Density Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2 text-slate-400">
              <span>Tereny w pamięci: <strong className="text-slate-200">{territories.length}</strong></span>
              {isCustomLoaded && (
                <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono text-[10px]">
                  Własne z pliku
                </span>
              )}
            </div>

            {/* Layout Density Selector */}
            <div className="flex items-center gap-1 bg-slate-800/90 p-1 rounded-xl border border-slate-700">
              <span className="text-[11px] text-slate-400 px-2 font-medium">Układ:</span>
              <button
                type="button"
                onClick={() => setLayoutDensity('grid-4x6')}
                className={`min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  layoutDensity === 'grid-4x6'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                }`}
                title="24 kody na arkuszu A4 (4 kolumny, kod 3x3 cm)"
              >
                4 kolumny (24 na A4)
              </button>
              <button
                type="button"
                onClick={() => setLayoutDensity('grid-3x6')}
                className={`min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  layoutDensity === 'grid-3x6'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                }`}
                title="18 kodów na arkuszu A4 (3 kolumny, kod 3x3 cm)"
              >
                3 kolumny (18 na A4)
              </button>
              <button
                type="button"
                onClick={() => setLayoutDensity('grid-5x6')}
                className={`min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  layoutDensity === 'grid-5x6'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                }`}
                title="30 kodów na arkuszu A4 (5 kolumn, kod 3x3 cm)"
              >
                5 kolumn (30 na A4)
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadGeoJson}
                className="flex items-center gap-1.5 min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer active:scale-95"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Pobierz GeoJSON</span>
              </button>

              {isCustomLoaded && (
                <button
                  onClick={onResetDefault}
                  className="flex items-center gap-1.5 min-h-[44px] px-3.5 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800 transition cursor-pointer active:scale-95"
                  title="Przywróć fabryczne przykładowe tereny"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Przywróć domyślne</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Printable Sheet Area */}
        <div className="overflow-y-auto p-4 sm:p-6 bg-slate-950 print:bg-white print:p-0 print:overflow-visible flex-1">
          {isGenerating ? (
            <div className="py-16 text-center text-slate-400 text-sm">
              Generowanie kodów QR...
            </div>
          ) : (
            <div className="space-y-6 print:space-y-0">
              {cardPages.map((pageCards, pageIndex) => (
                <div key={pageIndex} className="qr-print-page">
                  <div
                    className={`printable-cards-grid grid gap-3.5 print:gap-2.5 ${
                      layoutDensity === 'grid-4x6'
                        ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 density-4x6'
                        : layoutDensity === 'grid-3x6'
                        ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 density-3x6'
                        : 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 density-5x6'
                    }`}
                  >
                    {pageCards.map((card) => (
                      <div
                        key={card.id}
                        className="qr-print-card bg-white text-slate-900 p-2 rounded-lg flex flex-col items-center justify-center break-inside-avoid shadow-sm print:shadow-none print:p-1 print:m-0 print:border-none"
                      >
                        {/* Territory Name Header ONLY */}
                        <h3 className="font-bold text-xs sm:text-sm text-slate-900 text-center leading-tight mb-1.5 px-0.5 line-clamp-2">
                          {card.displayName}
                        </h3>

                        {/* Strictly 3x3 cm QR Code image */}
                        <div className="flex items-center justify-center p-0.5 bg-white">
                          <img
                            src={card.qrDataUrl}
                            alt={`Kod QR dla ${card.displayName}`}
                            className="qr-code-img object-contain print:w-[3cm] print:h-[3cm]"
                            style={{
                              width: '3cm',
                              height: '3cm',
                              minWidth: '3cm',
                              minHeight: '3cm',
                              maxWidth: '3cm',
                              maxHeight: '3cm',
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
