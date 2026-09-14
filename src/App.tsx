import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type {
  TerritoryCollection,
  TerritoryFeature,
  MapLayerType,
  BoundaryDistanceResult,
  RouteInfo,
} from './types';
import { loadTerritories, saveCustomTerritories, resetToDefaultTerritories, findTerritoryById } from './utils/storage';
import { calculateBoundaryDistance } from './utils/turfUtils';
import { fetchRoute } from './utils/osrm';
import { useGeolocation } from './hooks/useGeolocation';
import { LeafletMap } from './components/Map/LeafletMap';
import { Header } from './components/Header';
import { StatusBadge } from './components/StatusBadge';
import { NavigationPanel } from './components/NavigationPanel';
import { TerritorySelector } from './components/TerritorySelector';
import { QRGeneratorModal } from './components/QRGenerator/QRGeneratorModal';
import { GpsSimulationModal } from './components/GpsSimulationModal';
import { AlertTriangle, List } from 'lucide-react';

export function App() {
  const [collection, setCollection] = useState<TerritoryCollection | null>(null);
  const [isCustomLoaded, setIsCustomLoaded] = useState(false);
  const [activeTerritoryId, setActiveTerritoryId] = useState<string | null>(null);
  const [activeLayer, setActiveLayer] = useState<MapLayerType>('streets');
  const [isTerritoryDrawerOpen, setIsTerritoryDrawerOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isGpsModalOpen, setIsGpsModalOpen] = useState(false);

  // GPS Tracking Hook
  const {
    position,
    status: gpsStatus,
    requestPermission,
    setMockPosition,
    isMock,
  } = useGeolocation();

  // Route State
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);

  // Sync URL query param `?id=`
  useEffect(() => {
    const handleUrlChange = () => {
      const params = new URLSearchParams(window.location.search);
      const id = params.get('id');
      setActiveTerritoryId(id);
    };

    // Initial check
    handleUrlChange();

    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, []);

  // Set territory and update URL without full page reload
  const handleSelectTerritory = useCallback((id: string | null) => {
    setActiveTerritoryId(id);
    const url = new URL(window.location.href);
    if (id) {
      url.searchParams.set('id', id);
    } else {
      url.searchParams.delete('id');
    }
    window.history.pushState({}, '', url.toString());
  }, []);

  // Load territories on start
  useEffect(() => {
    let isMounted = true;
    loadTerritories().then(({ collection: loaded, isCustom }) => {
      if (isMounted) {
        setCollection(loaded);
        setIsCustomLoaded(isCustom);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Find currently active territory
  const currentTerritory: TerritoryFeature | null = useMemo(() => {
    if (!collection || !activeTerritoryId) return null;
    return findTerritoryById(collection, activeTerritoryId) || null;
  }, [collection, activeTerritoryId]);

  // Check if invalid ID was specified in URL
  const isInvalidIdSpecified = Boolean(
    activeTerritoryId && collection && !currentTerritory
  );

  // Distance computation
  const distanceResult: BoundaryDistanceResult | null = useMemo(() => {
    if (!position || !currentTerritory) return null;
    return calculateBoundaryDistance([position.longitude, position.latitude], currentTerritory);
  }, [position, currentTerritory]);

  // Track last route fetch to avoid spamming OSRM public demo server
  const lastRouteFetchRef = useRef<{
    userCoord: [number, number];
    targetCoord: [number, number];
    territoryId: string;
    timestamp: number;
  } | null>(null);

  // Route calculation (OSRM with intelligent throttling and silent fallback)
  useEffect(() => {
    if (!position || !distanceResult || distanceResult.isInside || !currentTerritory) {
      setRouteInfo(null);
      lastRouteFetchRef.current = null;
      return;
    }

    const territoryId = String(currentTerritory.properties.id ?? currentTerritory.id ?? '');
    const userCoord: [number, number] = [position.longitude, position.latitude];
    const targetCoord = distanceResult.nearestPoint;
    const now = Date.now();

    const prev = lastRouteFetchRef.current;
    const isSameTerritory = prev !== null && prev.territoryId === territoryId;
    const isSameTarget =
      prev !== null &&
      Math.hypot(
        targetCoord[0] - prev.targetCoord[0],
        targetCoord[1] - prev.targetCoord[1]
      ) * 111000 < 10;

    // Invalidate stale route immediately when switching territories
    if (!isSameTerritory) {
      setRouteInfo(null);
    }

    // Throttle ONLY if same territory and same target:
    // Skip if user moved < 15m or if less than 4s elapsed since last fetch
    if (prev && isSameTerritory && isSameTarget) {
      const timeDiff = now - prev.timestamp;
      const distShift =
        Math.hypot(
          userCoord[0] - prev.userCoord[0],
          userCoord[1] - prev.userCoord[1]
        ) * 111000;

      if (distShift < 15 || timeDiff < 4000) {
        return;
      }
    }

    let isSubscribed = true;
    // Fetch immediately (0ms) on territory/target change; 300ms debounce only for walking GPS movement
    const delay = (!isSameTerritory || !isSameTarget) ? 0 : 300;

    const timer = setTimeout(async () => {
      lastRouteFetchRef.current = {
        userCoord,
        targetCoord,
        territoryId,
        timestamp: Date.now(),
      };
      const result = await fetchRoute(userCoord, targetCoord);
      if (isSubscribed) {
        setRouteInfo(result);
      }
    }, delay);

    return () => {
      isSubscribed = false;
      clearTimeout(timer);
    };
  }, [position, distanceResult, currentTerritory]);

  // 1-Click Layer Toggle
  const handleToggleLayer = useCallback(() => {
    setActiveLayer((prev) => (prev === 'streets' ? 'satellite' : 'streets'));
  }, []);

  // Handlers for Custom Import / Reset
  const handleImportSuccess = (newCollection: TerritoryCollection) => {
    saveCustomTerritories(newCollection);
    setCollection(newCollection);
    setIsCustomLoaded(true);
  };

  const handleResetDefault = () => {
    resetToDefaultTerritories();
    loadTerritories().then(({ collection: loaded, isCustom }) => {
      setCollection(loaded);
      setIsCustomLoaded(isCustom);
    });
  };

  return (
    <div className="relative w-full h-full h-[100dvh] overflow-hidden flex flex-col bg-slate-950 text-slate-100 select-none">
      {/* Top Header */}
      <Header
        currentTerritory={currentTerritory}
        gpsStatus={gpsStatus}
        activeLayer={activeLayer}
        onToggleLayer={handleToggleLayer}
        onBackToLanding={() => handleSelectTerritory(null)}
        onOpenTerritoryDrawer={() => setIsTerritoryDrawerOpen(true)}
        onOpenQrGenerator={() => setIsQrModalOpen(true)}
        isInvalidIdSpecified={isInvalidIdSpecified}
      />

      {/* Main Map Container */}
      <main className="relative flex-1 w-full min-h-0 overflow-hidden">
        <LeafletMap
          territory={currentTerritory}
          allTerritories={collection?.features}
          userPosition={position}
          route={routeInfo}
          activeLayer={activeLayer}
          onToggleLayer={handleToggleLayer}
          onSelectTerritory={handleSelectTerritory}
          isInvalidIdSpecified={isInvalidIdSpecified}
        />

        {/* Invalid ID Alert Banner - placed top-left under header, never obscuring right-side map controls */}
        {isInvalidIdSpecified && (
          <div className="absolute top-3 left-3 max-w-[calc(100%-5.5rem)] sm:max-w-md z-[450] bg-rose-950/95 border border-rose-800 rounded-2xl p-4 shadow-2xl backdrop-blur-md">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-sm text-rose-200">Nie znaleziono terenu</h3>
                <p className="text-xs text-rose-300 mt-1">
                  Teren o identyfikatorze &quot;{activeTerritoryId}&quot; nie istnieje w załadowanej bazie.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => handleSelectTerritory(null)}
                    className="min-h-[44px] px-3.5 py-2 bg-rose-800 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer flex items-center justify-center active:scale-95"
                  >
                    Pokaż wszystkie tereny
                  </button>
                  <button
                    onClick={() => setIsTerritoryDrawerOpen(true)}
                    className="min-h-[44px] px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center justify-center active:scale-95"
                  >
                    Wybierz z listy
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Floating Control Panel (Field View) */}
        {currentTerritory && (
          <div className="absolute bottom-4 left-3 right-3 sm:left-6 sm:right-auto sm:w-96 z-[450] space-y-2.5 pointer-events-auto">
            {/* Strict Status Badge */}
            <StatusBadge
              distanceResult={distanceResult}
              gpsStatus={gpsStatus}
              gpsAccuracy={position?.accuracy}
              isMock={isMock}
              onRequestGps={requestPermission}
              onOpenGpsSimModal={() => setIsGpsModalOpen(true)}
            />

            {/* Navigation & Google Maps panel */}
            <NavigationPanel
              route={routeInfo}
              distanceResult={distanceResult}
              territory={currentTerritory}
            />
          </div>
        )}

        {/* Landing Page Quick Action (When no territory is active) */}
        {!currentTerritory && !isInvalidIdSpecified && collection && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[450] w-[90%] max-w-sm">
            <button
              onClick={() => setIsTerritoryDrawerOpen(true)}
              className="w-full py-3.5 px-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-2xl shadow-2xl flex items-center justify-center gap-3 border border-blue-400/30 transition active:scale-98 text-sm md:text-base cursor-pointer"
            >
              <List className="w-5 h-5" />
              <span>Wybierz teren do pracy ({collection.features.length})</span>
            </button>
          </div>
        )}
      </main>

      {/* Territory Selector Drawer */}
      <TerritorySelector
        isOpen={isTerritoryDrawerOpen}
        onClose={() => setIsTerritoryDrawerOpen(false)}
        territories={collection?.features || []}
        onSelect={(id) => handleSelectTerritory(id)}
      />

      {/* QR Generator & KML Importer Modal */}
      <QRGeneratorModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        territories={collection?.features || []}
        onImportSuccess={handleImportSuccess}
        onResetDefault={handleResetDefault}
        isCustomLoaded={isCustomLoaded}
      />

      {/* GPS Simulation Tool Modal */}
      <GpsSimulationModal
        isOpen={isGpsModalOpen}
        onClose={() => setIsGpsModalOpen(false)}
        currentTerritory={currentTerritory}
        onSetGps={setMockPosition}
        isMock={isMock}
      />
    </div>
  );
}

export default App;
