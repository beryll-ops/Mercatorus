import { useState, useEffect, useCallback, useRef } from 'react';
import type { GPSPosition, GPSStatus } from '../types';

interface UseGeolocationReturn {
  position: GPSPosition | null;
  status: GPSStatus;
  errorMessage: string | null;
  requestPermission: () => Promise<boolean>;
  setMockPosition: (pos: GPSPosition | null) => void;
  isMock: boolean;
  permissionState: PermissionState | null;
  isPermissionModalOpen: boolean;
  setIsPermissionModalOpen: (open: boolean) => void;
}

export function useGeolocation(): UseGeolocationReturn {
  const [position, setPosition] = useState<GPSPosition | null>(null);
  const [status, setStatus] = useState<GPSStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mockPosition, setMockPositionState] = useState<GPSPosition | null>(null);
  const [permissionState, setPermissionState] = useState<PermissionState | null>(null);
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
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
      setPermissionState('granted');
      setIsPermissionModalOpen(false);
    },
    [mockPosition]
  );

  const handleError = useCallback(
    (err: GeolocationPositionError) => {
      if (mockPosition) return;
      console.warn('Geolocation error:', err.code, err.message);
      if (err.code === err.PERMISSION_DENIED) {
        setStatus('denied');
        setPermissionState('denied');
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
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('unavailable');
      setErrorMessage('Twoja przeglądarka nie obsługuje geolokalizacji GPS.');
      return;
    }

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
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

  // Explicit user trigger for re-prompting or showing permission modal
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('unavailable');
      setErrorMessage('Twoja przeglądarka nie obsługuje geolokalizacji GPS.');
      return false;
    }

    // Set immediate loading state for clear visual feedback
    setStatus('loading');
    setErrorMessage(null);

    // 1. Inspect Permissions API if available
    let currentPerm: PermissionState | null = null;
    if ('permissions' in navigator && navigator.permissions?.query) {
      try {
        const queryRes = await navigator.permissions.query({ name: 'geolocation' });
        currentPerm = queryRes.state;
        setPermissionState(queryRes.state);
      } catch {
        // Permissions API error fallback
      }
    }

    // 2. If browser security policy permanently marked it as denied,
    // the browser WILL NOT trigger the native prompt again from JavaScript.
    // Immediately open the helper guide modal so the user can easily unblock it.
    if (currentPerm === 'denied') {
      setStatus('denied');
      setErrorMessage('Odmowa dostępu do lokalizacji GPS. Włącz uprawnienia w przeglądarce.');
      setIsPermissionModalOpen(true);
      return false;
    }

    // 3. Clear existing watch and execute getCurrentPosition directly inside the user click gesture
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    return new Promise<boolean>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          handleSuccess(pos);
          startWatching();
          resolve(true);
        },
        (err) => {
          handleError(err);
          if (err.code === err.PERMISSION_DENIED) {
            // Once denied, show guide modal immediately
            setIsPermissionModalOpen(true);
          }
          resolve(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    });
  }, [handleSuccess, handleError, startWatching]);

  // Initial setup and Permissions API listener
  useEffect(() => {
    if (mockPosition) return;

    let isMounted = true;
    let cleanupPermListener: (() => void) | null = null;

    const checkAndInit = async () => {
      if ('permissions' in navigator && navigator.permissions?.query) {
        try {
          const perm = await navigator.permissions.query({ name: 'geolocation' });
          if (!isMounted) return;
          setPermissionState(perm.state);

          if (perm.state === 'denied') {
            setStatus('denied');
            setErrorMessage('Odmowa dostępu do lokalizacji GPS. Włącz uprawnienia w przeglądarce.');
            return;
          }

          startWatching();

          const handleChange = () => {
            if (!isMounted) return;
            setPermissionState(perm.state);
            if (perm.state === 'granted') {
              setIsPermissionModalOpen(false);
              startWatching();
            } else if (perm.state === 'denied') {
              setStatus('denied');
              if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
                watchIdRef.current = null;
              }
            }
          };

          perm.addEventListener('change', handleChange);
          cleanupPermListener = () => perm.removeEventListener('change', handleChange);
          return;
        } catch {
          // Permissions API unsupported or failed, fallback to normal watchPosition
        }
      }

      if (isMounted) {
        startWatching();
      }
    };

    checkAndInit();

    // Re-check permission when user returns from browser/system settings to tab
    const handleVisibilityOrFocus = async () => {
      if (document.visibilityState === 'visible' && 'permissions' in navigator && navigator.permissions?.query) {
        try {
          const perm = await navigator.permissions.query({ name: 'geolocation' });
          if (!isMounted) return;
          setPermissionState(perm.state);
          if (perm.state === 'granted') {
            setIsPermissionModalOpen(false);
            startWatching();
          }
        } catch {
          // Ignore
        }
      }
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      isMounted = false;
      if (cleanupPermListener) {
        cleanupPermListener();
      }
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [startWatching, mockPosition]);

  return {
    position,
    status,
    errorMessage,
    requestPermission,
    setMockPosition,
    isMock: mockPosition !== null,
    permissionState,
    isPermissionModalOpen,
    setIsPermissionModalOpen,
  };
}
