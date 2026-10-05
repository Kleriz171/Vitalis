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

// Night-map palette: red for the most urgent, amber next, cool blue for the rest.
const priorityColor = (p: number) => (p === 1 ? '#ff4d4d' : p === 2 ? '#ff9f2e' : p === 3 ? '#f5c542' : '#5aa9ff');
const TEAL = '#21d1b8';

// Popups take a DOM node, not an HTML string: AED names come from the public.
const popup = (title: string, sub?: string) => {
  const el = document.createElement('div');
  el.style.cssText = "font: 13px/1.4 'Inter Variable', system-ui, sans-serif; min-width: 140px";
  const t = document.createElement('div');
  t.style.fontWeight = '600';
  t.textContent = title;
  el.appendChild(t);
  if (sub) {
    const s = document.createElement('div');
    s.style.color = 'hsl(182 12% 62%)';
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
    html: `<div style="width:22px;height:22px;border-radius:4px;display:grid;place-items:center;background:rgba(5,16,15,.85);color:${verified ? TEAL : '#7f9896'};border:1.5px solid ${verified ? TEAL : '#7f9896'};box-shadow:0 0 10px ${verified ? 'rgba(33,209,184,.45)' : 'transparent'}"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg></div>`,
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
      const color = priorityColor(e.priority);
      const size = selected ? 20 : 16;
      // Calls still waiting for a responder pulse (sonar); the selected one gets a target ring.
      const m = L.marker([lat, lng], {
        icon: L.divIcon({
          className: '',
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
          html: `<div class="${e.status === 'pending' ? 'sonar' : ''}" style="width:${size}px;height:${size}px;border-radius:9999px;background:${color};color:${color};border:2px solid rgba(5,16,15,.9);box-shadow:0 0 14px ${color}${selected ? `,0 0 0 4px rgba(5,16,15,.9),0 0 0 6px ${TEAL}` : ''}"></div>`,
        }),
        zIndexOffset: selected ? 1000 : e.priority === 1 ? 500 : 0,
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
          radius: 6, fillColor: TEAL, color: '#05100f', weight: 2, fillOpacity: 1, className: 'drop-shadow-[0_0_6px_#21d1b8]',
        }).bindTooltip(popup('Responder', 'Live position'), { direction: 'top' }),
      );
    }
  }, [responders]);

  return (
    <div className="map-night relative w-full h-full min-h-[420px] rounded-sm overflow-hidden">
      <div ref={ref} className="absolute inset-0" />
      {/* Edge vignette so the map sinks into the panel. */}
      <div className="pointer-events-none absolute inset-0 z-[401] shadow-[inset_0_0_80px_20px_hsl(var(--background))]" />
      <div className="absolute left-3 bottom-3 z-[402] flex flex-wrap gap-x-4 gap-y-1 rounded-sm bg-background/85 backdrop-blur border border-border px-3 py-2 font-mono text-[11px] tracking-wide text-muted-foreground">
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full bg-[#ff4d4d] shadow-[0_0_8px_#ff4d4d]" />Priority 1</span>
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full bg-[#ff9f2e]" />Priority 2+</span>
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full bg-[#21d1b8] shadow-[0_0_8px_#21d1b8]" />Responder</span>
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-[2px] border border-[#21d1b8]" />AED</span>
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full border-2 border-[#ff4d4d]/70" />Pulsing: no responder yet</span>
      </div>
    </div>
  );
};

export default MapView;
