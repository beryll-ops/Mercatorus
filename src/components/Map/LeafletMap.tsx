import React, { useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { TerritoryFeature, GPSPosition, RouteInfo, MapLayerType } from '../../types';
import { Layers, Navigation, Crosshair, ZoomIn, ZoomOut } from 'lucide-react';
import { getTerritoryBounds, getCollectionBounds } from '../../utils/turfUtils';

interface LeafletMapProps {
  territory: TerritoryFeature | null;
  allTerritories?: TerritoryFeature[];
  userPosition: GPSPosition | null;
  route: RouteInfo | null;
  activeLayer: MapLayerType;
  onToggleLayer: () => void;
  onSelectTerritory?: (id: string) => void;
  isInvalidIdSpecified?: boolean;
}

// Custom SVG Icons
const createGpsIcon = () =>
  L.divIcon({
    className: 'gps-user-marker',
    html: `
      <div class="relative flex items-center justify-center w-6 h-6">
        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
        <span class="relative inline-flex rounded-full h-4 w-4 bg-blue-600 border-2 border-white shadow-md"></span>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

const createTargetIcon = () =>
  L.divIcon({
    className: 'target-marker',
    html: `
      <div class="flex items-center justify-center w-5 h-5 bg-emerald-600 border-2 border-white rounded-full shadow-lg text-white">
        <div class="w-1.5 h-1.5 bg-white rounded-full"></div>
      </div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });

export const LeafletMap: React.FC<LeafletMapProps> = ({
  territory,
  allTerritories,
  userPosition,
  route,
  activeLayer,
  onToggleLayer,
  onSelectTerritory,
  isInvalidIdSpecified,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const territoryLayerRef = useRef<L.GeoJSON | null>(null);
  const gpsMarkerRef = useRef<L.Marker | null>(null);
  const gpsCircleRef = useRef<L.Circle | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const targetMarkerRef = useRef<L.Marker | null>(null);
  const initialFitDoneRef = useRef(false);
  const prevTerritoryIdRef = useRef<string | null>(null);

  // Initialize Map & ResizeObserver
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Default center Kraków if nothing loaded yet
    const map = L.map(mapContainerRef.current, {
      center: [50.0619, 19.9368],
      zoom: 14,
      zoomControl: false,
      attributionControl: false,
    });

    L.control.attribution({ position: 'bottomright', prefix: false }).addTo(map);

    mapRef.current = map;

    // ResizeObserver guarantees Leaflet tiles never glitch when layout shifts
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && mapContainerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        map.invalidateSize();
      });
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      resizeObserver?.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update Tile Layer (OpenStreetMap vs Esri Satellite)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    let url = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    let attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
    let maxZoom = 19;

    if (activeLayer === 'satellite') {
      url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      attribution = 'Tiles &copy; Esri &mdash; Maxar, Earthstar Geographics';
      maxZoom = 20;
    }

    const tileLayer = L.tileLayer(url, {
      maxZoom,
      maxNativeZoom: activeLayer === 'satellite' ? 18 : 19,
      attribution,
    }).addTo(map);

    tileLayerRef.current = tileLayer;
  }, [activeLayer]);

  // Render Territory Polygon(s)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // CASE 1: Single territory selected (?id=X) -> STRICTLY ONLY this territory is visible!
    if (territory) {
      const currentId = territory.properties.id;
      const isNewTerritory = prevTerritoryIdRef.current !== currentId;

      if (isNewTerritory) {
        if (territoryLayerRef.current) {
          map.removeLayer(territoryLayerRef.current);
          territoryLayerRef.current = null;
        }

        const geojsonLayer = L.geoJSON(territory, {
          style: () => ({
            color: territory.properties.color || '#2563eb',
            weight: 4,
            opacity: 0.95,
            fillColor: territory.properties.color || '#2563eb',
            fillOpacity: 0.22,
            lineJoin: 'round',
            lineCap: 'round',
          }),
        }).addTo(map);

        territoryLayerRef.current = geojsonLayer;
        prevTerritoryIdRef.current = currentId;

        // Fit bounds ONLY on initial territory load or when user switches to a different territory!
        // Never interrupt user's manual pan or zoom when GPS position updates!
        try {
          const bounds = getTerritoryBounds(territory);
          const leafletBounds = L.latLngBounds(
            [bounds[1], bounds[0]],
            [bounds[3], bounds[2]]
          );
          const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
          map.fitBounds(leafletBounds, {
            paddingTopLeft: [25, 25],
            paddingBottomRight: isMobile ? [25, 300] : [50, 50],
            maxZoom: 17,
          });
        } catch (e) {
          console.error('Failed to fit territory bounds', e);
        }
      }
      return;
    }

    // If an invalid ID was requested in URL, do not show any polygons until user clears it
    if (isInvalidIdSpecified) {
      if (territoryLayerRef.current) {
        map.removeLayer(territoryLayerRef.current);
        territoryLayerRef.current = null;
      }
      prevTerritoryIdRef.current = null;
      return;
    }

    // CASE 2: No specific territory (Landing view) -> show all available territories
    if (allTerritories && allTerritories.length > 0) {
      const isReturningToAll = prevTerritoryIdRef.current !== null || !initialFitDoneRef.current;

      if (isReturningToAll || !territoryLayerRef.current) {
        if (territoryLayerRef.current) {
          map.removeLayer(territoryLayerRef.current);
          territoryLayerRef.current = null;
        }

        const geojsonLayer = L.geoJSON(allTerritories, {
          style: (feature) => {
            const color = (feature?.properties as { color?: string })?.color || '#3b82f6';
            return {
              color,
              weight: 3,
              opacity: 0.85,
              fillColor: color,
              fillOpacity: 0.15,
            };
          },
          onEachFeature: (feature, layer) => {
            const props = feature.properties as { id: string; name: string; description?: string };

            // Safe DOM element popup: avoids string interpolation XSS & handles IDs with special characters
            const popupDiv = document.createElement('div');
            popupDiv.className = 'p-2 text-slate-900 min-w-[190px]';

            const titleEl = document.createElement('h4');
            titleEl.className = 'font-bold text-sm text-blue-700';
            titleEl.textContent = props.name || `Teren ${props.id}`;
            popupDiv.appendChild(titleEl);

            if (props.description) {
              const descEl = document.createElement('p');
              descEl.className = 'text-xs text-slate-600 mt-1';
              descEl.textContent = props.description;
              popupDiv.appendChild(descEl);
            }

            const btnEl = document.createElement('button');
            btnEl.className =
              'mt-2.5 w-full min-h-[44px] py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow transition cursor-pointer flex items-center justify-center';
            btnEl.textContent = 'Otwórz ten teren \u2192';
            btnEl.onclick = (e) => {
              e.stopPropagation();
              onSelectTerritory?.(props.id);
            };
            popupDiv.appendChild(btnEl);

            layer.bindPopup(popupDiv);
          },
        }).addTo(map);

        territoryLayerRef.current = geojsonLayer;

        // Fit bounds on first load OR whenever returning from a territory view to all territories
        if (isReturningToAll) {
          try {
            const bounds = getCollectionBounds(allTerritories);
            if (bounds) {
              const leafletBounds = L.latLngBounds(
                [bounds[1], bounds[0]],
                [bounds[3], bounds[2]]
              );
              map.fitBounds(leafletBounds, { padding: [40, 40] });
              initialFitDoneRef.current = true;
            }
          } catch (e) {
            console.error('Failed to fit collection bounds', e);
          }
        }
        prevTerritoryIdRef.current = null;
      }
    }
  }, [territory, allTerritories, onSelectTerritory, isInvalidIdSpecified]);

  // Update GPS User Position & Accuracy Circle
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!userPosition) {
      if (gpsMarkerRef.current) {
        map.removeLayer(gpsMarkerRef.current);
        gpsMarkerRef.current = null;
      }
      if (gpsCircleRef.current) {
        map.removeLayer(gpsCircleRef.current);
        gpsCircleRef.current = null;
      }
      return;
    }

    const latLng = L.latLng(userPosition.latitude, userPosition.longitude);

    // Marker
    if (!gpsMarkerRef.current) {
      gpsMarkerRef.current = L.marker(latLng, {
        icon: createGpsIcon(),
        zIndexOffset: 1000,
      }).addTo(map);
    } else {
      gpsMarkerRef.current.setLatLng(latLng);
    }

    // Accuracy Circle
    if (userPosition.accuracy && userPosition.accuracy > 0) {
      if (!gpsCircleRef.current) {
        gpsCircleRef.current = L.circle(latLng, {
          radius: userPosition.accuracy,
          color: '#3b82f6',
          weight: 1,
          opacity: 0.4,
          fillColor: '#60a5fa',
          fillOpacity: 0.12,
        }).addTo(map);
      } else {
        gpsCircleRef.current.setLatLng(latLng);
        gpsCircleRef.current.setRadius(userPosition.accuracy);
      }
    }
  }, [userPosition]);

  // Update Route / Bearing Polyline
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!route || !route.coordinates.length) {
      if (routePolylineRef.current) {
        map.removeLayer(routePolylineRef.current);
        routePolylineRef.current = null;
      }
      if (targetMarkerRef.current) {
        map.removeLayer(targetMarkerRef.current);
        targetMarkerRef.current = null;
      }
      return;
    }

    const latLngs = route.coordinates.map((c) => L.latLng(c[0], c[1]));

    if (routePolylineRef.current) {
      routePolylineRef.current.setLatLngs(latLngs);
      routePolylineRef.current.setStyle({
        dashArray: route.isFallback ? '6, 8' : undefined,
        color: route.isFallback ? '#f59e0b' : '#0284c7',
        weight: route.isFallback ? 3 : 5,
        opacity: route.isFallback ? 0.75 : 0.9,
      });
    } else {
      routePolylineRef.current = L.polyline(latLngs, {
        color: route.isFallback ? '#f59e0b' : '#0284c7',
        weight: route.isFallback ? 3 : 5,
        opacity: route.isFallback ? 0.75 : 0.9,
        dashArray: route.isFallback ? '6, 8' : undefined,
      }).addTo(map);
    }

    // Place target marker at end of route (boundary point)
    const targetCoord = latLngs[latLngs.length - 1];
    if (targetCoord) {
      if (!targetMarkerRef.current) {
        targetMarkerRef.current = L.marker(targetCoord, {
          icon: createTargetIcon(),
          zIndexOffset: 990,
        }).addTo(map);
      } else {
        targetMarkerRef.current.setLatLng(targetCoord);
      }
    }
  }, [route]);

  // Recenter GPS
  const handleRecenterGps = useCallback(() => {
    if (!mapRef.current || !userPosition) return;
    mapRef.current.flyTo([userPosition.latitude, userPosition.longitude], 17, {
      duration: 0.8,
    });
  }, [userPosition]);

  // Recenter Territory Bounds
  const handleRecenterTerritory = useCallback(() => {
    if (!mapRef.current) return;
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
    if (territory) {
      const bounds = getTerritoryBounds(territory);
      const leafletBounds = L.latLngBounds(
        [bounds[1], bounds[0]],
        [bounds[3], bounds[2]]
      );
      mapRef.current.flyToBounds(leafletBounds, {
        paddingTopLeft: [25, 25],
        paddingBottomRight: isMobile ? [25, 300] : [50, 50],
        maxZoom: 17,
        duration: 0.8,
      });
    } else if (allTerritories && allTerritories.length > 0) {
      const bounds = getCollectionBounds(allTerritories);
      if (bounds) {
        const leafletBounds = L.latLngBounds(
          [bounds[1], bounds[0]],
          [bounds[3], bounds[2]]
        );
        mapRef.current.flyToBounds(leafletBounds, { padding: [40, 40], maxZoom: 17, duration: 0.8 });
      }
    }
  }, [territory, allTerritories]);

  // Zoom controls
  const handleZoomIn = () => mapRef.current?.zoomIn();
  const handleZoomOut = () => mapRef.current?.zoomOut();

  return (
    <div className="relative w-full h-full">
      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Layer indicator pill in top-left (hidden when invalid ID banner is displayed to prevent collision) */}
      {!isInvalidIdSpecified && (
        <div className="absolute left-3.5 top-20 z-[400] pointer-events-none">
          <span className="px-2.5 py-1 bg-slate-900/85 backdrop-blur-md border border-slate-700/80 text-[11px] font-medium text-slate-300 rounded-lg shadow-md">
            {activeLayer === 'streets' ? 'OpenStreetMap (ulice)' : 'Esri Satelita (orto)'}
          </span>
        </div>
      )}

      {/* Floating Map Controls (Right Side) */}
      <div className="absolute right-3.5 top-20 z-[400] flex flex-col space-y-2.5">
        {/* Layer 1-Click Toggle */}
        <button
          onClick={onToggleLayer}
          className="flex items-center justify-center w-11 h-11 bg-slate-800/90 hover:bg-slate-700 text-white backdrop-blur-md rounded-xl shadow-lg border border-slate-700 transition active:scale-95"
          title={activeLayer === 'streets' ? 'Przełącz na widok satelitarny' : 'Przełącz na widok uliczny'}
          aria-label="Przełącz podkład mapy"
        >
          <Layers className="w-5 h-5 text-blue-400" />
        </button>

        {/* Territory Focus */}
        <button
          onClick={handleRecenterTerritory}
          className="flex items-center justify-center w-11 h-11 bg-slate-800/90 hover:bg-slate-700 text-white backdrop-blur-md rounded-xl shadow-lg border border-slate-700 transition active:scale-95"
          title="Dopasuj widok do terenu"
          aria-label="Wyśrodkuj na terenie"
        >
          <Crosshair className="w-5 h-5 text-emerald-400" />
        </button>

        {/* GPS Re-center */}
        {userPosition && (
          <button
            onClick={handleRecenterGps}
            className="flex items-center justify-center w-11 h-11 bg-slate-800/90 hover:bg-slate-700 text-white backdrop-blur-md rounded-xl shadow-lg border border-slate-700 transition active:scale-95"
            title="Przejdź do mojej pozycji GPS"
            aria-label="Moja pozycja"
          >
            <Navigation className="w-5 h-5 text-sky-400" />
          </button>
        )}

        {/* Zoom In/Out */}
        <div className="flex flex-col bg-slate-800/90 backdrop-blur-md rounded-xl shadow-lg border border-slate-700 overflow-hidden">
          <button
            onClick={handleZoomIn}
            className="flex items-center justify-center w-11 h-11 text-white hover:bg-slate-700 active:bg-slate-600 transition cursor-pointer"
            title="Przybliż"
            aria-label="Przybliż"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <div className="h-[1px] bg-slate-700" />
          <button
            onClick={handleZoomOut}
            className="flex items-center justify-center w-11 h-11 text-white hover:bg-slate-700 active:bg-slate-600 transition cursor-pointer"
            title="Oddal"
            aria-label="Oddal"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
