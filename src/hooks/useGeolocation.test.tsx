// @vitest-environment jsdom
import { act } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { useGeolocation } from './useGeolocation';

describe('useGeolocation Hook', () => {
  const originalGeolocation = navigator.geolocation;
  const originalPermissions = navigator.permissions;
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    vi.restoreAllMocks();
    // @ts-expect-error react act flag
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (container) {
      document.body.removeChild(container);
      container = null;
    }
    Object.defineProperty(navigator, 'geolocation', {
      value: originalGeolocation,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(navigator, 'permissions', {
      value: originalPermissions,
      writable: true,
      configurable: true,
    });
  });

  it('handles requestPermission rejection by opening modal', async () => {
    const mockGetCurrentPosition = vi.fn((_success, error) => {
      error({
        code: 1, // PERMISSION_DENIED
        message: 'User denied Geolocation',
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      });
    });

    Object.defineProperty(navigator, 'geolocation', {
      value: {
        watchPosition: vi.fn(),
        clearWatch: vi.fn(),
        getCurrentPosition: mockGetCurrentPosition,
      },
      writable: true,
      configurable: true,
    });

    let hookResult: ReturnType<typeof useGeolocation> | null = null;
    function TestComponent() {
      hookResult = useGeolocation();
      return null;
    }

    const root = createRoot(container!);
    await act(async () => {
      root.render(<TestComponent />);
    });

    expect(hookResult).not.toBeNull();
    expect(hookResult!.isPermissionModalOpen).toBe(false);

    let success = true;
    await act(async () => {
      success = await hookResult!.requestPermission();
    });

    expect(success).toBe(false);
    expect(hookResult!.status).toBe('denied');
    expect(hookResult!.isPermissionModalOpen).toBe(true);

    await act(async () => {
      root.unmount();
    });
  });

  it('handles successful geolocation acquisition', async () => {
    const mockGetCurrentPosition = vi.fn((success) => {
      success({
        coords: {
          latitude: 52.605,
          longitude: 15.905,
          accuracy: 10,
          heading: null,
          speed: null,
        },
        timestamp: 999999,
      });
    });

    Object.defineProperty(navigator, 'geolocation', {
      value: {
        watchPosition: vi.fn(),
        clearWatch: vi.fn(),
        getCurrentPosition: mockGetCurrentPosition,
      },
      writable: true,
      configurable: true,
    });

    let hookResult: ReturnType<typeof useGeolocation> | null = null;
    function TestComponent() {
      hookResult = useGeolocation();
      return null;
    }

    const root = createRoot(container!);
    await act(async () => {
      root.render(<TestComponent />);
    });

    let success = false;
    await act(async () => {
      success = await hookResult!.requestPermission();
    });

    expect(success).toBe(true);
    expect(hookResult!.status).toBe('granted');
    expect(hookResult!.position?.latitude).toBe(52.605);
    expect(hookResult!.position?.longitude).toBe(15.905);
    expect(hookResult!.isPermissionModalOpen).toBe(false);

    await act(async () => {
      root.unmount();
    });
  });
});
