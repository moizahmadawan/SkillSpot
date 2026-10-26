import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export type MapPoint = { id?: string; lat: number; lng: number; label?: string; active?: boolean };

// OpenStreetMap map that shows APPROXIMATE areas (circles), never exact addresses.
export default function MapView({ points, height = 260, radiusM = 1500, onSelect }: { points: MapPoint[]; height?: number; radiusM?: number; onSelect?: (id: string) => void }) {
  const box = useRef<HTMLDivElement>(null); const map = useRef<L.Map | null>(null); const layer = useRef<L.LayerGroup | null>(null); const pick = useRef(onSelect);
  pick.current = onSelect;
  useEffect(() => {
    if (!box.current) return;
    const m = L.map(box.current, { scrollWheelZoom: false }).setView([30.4, 69.3], 5);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(m);
    map.current = m; layer.current = L.layerGroup().addTo(m);
    const t = setTimeout(() => m.invalidateSize(), 50);
    return () => { clearTimeout(t); m.remove(); map.current = null; layer.current = null; };
  }, []);
  const key = JSON.stringify(points);
  useEffect(() => {
    const m = map.current, g = layer.current; if (!m || !g) return;
    g.clearLayers();
    const pts = points.filter((p) => isFinite(p.lat) && isFinite(p.lng));
    pts.forEach((p) => {
      const color = p.active ? '#F0A202' : '#0E5B47';
      const area = L.circle([p.lat, p.lng], { radius: radiusM, color, weight: 2, fillColor: color, fillOpacity: 0.2 }).addTo(g);
      const dot = L.circleMarker([p.lat, p.lng], { radius: p.active ? 8 : 6, color: '#fff', weight: 2, fillColor: color, fillOpacity: 1 }).addTo(g);
      if (p.label) dot.bindTooltip(p.label);
      if (p.id) [area, dot].forEach((l) => l.on('click', () => pick.current?.(p.id!)));
    });
    if (pts.length === 1) m.setView([pts[0].lat, pts[0].lng], 12);
    else if (pts.length > 1) m.fitBounds(L.latLngBounds(pts.map((p) => [p.lat, p.lng] as [number, number])), { padding: [30, 30], maxZoom: 12 });
  }, [key, radiusM]);
  return <div ref={box} role="img" aria-label="Map of approximate locations" className="w-full overflow-hidden rounded-xl border border-ink/10" style={{ height }} />;
}
