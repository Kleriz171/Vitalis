import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface MapIncident {
  _id: string;
  type: string;
  priority: number;
  status: string;
  location?: { type: 'Point'; coordinates: [number, number] };
}

export interface MapAed {
  id: string;
  name: string;
  placement?: string;
  verified: boolean;
  coordinates: [number, number];
}

export interface MapResponder {
  userId: string;
  coordinates: [number, number];
}

const TIRANA: [number, number] = [41.3275, 19.8189];

export const TYPE_LABEL: Record<string, string> = {
  cardiac: 'Cardiac arrest',
  medical: 'Medical emergency',
  trauma: 'Injury',
  blood_needed: 'Blood needed',
  rare_medicine: 'Medicine needed',
  other: 'Emergency',
};

const priorityColor = (p: number) => (p === 1 ? '#dc2626' : p === 2 ? '#ea580c' : p === 3 ? '#ca8a04' : '#0284c7');

// Popups take a DOM node, not an HTML string: AED names come from the public.
const popup = (title: string, sub?: string) => {
  const el = document.createElement('div');
  el.style.cssText = 'font: 13px/1.4 system-ui, sans-serif; min-width: 140px';
  const t = document.createElement('div');
  t.style.fontWeight = '600';
  t.textContent = title;
  el.appendChild(t);
  if (sub) {
    const s = document.createElement('div');
    s.style.color = '#475569';
    s.textContent = sub;
    el.appendChild(s);
  }
  return el;
};

const aedIcon = (verified: boolean) =>
  L.divIcon({
    className: '',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    html: `<div style="width:22px;height:22px;border-radius:6px;display:grid;place-items:center;background:${verified ? '#15803d' : '#64748b'};color:#fff;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.3)"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg></div>`,
  });

interface Props {
  incidents: MapIncident[];
  aeds?: MapAed[];
  responders?: MapResponder[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}

const MapView = ({ incidents, aeds = [], responders = [], selectedId, onSelect }: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const incidentLayer = useRef<L.LayerGroup | null>(null);
  const aedLayer = useRef<L.LayerGroup | null>(null);
  const responderLayer = useRef<L.LayerGroup | null>(null);
  const fitted = useRef(false);

  useEffect(() => {
    if (!ref.current || map.current) return;
    map.current = L.map(ref.current, { center: TIRANA, zoom: 13 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map.current);
    aedLayer.current = L.layerGroup().addTo(map.current);
    incidentLayer.current = L.layerGroup().addTo(map.current);
    responderLayer.current = L.layerGroup().addTo(map.current);
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  const located = useMemo(() => incidents.filter(e => e.location?.coordinates?.length === 2), [incidents]);

  useEffect(() => {
    const layer = incidentLayer.current;
    if (!layer) return;
    layer.clearLayers();
    for (const e of located) {
      const [lng, lat] = e.location!.coordinates;
      const selected = e._id === selectedId;
      const m = L.circleMarker([lat, lng], {
        radius: selected ? 13 : 10,
        fillColor: priorityColor(e.priority),
        color: selected ? '#0f172a' : '#fff',
        weight: selected ? 3 : 2,
        fillOpacity: 0.95,
      });
      m.bindTooltip(popup(TYPE_LABEL[e.type] ?? 'Emergency', e.status.replace('_', ' ')), { direction: 'top', offset: [0, -8] });
      if (onSelect) m.on('click', () => onSelect(e._id));
      layer.addLayer(m);
    }
    // Frame the incidents once; after that the operator controls the viewport.
    if (!fitted.current && located.length && map.current) {
      fitted.current = true;
      const b = L.latLngBounds(located.map(e => [e.location!.coordinates[1], e.location!.coordinates[0]] as [number, number]));
      map.current.fitBounds(b.pad(0.4), { maxZoom: 15 });
    }
  }, [located, selectedId, onSelect]);

  useEffect(() => {
    if (!selectedId || !map.current) return;
    const e = located.find(x => x._id === selectedId);
    if (e) map.current.panTo([e.location!.coordinates[1], e.location!.coordinates[0]], { animate: true });
  }, [selectedId, located]);

  useEffect(() => {
    const layer = aedLayer.current;
    if (!layer) return;
    layer.clearLayers();
    for (const a of aeds) {
      const m = L.marker([a.coordinates[1], a.coordinates[0]], { icon: aedIcon(a.verified), keyboard: false });
      m.bindTooltip(popup(`AED · ${a.name}`, a.verified ? a.placement : 'Unverified report'), { direction: 'top', offset: [0, -10] });
      layer.addLayer(m);
    }
  }, [aeds]);

  useEffect(() => {
    const layer = responderLayer.current;
    if (!layer) return;
    layer.clearLayers();
    for (const r of responders) {
      layer.addLayer(
        L.circleMarker([r.coordinates[1], r.coordinates[0]], {
          radius: 7, fillColor: '#0d9488', color: '#fff', weight: 2, fillOpacity: 1,
        }).bindTooltip(popup('Responder', 'Live position'), { direction: 'top' }),
      );
    }
  }, [responders]);

  return (
    <div className="relative w-full h-full min-h-[420px] rounded-xl overflow-hidden">
      <div ref={ref} className="absolute inset-0" />
      <div className="absolute left-3 bottom-3 z-[400] flex flex-wrap gap-x-4 gap-y-1 rounded-lg bg-card/95 border border-border px-3 py-2 text-xs shadow-sm">
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full bg-red-600" />Priority 1</span>
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full bg-orange-600" />Priority 2</span>
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full bg-teal-600" />Responder</span>
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm bg-green-700" />AED</span>
      </div>
    </div>
  );
};

export default MapView;
