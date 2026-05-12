import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = (import.meta.env.VITE_MAPBOX_TOKEN as string) ?? '';

const MapView = ({ emergencies }: { emergencies: any[] }) => {
  const ref = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);

  useEffect(() => {
    if (!ref.current || map.current) return;
    if (!mapboxgl.accessToken) return;
    map.current = new mapboxgl.Map({
      container: ref.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [23.7275, 37.9838],
      zoom: 11,
    });
  }, []);

  useEffect(() => {
    if (!map.current) return;
    markers.current.forEach(m => m.remove());
    markers.current = [];
    emergencies.forEach(e => {
      const el = document.createElement('div');
      el.style.cssText =
        'width:12px;height:12px;border-radius:50%;background:#ff4d8d;box-shadow:0 0 12px #ff4d8d;';
      const m = new mapboxgl.Marker(el).setLngLat(e.location.coordinates).addTo(map.current!);
      markers.current.push(m);
    });
  }, [emergencies]);

  if (!mapboxgl.accessToken) {
    return (
      <div className="w-full h-full min-h-[70vh] rounded-2xl overflow-hidden grid place-items-center text-slate-400 text-sm">
        Set VITE_MAPBOX_TOKEN to render the map.
      </div>
    );
  }

  return <div ref={ref} className="w-full h-full min-h-[70vh] rounded-2xl overflow-hidden" />;
};

export default MapView;
