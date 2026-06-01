import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Navigation, MapPin } from 'lucide-react';

// Fix Leaflet default icons broken by webpack/vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom driver icon (blue bike)
const driverIcon = L.divIcon({
  html: `<div style="background:#2563eb;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);font-size:18px">🚴</div>`,
  className: '',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -20],
});

// Custom destination icon (red pin)
const destIcon = L.divIcon({
  html: `<div style="background:#dc2626;width:32px;height:32px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)"></div>`,
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

// Auto-fit bounds when markers change
function FitBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 0) {
      const bounds = L.latLngBounds(positions);
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [positions.join(',')]);
  return null;
}

/**
 * DriverLocationMap — used in the DRIVER portal.
 * Shows driver's current GPS position + order destination.
 * Props: order (DeliveryOrder), driverPosition { lat, lng }
 */
export function DriverLocationMap({ order, driverPosition }) {
  const defaultCenter = [24.7136, 46.6753]; // Riyadh fallback

  const destCoords = order?.dest_lat && order?.dest_lng
    ? [parseFloat(order.dest_lat), parseFloat(order.dest_lng)]
    : null;

  const driverCoords = driverPosition
    ? [driverPosition.lat, driverPosition.lng]
    : null;

  const positions = [driverCoords, destCoords].filter(Boolean);
  const center = driverCoords || destCoords || defaultCenter;

  return (
    <div className="rounded-2xl overflow-hidden border shadow-sm" style={{ height: 220 }}>
      <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='© OpenStreetMap'
        />
        {driverCoords && (
          <Marker position={driverCoords} icon={driverIcon}>
            <Popup>📍 Your Location</Popup>
          </Marker>
        )}
        {destCoords && (
          <Marker position={destCoords} icon={destIcon}>
            <Popup>🏠 {order?.customer_name || 'Destination'}<br />{order?.customer_address}</Popup>
          </Marker>
        )}
        {driverCoords && destCoords && (
          <Polyline positions={[driverCoords, destCoords]} color="#2563eb" weight={3} dashArray="8,8" />
        )}
        {positions.length > 0 && <FitBounds positions={positions} />}
      </MapContainer>
    </div>
  );
}

/**
 * ManagerLiveMap — used in Delivery Operations tab.
 * Shows ALL active drivers + their active orders on one map.
 * Props: driverLocations [{ driver_id, driver_name, lat, lng, order? }]
 */
export function ManagerLiveMap({ driverLocations = [] }) {
  const defaultCenter = [24.7136, 46.6753];
  const hasLocations = driverLocations.some(d => d.lat && d.lng);

  if (!hasLocations) {
    return (
      <div className="rounded-2xl border bg-slate-50 flex flex-col items-center justify-center p-8 text-center" style={{ height: 300 }}>
        <div className="text-4xl mb-3">🗺️</div>
        <p className="font-semibold text-slate-700">No Active Driver Locations</p>
        <p className="text-sm text-slate-500 mt-1">Drivers appear here when they share their GPS location</p>
      </div>
    );
  }

  const allPositions = driverLocations.filter(d => d.lat && d.lng).map(d => [d.lat, d.lng]);

  return (
    <div className="rounded-2xl overflow-hidden border shadow-sm" style={{ height: 300 }}>
      <MapContainer center={defaultCenter} zoom={12} style={{ height: '100%', width: '100%' }} zoomControl={true}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='© OpenStreetMap'
        />
        {driverLocations.filter(d => d.lat && d.lng).map(d => (
          <Marker key={d.driver_id} position={[d.lat, d.lng]} icon={driverIcon}>
            <Popup>
              <div className="text-sm font-semibold">{d.driver_name}</div>
              {d.order && <div className="text-xs text-slate-500">📦 {d.order.order_number}</div>}
              {d.order && <div className="text-xs text-slate-500">→ {d.order.customer_address}</div>}
            </Popup>
          </Marker>
        ))}
        {driverLocations.filter(d => d.order?.dest_lat && d.order?.dest_lng).map(d => (
          <React.Fragment key={`dest-${d.driver_id}`}>
            <Marker position={[parseFloat(d.order.dest_lat), parseFloat(d.order.dest_lng)]} icon={destIcon}>
              <Popup>🏠 {d.order.customer_name}<br />{d.order.customer_address}</Popup>
            </Marker>
            <Polyline
              positions={[[d.lat, d.lng], [parseFloat(d.order.dest_lat), parseFloat(d.order.dest_lng)]]}
              color="#2563eb" weight={2} dashArray="6,6"
            />
          </React.Fragment>
        ))}
        {allPositions.length > 0 && <FitBounds positions={allPositions} />}
      </MapContainer>
    </div>
  );
}