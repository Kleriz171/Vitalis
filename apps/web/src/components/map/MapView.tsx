import { useEffect, useMemo, useRef, useState } from 'react';
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

// Red for the most urgent, amber next, slate for the rest. Teal is Vitalis: responders, AEDs.
const priorityColor = (p: number) => (p === 1 ? '#D92D2D' : p === 2 ? '#E07A10' : '#5B6B69');
const TEAL = '#14A897';
const GREEN = '#0C5D57';

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
    s.style.color = '#5B6B69';
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
    html: `<div style="width:22px;height:22px;border-radius:6px;display:grid;place-items:center;background:#fff;color:${verified ? GREEN : '#8A9694'};border:1.5px solid ${verified ? GREEN : '#B9C1BF'};box-shadow:0 1px 3px rgba(12,93,87,.25)"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg></div>`,
  });

interface Props {
  incidents: MapIncident[];
  aeds?: MapAed[];
  responders?: MapResponder[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** Keep every active call in frame as calls come and go. */
  follow?: boolean;
}

const MapView = ({ incidents, aeds = [], responders = [], selectedId, onSelect, follow = false }: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const incidentLayer = useRef<L.LayerGroup | null>(null);
  const aedLayer = useRef<L.LayerGroup | null>(null);
  const responderLayer = useRef<L.LayerGroup | null>(null);
  const fitted = useRef(false);
  const [target, setTarget] = useState<{ x: number; y: number } | null>(null);

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
      const size = selected ? 22 : 18;
      // A pin: coloured disc with a white core. Waiting for a responder, it pulses.
      const m = L.marker([lat, lng], {
        icon: L.divIcon({
          className: '',
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
          html: `<div class="${e.status === 'pending' ? 'pin-pulse' : ''}" style="position:relative;isolation:isolate;width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:3px solid #fff;box-shadow:0 2px 6px rgba(19,32,31,.35)${selected ? `,0 0 0 3px ${color}` : ''}"></div>`,
        }),
        zIndexOffset: selected ? 1000 : e.priority === 1 ? 500 : 0,
      });
      m.bindTooltip(popup(TYPE_LABEL[e.type] ?? 'Emergency', e.status.replace('_', ' ')), { direction: 'top', offset: [0, -8] });
      if (onSelect) m.on('click', () => onSelect(e._id));
      layer.addLayer(m);
    }
    // Frame the incidents once; after that the operator steers (or Follow does).
    if (!fitted.current && located.length && map.current) {
      fitted.current = true;
      const b = L.latLngBounds(located.map(e => [e.location!.coordinates[1], e.location!.coordinates[0]] as [number, number]));
      map.current.fitBounds(b.pad(0.4), { maxZoom: 15 });
    }
  }, [located, selectedId, onSelect]);

  // Follow: whenever calls come or go, frame them all again.
  useEffect(() => {
    if (!follow || !located.length || !map.current) return;
    const b = L.latLngBounds(located.map(e => [e.location!.coordinates[1], e.location!.coordinates[0]] as [number, number]));
    map.current.flyToBounds(b.pad(0.4), { maxZoom: 15, duration: 0.6 });
  }, [follow, located]);

  const selectedPoint = located.find(x => x._id === selectedId)?.location!.coordinates ?? null;

  useEffect(() => {
    const m = map.current;
    if (!m || !selectedPoint) { setTarget(null); return; }
    const place = () => {
      const p = m.latLngToContainerPoint([selectedPoint[1], selectedPoint[0]]);
      setTarget({ x: p.x, y: p.y });
    };
    m.panTo([selectedPoint[1], selectedPoint[0]], { animate: true });
    place();
    m.on('move zoom resize', place);
    return () => { m.off('move zoom resize', place); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPoint?.[0], selectedPoint?.[1]]);

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
          radius: 6, fillColor: TEAL, color: '#fff', weight: 2.5, fillOpacity: 1,
        }).bindTooltip(popup('Responder', 'Live position'), { direction: 'top' }),
      );
      // Roughly what they can reach on foot in about five minutes.
      layer.addLayer(L.circle([r.coordinates[1], r.coordinates[0]], {
        radius: 400, color: TEAL, weight: 1, opacity: 0.55, dashArray: '4 5', fillColor: TEAL, fillOpacity: 0.05, interactive: false,
      }));
    }
  }, [responders]);

  return (
    <div className="map-brand relative w-full h-full min-h-[420px]">
      <div ref={ref} className="absolute inset-0" />
      {/* Crosshairs through the selected call, with its coordinates for the ambulance crew. */}
      {target && (
        <div className="pointer-events-none absolute inset-0 z-[401]" aria-hidden>
          <div className="absolute left-0 right-0 h-px bg-[#0C5D57]/35" style={{ top: target.y }} />
          <div className="absolute top-0 bottom-0 w-px bg-[#0C5D57]/35" style={{ left: target.x }} />
          <div className="absolute w-12 h-12 -ml-6 -mt-6 rounded-full border border-[#0C5D57]/50" style={{ left: target.x, top: target.y }} />
        </div>
      )}
      {selectedPoint && (
        <div className="absolute left-14 top-3 z-[402] rounded-lg bg-white/95 border border-border px-3 py-2 shadow-sm">
          <div className="text-[11px] text-muted-foreground">Selected call</div>
          <div className="code text-[13px] font-medium text-foreground">{selectedPoint[1].toFixed(5)}° N, {selectedPoint[0].toFixed(5)}° E</div>
        </div>
      )}
      <div className="absolute left-3 bottom-3 z-[402] flex flex-wrap gap-x-4 gap-y-1 rounded-lg bg-white/95 border border-border px-3 py-2 text-[12px] text-muted-foreground shadow-sm">
        <span className="flex items-center gap-1.5"><i className="w-3 h-3 rounded-full bg-[#D92D2D] border-2 border-white shadow" />Priority 1</span>
        <span className="flex items-center gap-1.5"><i className="w-3 h-3 rounded-full bg-[#E07A10] border-2 border-white shadow" />Priority 2</span>
        <span className="flex items-center gap-1.5"><i className="w-3 h-3 rounded-full bg-[#14A897] border-2 border-white shadow" />Responder, 5-min reach</span>
        <span className="flex items-center gap-1.5"><i className="w-3 h-3 rounded-[4px] bg-white border border-[#0C5D57]" />Defibrillator</span>
      </div>
    </div>
  );
};

export default MapView;
