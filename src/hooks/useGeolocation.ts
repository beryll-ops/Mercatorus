import { useState, useEffect, useCallback, useRef } from 'react';
import type { GPSPosition, GPSStatus } from '../types';

interface UseGeolocationReturn {
  position: GPSPosition | null;
  status: GPSStatus;
  errorMessage: string | null;
  requestPermission: () => void;
  setMockPosition: (pos: GPSPosition | null) => void;
  isMock: boolean;
}

export function useGeolocation(): UseGeolocationReturn {
  const [position, setPosition] = useState<GPSPosition | null>(null);
  const [status, setStatus] = useState<GPSStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mockPosition, setMockPositionState] = useState<GPSPosition | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const setMockPosition = useCallback((pos: GPSPosition | null) => {
    setMockPositionState(pos);
    if (pos) {
      setPosition(pos);
      setStatus('mock');
      setErrorMessage(null);
    } else {
      setPosition(null);
      setStatus('loading');
    }
  }, []);

  const handleSuccess = useCallback(
    (pos: GeolocationPosition) => {
      if (mockPosition) return; // Keep mock if user enabled it
      setPosition({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        heading: pos.coords.heading,
        speed: pos.coords.speed,
        timestamp: pos.timestamp,
      });
      setStatus('granted');
      setErrorMessage(null);
    },
    [mockPosition]
  );

  const handleError = useCallback(
    (err: GeolocationPositionError) => {
      if (mockPosition) return;
      console.warn('Geolocation error:', err.code, err.message);
      if (err.code === err.PERMISSION_DENIED) {
        setStatus('denied');
        setErrorMessage('Odmowa dostępu do lokalizacji GPS. Włącz uprawnienia w przeglądarce.');
      } else if (err.code === err.POSITION_UNAVAILABLE) {
        setStatus('unavailable');
        setErrorMessage('Sygnał GPS jest obecnie niedostępny.');
      } else if (err.code === err.TIMEOUT) {
        setStatus('unavailable');
        setErrorMessage('Przekroczono limit czasu oczekiwania na sygnał GPS.');
      } else {
        setStatus('unavailable');
        setErrorMessage(err.message || 'Nieznany błąd geolokalizacji.');
      }
    },
    [mockPosition]
  );

  const startWatching = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus('unavailable');
      setErrorMessage('Twoja przeglądarka nie obsługuje geolokalizacji GPS.');
      return;
    }

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    try {
      watchIdRef.current = navigator.geolocation.watchPosition(
        handleSuccess,
        handleError,
        {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 12000,
        }
      );
    } catch (e) {
      console.error('Failed to initiate watchPosition', e);
      setStatus('unavailable');
      setErrorMessage('Nie udało się uruchomić śledzenia GPS.');
    }
  }, [handleSuccess, handleError]);

  useEffect(() => {
    if (!mockPosition) {
      startWatching();
    }
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [startWatching, mockPosition]);

  return {
    position,
    status,
    errorMessage,
    requestPermission: startWatching,
    setMockPosition,
    isMock: mockPosition !== null,
  };
}
