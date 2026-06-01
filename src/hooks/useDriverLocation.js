/**
 * useDriverLocation
 * Tracks driver GPS position, saves to DriverShift record for manager visibility.
 * Returns { position, error, watching, startWatching, stopWatching }
 */
import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

export default function useDriverLocation({ shiftId, autoStart = false } = {}) {
  const [position, setPosition] = useState(null); // { lat, lng, accuracy, timestamp }
  const [error, setError] = useState(null);
  const [watching, setWatching] = useState(false);
  const watchIdRef = useRef(null);
  const lastSaveRef = useRef(0);

  function startWatching() {
    if (!navigator.geolocation) {
      setError('GPS not available on this device');
      return;
    }
    setError(null);
    setWatching(true);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const loc = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: new Date().toISOString(),
        };
        setPosition(loc);

        // Save to DriverShift every 30s to keep it fresh for the manager
        const now = Date.now();
        if (shiftId && now - lastSaveRef.current > 30000) {
          lastSaveRef.current = now;
          base44.entities.DriverShift.update(shiftId, {
            driver_lat: loc.lat,
            driver_lng: loc.lng,
            location_updated_at: loc.timestamp,
          }).catch(() => {}); // fire-and-forget
        }
      },
      (err) => {
        setError(err.message || 'Unable to get location');
        setWatching(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  }

  function stopWatching() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setWatching(false);
  }

  useEffect(() => {
    if (autoStart) startWatching();
    return () => stopWatching();
  }, [autoStart, shiftId]);

  return { position, error, watching, startWatching, stopWatching };
}