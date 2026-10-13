import React, { useState, useEffect, useMemo } from 'react';
import { flushSync } from 'react-dom';
import QRCode from 'qrcode';
import type { TerritoryFeature } from '../../types';
import mapSource from '../../../config/map-source.json';
import { X, Printer, ExternalLink, QrCode } from 'lucide-react';

interface QRGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  territories: TerritoryFeature[];
  onImportSuccess?: (collection: unknown) => void;
  onResetDefault?: () => void;
  isCustomLoaded?: boolean;
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
}) => {
  const [cardsNoNav, setCardsNoNav] = useState<GeneratedCard[]>([]);
  const [cardsWithNav, setCardsWithNav] = useState<GeneratedCard[]>([]);
  const [activeVariant, setActiveVariant] = useState<'withoutNav' | 'withNav'>('withoutNav');
  const [isGenerating, setIsGenerating] = useState(false);

  // Link to Google My Maps editing
  const googleMyMapsEditUrl = useMemo(() => {
    const config = mapSource as { googleMyMapsEditUrl?: string; googleMapId?: string };
    const customUrl = config.googleMyMapsEditUrl?.trim();
    if (customUrl) return customUrl;
    const mapId = config.googleMapId?.trim();
    if (mapId) return `https://www.google.com/maps/d/edit?mid=${encodeURIComponent(mapId)}`;
    return 'https://www.google.com/maps/d/';
  }, []);

  const currentCards = activeVariant === 'withNav' ? cardsWithNav : cardsNoNav;

  // Standard 24 cards per A4 page (4 columns x 6 rows, 3x3 cm code)
  const cardPages = useMemo(() => {
    const pages: GeneratedCard[][] = [];
    const pageSize = 24;
    for (let i = 0; i < currentCards.length; i += pageSize) {
      pages.push(currentCards.slice(i, i + pageSize));
    }
    return pages;
  }, [currentCards]);

  // Generate QR codes for all territories (both variants)
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsGenerating(true);

    const generateAll = async () => {
      const baseUrl = window.location.origin + window.location.pathname;
      const noNavList: GeneratedCard[] = [];
      const withNavList: GeneratedCard[] = [];

      for (const t of territories) {
        const id = String(t.properties.id ?? t.id ?? '').trim();
        const rawName = String(t.properties.name || '').trim();
        const rawNum = String(t.properties.number || id).trim();

        const displayName = rawName.startsWith(rawNum)
          ? rawName
          : rawNum && rawNum !== rawName
          ? `${rawNum} ${rawName}`
          : rawName || `Teren ${id}`;

        const urlNoNav = `${baseUrl}?id=${encodeURIComponent(id)}`;
        const urlWithNav = `${baseUrl}?id=${encodeURIComponent(id)}&showNavigation=true`;

        try {
          const qrNoNav = await QRCode.toDataURL(urlNoNav, {
            width: 360,
            margin: 1,
            color: {
              dark: '#0f172a',
              light: '#ffffff',
            },
          });

          const qrWithNav = await QRCode.toDataURL(urlWithNav, {
            width: 360,
            margin: 1,
            color: {
              dark: '#0f172a',
              light: '#ffffff',
            },
          });

          noNavList.push({
            id,
            name: rawName,
            displayName,
            number: rawNum,
            city: t.properties.city,
            description: t.properties.description,
            qrDataUrl: qrNoNav,
            fullUrl: urlNoNav,
          });

          withNavList.push({
            id,
            name: rawName,
            displayName,
            number: rawNum,
            city: t.properties.city,
            description: t.properties.description,
            qrDataUrl: qrWithNav,
            fullUrl: urlWithNav,
          });
        } catch (err) {
          console.error('Failed to generate QR for', id, err);
        }
      }

      if (isMounted) {
        setCardsNoNav(noNavList);
        setCardsWithNav(withNavList);
        setIsGenerating(false);
      }
    };

    generateAll();

    return () => {
      isMounted = false;
    };
  }, [isOpen, territories]);

  if (!isOpen) return null;

  const handlePrint = (withNav: boolean) => {
    flushSync(() => {
      setActiveVariant(withNav ? 'withNav' : 'withoutNav');
    });
    setTimeout(() => {
      window.print();
    }, 50);
  };

  return (
    <div className="fixed inset-0 z-[700] flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-md overflow-y-auto print:p-0 print:bg-white print:static print:z-auto">
      {/* Modal Card */}
      <div className="w-full max-w-5xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[95vh] print:max-h-none print:h-auto print:border-none print:shadow-none print:bg-white print:rounded-none">
        {/* Header - Screen only */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-slate-800 bg-slate-900/90 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400">
              <QrCode className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-white">Kody QR</h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Link to Google My Maps edit */}
            <a
              href={googleMyMapsEditUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 min-h-[44px] px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition active:scale-95 cursor-pointer"
              title="Otwórz edytor w Google Moje Mapy"
            >
              <ExternalLink className="w-4 h-4 text-sky-400" />
              <span>Edytuj obrysy terenów</span>
            </a>

            {/* Print without navigation */}
            <button
              onClick={() => handlePrint(false)}
              disabled={isGenerating || cardsNoNav.length === 0}
              className="flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow transition active:scale-95 cursor-pointer"
              title="Drukuj kody bez panelu nawigacji"
            >
              <Printer className="w-4 h-4 text-blue-100" />
              <span>Drukuj kody mapek bez nawigacji</span>
            </button>

            {/* Print with navigation */}
            <button
              onClick={() => handlePrint(true)}
              disabled={isGenerating || cardsWithNav.length === 0}
              className="flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow transition active:scale-95 cursor-pointer"
              title="Drukuj kody z włączonym panelem nawigacji"
            >
              <Printer className="w-4 h-4 text-blue-100" />
              <span>Drukuj kody mapek z nawigacją</span>
            </button>

            {/* Close button */}
            <button
              onClick={onClose}
              className="flex items-center justify-center min-w-[44px] min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer active:scale-95"
              aria-label="Zamknij"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Sheet Area - strictly QR cards list */}
        <div className="overflow-y-auto p-4 sm:p-6 bg-slate-950 print:bg-white print:p-0 print:overflow-visible flex-1">
          {isGenerating ? (
            <div className="py-16 text-center text-slate-400 text-sm">
              Generowanie kodów QR...
            </div>
          ) : (
            <div className="space-y-6 print:space-y-0">
              {cardPages.map((pageCards, pageIndex) => (
                <div key={pageIndex} className="qr-print-page">
                  <div className="printable-cards-grid grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 density-4x6 gap-3.5 print:gap-2.5">
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
