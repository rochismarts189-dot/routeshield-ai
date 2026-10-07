import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps } from '../lib/googleMaps';
import type { Coordinate, RealIncident, RealPlan } from '../types/navigation';

export function GoogleRouteMap({ plan, incidents, pin, onPin }: { plan: RealPlan | null; incidents: RealIncident[]; pin: Coordinate | null; onPin: (pin: Coordinate) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map>();
  const callback = useRef(onPin); callback.current = onPin;
  const [ready, setReady] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    const authFailure = () => setError('Google rejected the map credentials. Check the site/API restriction and billing. Maple Ward remains available.');
    window.addEventListener('routeshield:google-auth-failure', authFailure);
    let active = true; let listener: google.maps.MapsEventListener | undefined;
    loadGoogleMaps().then(() => {
      if (!active || !container.current) return;
      const map = new google.maps.Map(container.current, { center: { lat: 17.7231, lng: 83.3013 }, zoom: 14, streetViewControl: false, mapTypeControl: false, clickableIcons: false, gestureHandling: 'cooperative' });
      mapRef.current = map;
      listener = map.addListener('click', (event: google.maps.MapMouseEvent) => { if (event.latLng) callback.current(event.latLng.toJSON()); });
      setReady(true);
    }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; window.removeEventListener('routeshield:google-auth-failure', authFailure); listener?.remove(); mapRef.current = undefined; };
  }, []);
  useEffect(() => {
    const map = mapRef.current; if (!ready || !map) return;
    const overlays: Array<google.maps.Polyline | google.maps.Marker> = [];
    if (plan?.baseline) overlays.push(new google.maps.Polyline({ map, path: plan.baseline.coordinates, strokeColor: plan.baseline.avoided ? '#dc2626' : '#64748b', strokeOpacity: .85, strokeWeight: 5 }));
    if (plan?.recommended) overlays.push(new google.maps.Polyline({ map, path: plan.recommended.coordinates, strokeColor: '#059669', strokeWeight: 5 }));
    incidents.forEach(i => overlays.push(new google.maps.Marker({ map, position: i, title: `${i.label}: ${i.status}`, label: { text: i.status === 'CONFIRMED_BLOCKED' ? '!' : '?', color: '#fff' } })));
    if (pin) overlays.push(new google.maps.Marker({ map, position: pin, title: 'Selected report location', label: 'P' }));
    if (plan?.baseline) { const bounds = new google.maps.LatLngBounds(); [...plan.baseline.coordinates, ...(plan.recommended?.coordinates ?? [])].forEach(p => bounds.extend(p)); map.fitBounds(bounds, 40); }
    return () => overlays.forEach(overlay => overlay.setMap(null));
  }, [ready, plan, incidents, pin]);
  return <section className="surface overflow-hidden"><div className="p-4 border-b border-slate-800"><h2 className="font-semibold">Real walking route · Google Maps</h2><p className="text-xs text-slate-400 mt-1">Green: recommended · Red: avoided · ! confirmed obstruction · ? unverified report · P report pin. Click to select a report location, or enter coordinates below.</p></div><div ref={container} className="h-[420px] bg-slate-900" aria-label="Google walking route map" />{error ? <p role="alert" className="p-4 text-amber-200">{error}</p> : !ready && <p role="status" className="p-4 text-slate-300">Loading Google map…</p>}</section>;
}
