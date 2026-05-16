import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface IncidentMarker {
  _id: string;
  type: string;
  priority: number;
  status: string;
  location?: { type: 'Point'; coordinates: [number, number] };
}

const TIRANA: [number, number] = [41.3275, 19.8189];

const priorityColor = (p: number) => {
  if (p === 1) return '#dc2626';
  if (p === 2) return '#f97316';
  if (p === 3) return '#eab308';
  return '#0ea5e9';
};

const MapView = ({ emergencies }: { emergencies: IncidentMarker[] }) => {
  const ref = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!ref.current || map.current) return;
    map.current = L.map(ref.current, {
      center: TIRANA,
      zoom: 12,
      zoomControl: true,
      attributionControl: true,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  const valid = useMemo(
    () => emergencies.filter((e) => e.location?.coordinates && e.location.coordinates.length === 2),
    [emergencies]
  );

  useEffect(() => {
    if (!layer.current) return;
    layer.current.clearLayers();
    valid.forEach((e) => {
      const [lng, lat] = e.location!.coordinates;
      const color = priorityColor(e.priority);
      const marker = L.circleMarker([lat, lng], {
        radius: 9,
        fillColor: color,
        color: '#ffffff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.9,
      });
      marker.bindPopup(
        `<div style="font-family:system-ui;font-size:12px">
          <div style="font-weight:700;text-transform:capitalize">${e.type.replace('_', ' ')} &middot; P${e.priority}</div>
          <div style="color:#64748b;text-transform:capitalize;margin-top:2px">${e.status.replace('_', ' ')}</div>
        </div>`
      );
      layer.current?.addLayer(marker);
    });
    if (valid.length && map.current) {
      const bounds = L.latLngBounds(valid.map((e) => [e.location!.coordinates[1], e.location!.coordinates[0]]));
      map.current.fitBounds(bounds.pad(0.2), { maxZoom: 14 });
    }
  }, [valid]);

  return (
    <div className="w-full h-full min-h-[60vh] rounded-2xl overflow-hidden relative">
      <div ref={ref} className="absolute inset-0" />
      {!valid.length ? (
        <div className="absolute inset-x-0 bottom-3 mx-auto w-fit z-[400] bg-card/95 border border-border rounded-full px-3 py-1.5 text-xs text-muted-foreground shadow">
          No active incidents with coordinates
        </div>
      ) : null}
    </div>
  );
};

export default MapView;
