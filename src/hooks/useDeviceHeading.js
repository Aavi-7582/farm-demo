import { useCallback, useEffect, useRef, useState } from 'react';
import { smoothHeading, seedHeading } from '../utils/compassMath';

// Compass lifecycle states used by the UI.
export const COMPASS_STATUS = {
  WAITING: 'WAITING', // listener attached, no orientation data yet
  ACTIVE: 'ACTIVE', // heading is flowing
  UNAVAILABLE: 'UNAVAILABLE', // device/browser has no orientation support
  PERMISSION_REQUIRED: 'PERMISSION_REQUIRED', // iOS needs a user gesture
};

// UI update rate (~16 Hz). The sensor may fire faster; we throttle state
// updates so the whole app does not rerender at sensor frequency.
const UI_UPDATE_MS = 60;

// Screen rotation (degrees) so the displayed heading matches the phone's "up".
function getScreenAngle() {
  if (typeof window === 'undefined') return 0;
  const orientation = window.screen && window.screen.orientation;
  if (orientation && typeof orientation.angle === 'number') {
    return orientation.angle;
  }
  if (typeof window.orientation === 'number') {
    return window.orientation;
  }
  return 0;
}

// Convert a DeviceOrientationEvent into a clockwise-from-north heading (0..360).
function headingFromEvent(event) {
  // iOS Safari exposes a true compass heading directly.
  if (
    typeof event.webkitCompassHeading === 'number' &&
    !Number.isNaN(event.webkitCompassHeading)
  ) {
    return (event.webkitCompassHeading + getScreenAngle() + 360) % 360;
  }
  // Android / absolute orientation: alpha is counter-clockwise from north.
  if (typeof event.alpha === 'number' && !Number.isNaN(event.alpha)) {
    return (360 - event.alpha + getScreenAngle() + 360) % 360;
  }
  return null;
}

// Dedicated device-heading mechanism.
// Returns { heading, status, requestPermission, supported }.
export default function useDeviceHeading() {
  const [heading, setHeading] = useState(null);
  const [status, setStatus] = useState(COMPASS_STATUS.WAITING);

  const vectorRef = useRef(null); // { sin, cos } smoothed vector
  const lastUpdateRef = useRef(0);
  const gotAbsoluteRef = useRef(false);
  const listenersRef = useRef([]); // [{ type, handler }]
  const fallbackTimerRef = useRef(null);

  const supported =
    typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;

  const needsPermission =
    typeof window !== 'undefined' &&
    typeof DeviceOrientationEvent !== 'undefined' &&
    typeof DeviceOrientationEvent.requestPermission === 'function';

  const handleOrientation = useCallback((event) => {
    const isAbsolute =
      event.type === 'deviceorientationabsolute' || event.absolute === true;
    if (isAbsolute) {
      gotAbsoluteRef.current = true;
    } else if (gotAbsoluteRef.current) {
      // Absolute data already flowing; ignore non-absolute fallback events.
      return;
    }

    const raw = headingFromEvent(event);
    if (raw == null) return;

    // Circular smoothing on the sin/cos vector (never arithmetic averaging).
    if (!vectorRef.current) {
      vectorRef.current = seedHeading(raw);
    } else {
      const { sin, cos } = vectorRef.current;
      vectorRef.current = smoothHeading(sin, cos, raw, 0.25);
    }

    const now = Date.now();
    if (now - lastUpdateRef.current < UI_UPDATE_MS) return;
    lastUpdateRef.current = now;

    setHeading(vectorRef.current.heading);
    setStatus(COMPASS_STATUS.ACTIVE);
  }, []);

  const stopListening = useCallback(() => {
    listenersRef.current.forEach(({ type, handler }) => {
      window.removeEventListener(type, handler, true);
    });
    listenersRef.current = [];
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, []);

  const startListening = useCallback(() => {
    if (typeof window === 'undefined') return;
    stopListening();

    const hasAbsolute = 'ondeviceorientationabsolute' in window;
    const absoluteType = 'deviceorientationabsolute';

    const add = (type) => {
      window.addEventListener(type, handleOrientation, true);
      listenersRef.current.push({ type, handler: handleOrientation });
    };

    if (hasAbsolute) {
      add(absoluteType);
      // If absolute never produces data, fall back to the generic event.
      fallbackTimerRef.current = setTimeout(() => {
        if (!gotAbsoluteRef.current) add('deviceorientation');
      }, 1500);
    } else {
      add('deviceorientation');
    }

    setStatus((prev) =>
      prev === COMPASS_STATUS.ACTIVE ? prev : COMPASS_STATUS.WAITING
    );
  }, [handleOrientation, stopListening]);

  const requestPermission = useCallback(async () => {
    if (!needsPermission) {
      startListening();
      return true;
    }
    try {
      const result = await DeviceOrientationEvent.requestPermission();
      if (result === 'granted') {
        startListening();
        return true;
      }
      setStatus(COMPASS_STATUS.PERMISSION_REQUIRED);
      return false;
    } catch (err) {
      setStatus(COMPASS_STATUS.PERMISSION_REQUIRED);
      return false;
    }
  }, [needsPermission, startListening]);

  useEffect(() => {
    if (!supported) {
      setStatus(COMPASS_STATUS.UNAVAILABLE);
      return undefined;
    }
    if (needsPermission) {
      // iOS requires an explicit user gesture before data flows.
      setStatus(COMPASS_STATUS.PERMISSION_REQUIRED);
      return stopListening;
    }
    startListening();
    return stopListening;
  }, [supported, needsPermission, startListening, stopListening]);

  return { heading, status, requestPermission, supported, needsPermission };
}