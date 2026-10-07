import React, { useCallback, useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import type { Node, Edge, RoutePlan, RoutingProfile, IncidentSummary } from '../types';
import { api } from '../lib/api';
import { NetworkMap } from '../components/NetworkMap';
import { RouteItinerary } from '../components/RouteItinerary';
import { IncidentBadge } from '../components/IncidentBadge';
import { RouteImpactNotice } from '../components/RouteImpactNotice';
import { Navigation, Accessibility, Footprints, RotateCcw, Camera, ArrowUpRight, ArrowDownUp, MapPin, ShieldCheck, ScanEye, Layers, LoaderCircle, CloudOff } from 'lucide-react';

const message = (error: unknown) => error instanceof Error ? error.message : 'Please try again shortly.';

export const PlannerPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [incidents, setIncidents] = useState<IncidentSummary[]>([]);
  const [originId, setOriginId] = useState(searchParams.get('origin') || 'A');
  const [destinationId, setDestinationId] = useState(searchParams.get('destination') || 'D');
  const [profile, setProfile] = useState<RoutingProfile>(searchParams.get('profile') === 'GENERAL_WALK' ? 'GENERAL_WALK' : 'STEP_FREE');
  const [plan, setPlan] = useState<RoutePlan | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string>();
  const [networkLoading, setNetworkLoading] = useState(true);
  const [networkRevision, setNetworkRevision] = useState(0);
  const [loading, setLoading] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const networkRequest = useRef(0);
  const routeRequest = useRef(0);

  const loadNetworkData = useCallback(async () => {
    const requestId = ++networkRequest.current;
    ++routeRequest.current;
    setNetworkLoading(true); setNetworkError(null); setRouteError(null); setPlan(null); setLoading(false);
    try {
      const [network, data] = await Promise.all([api.getNetwork(), api.getIncidents({})]);
      if (requestId !== networkRequest.current) return;
      setNodes(network.nodes); setEdges(network.edges); setIncidents(data.incidents);
      setNetworkRevision(revision => revision + 1);
    } catch (error) {
      if (requestId !== networkRequest.current) return;
      setNodes([]); setEdges([]); setIncidents([]); setNetworkError(message(error));
    } finally { if (requestId === networkRequest.current) setNetworkLoading(false); }
  }, []);

  useEffect(() => {
    void loadNetworkData();
    return () => { ++networkRequest.current; ++routeRequest.current; };
  }, [loadNetworkData]);

  useEffect(() => {
    const requestId = ++routeRequest.current;
    setPlan(null); setRouteError(null); setLoading(false);
    if (networkLoading || !nodes.length) return;
    if (!nodes.some(n => n.id === originId) || !nodes.some(n => n.id === destinationId)) {
      setRouteError('Choose an origin and destination from Maple Ward.'); return;
    }
    if (originId === destinationId) { setRouteError('Origin and destination must be different points.'); return; }
    setLoading(true);
    void api.planRoute(originId, destinationId, profile).then(result => {
      if (requestId !== routeRequest.current) return;
      setPlan(result);
      setSearchParams({ origin: originId, destination: destinationId, profile }, { replace: true });
    }).catch(error => {
      if (requestId === routeRequest.current) setRouteError(message(error));
    }).finally(() => { if (requestId === routeRequest.current) setLoading(false); });
    return () => { ++routeRequest.current; };
  }, [originId, destinationId, profile, networkLoading, networkRevision, nodes, setSearchParams]);

  const activeIncidents = incidents.filter(i => i.status !== 'CLEARED' && !i.dismissedAt);
  const selectedEdge = edges.find(e => e.id === selectedEdgeId);
  const selectedIncident = activeIncidents.find(i => i.edgeId === selectedEdgeId);
  const available = nodes.length > 0 && !networkLoading;

  return (
    <div className="space-y-7">
      <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-5">
        <div className="max-w-2xl"><p className="eyebrow mb-3 flex items-center gap-2"><Navigation className="w-4 h-4" aria-hidden="true" />Community obstruction warnings</p><h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">Report once. <span className="text-emerald-300">Warn the next traveler.</span></h1><p className="text-slate-400 text-base mt-3 max-w-xl leading-relaxed">Someone encounters a barrier and shares a photo. Before you start your journey, RouteShield checks the reports and recommends an alternative when the route is affected.</p></div>
        <Link to="/report" className="primary-button shrink-0 self-start sm:self-auto"><Camera className="w-4 h-4" aria-hidden="true" />Report Obstruction<ArrowUpRight className="w-4 h-4" aria-hidden="true" /></Link>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-6 items-start">
        <section className="surface p-5 sm:p-6 space-y-5" aria-label="Journey preferences">
          <div className="flex items-center gap-2"><MapPin className="w-5 h-5 text-emerald-300" aria-hidden="true" /><h2 className="text-lg font-semibold">Check before you travel</h2></div>
          <div className="space-y-3">
            <div><label htmlFor="origin-select" className="block text-sm text-slate-300 font-medium mb-2">Origin Stop / Landmark</label><select id="origin-select" disabled={!available} value={nodes.length ? originId : ''} onChange={e => setOriginId(e.target.value)} className="field">{!nodes.length && <option value="">{networkLoading ? 'Loading locations…' : 'Locations unavailable'}</option>}{nodes.length > 0 && !nodes.some(n => n.id === originId) && <option value={originId}>Choose a location</option>}{nodes.map(n => <option key={n.id} value={n.id}>{n.id}: {n.name}</option>)}</select></div>
            <div className="flex justify-end"><button type="button" className="text-xs text-slate-300 flex items-center gap-1.5 rounded-lg px-2 py-1.5 hover:bg-slate-800 disabled:opacity-50" disabled={!available} onClick={() => { setOriginId(destinationId); setDestinationId(originId); }} aria-label="Swap origin and destination"><ArrowDownUp className="w-3.5 h-3.5" aria-hidden="true" />Swap</button></div>
            <div><label htmlFor="dest-select" className="block text-sm text-slate-300 font-medium mb-2">Destination Stop / Landmark</label><select id="dest-select" disabled={!available} value={nodes.length ? destinationId : ''} onChange={e => setDestinationId(e.target.value)} className="field">{!nodes.length && <option value="">{networkLoading ? 'Loading locations…' : 'Locations unavailable'}</option>}{nodes.length > 0 && !nodes.some(n => n.id === destinationId) && <option value={destinationId}>Choose a location</option>}{nodes.map(n => <option key={n.id} value={n.id}>{n.id}: {n.name}</option>)}</select></div>
          </div>
          <fieldset className="space-y-2.5"><legend className="text-sm font-medium text-slate-300 mb-2">Accessibility Profile</legend>
            {([{ value: 'STEP_FREE', label: 'Step-Free', detail: 'Avoid stairs and uncertain access', icon: Accessibility }, { value: 'GENERAL_WALK', label: 'General Walk', detail: 'Stairs may be included', icon: Footprints }] as const).map(({ value, label, detail, icon: Icon }) => <button key={value} type="button" onClick={() => setProfile(value)} aria-pressed={profile === value} className={`w-full text-left rounded-xl border p-3.5 flex gap-3 items-center transition-colors ${profile === value ? 'border-emerald-400/60 bg-emerald-400/10' : 'border-slate-700 hover:bg-slate-800'}`}><Icon className={`w-5 h-5 shrink-0 ${profile === value ? 'text-emerald-300' : 'text-slate-400'}`} aria-hidden="true" /><span className="flex-1"><span className="block text-sm font-semibold">{label}</span><span className="block text-xs text-slate-400 mt-1">{detail}</span></span><span className={`w-4 h-4 rounded-full border ${profile === value ? 'border-emerald-300 bg-emerald-300 shadow-[inset_0_0_0_3px_#12272b]' : 'border-slate-600'}`} aria-hidden="true" /></button>)}
          </fieldset>
          <button type="button" className="secondary-button w-full" disabled={loading || networkLoading} onClick={() => void loadNetworkData()}><RotateCcw className={`w-4 h-4 ${networkLoading ? 'animate-spin' : ''}`} aria-hidden="true" />Refresh incidents and route</button>
          <p className="text-xs leading-relaxed text-slate-400">Routes update automatically when you change your journey. Check community evidence before travelling.</p>
        </section>

        <div className="space-y-5 min-w-0">
          {plan && !networkLoading && <RouteImpactNotice plan={plan} incidents={incidents} nodes={nodes} edges={edges} />}
          <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-sm"><span className="w-2 h-2 rounded-full bg-emerald-300" aria-hidden="true" /><span className="font-medium">Maple Ward</span><span className="text-slate-500">/ Demo area</span></div><span className="text-xs text-slate-400">{available ? `${nodes.length} landmarks · ${activeIncidents.length} active incident${activeIncidents.length === 1 ? '' : 's'}` : networkLoading ? 'Connecting to route service…' : 'Route data unavailable'}</span></div>
          {networkLoading ? <div className="surface min-h-80 flex flex-col items-center justify-center gap-3 text-slate-400" role="status"><LoaderCircle className="w-7 h-7 text-emerald-300 animate-spin" aria-hidden="true" /><p>Loading the pedestrian network…</p><p className="text-xs">The demo server may take a moment to wake up.</p></div> : networkError ? <div className="surface min-h-80 p-8 sm:p-12 flex flex-col items-center justify-center text-center" role="alert"><span className="w-16 h-16 rounded-2xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center mb-5"><CloudOff className="w-7 h-7 text-amber-300" aria-hidden="true" /></span><h2 className="text-xl font-semibold">Route data isn’t available yet</h2><p className="text-slate-400 text-sm leading-relaxed max-w-md mt-3">We couldn’t load the network and current reports. Planning is paused until the route service is connected.</p><button type="button" onClick={() => void loadNetworkData()} className="secondary-button mt-6"><RotateCcw className="w-4 h-4" aria-hidden="true" />Retry</button><details className="mt-5 text-xs text-slate-400 max-w-md"><summary className="cursor-pointer">Connection details</summary><p className="mt-2 break-words">{networkError}</p></details></div> : <NetworkMap nodes={nodes} edges={edges} incidents={incidents} highlightEdgeIds={plan?.route?.edgeIds || []} highlightNodeIds={plan?.route?.nodeIds || []} baselineEdgeIds={plan?.baselineEdgeIds || []} routeLabel={plan?.route && plan.route.edgeIds.join() !== plan.baselineEdgeIds.join() ? 'Recommended alternative' : 'Normal route'} selectedEdgeId={selectedEdgeId} onSelectEdge={setSelectedEdgeId} onSelectNode={setDestinationId} />}
          {selectedEdge && available && <div className="surface p-4 flex flex-wrap justify-between items-center gap-3"><div><p className="font-semibold text-sm">{selectedEdge.name}</p><p className="text-xs text-slate-400 mt-1">{selectedEdge.length_m}m · {selectedEdge.has_steps ? 'Contains stairs' : selectedEdge.step_free_status === 'YES' ? 'Step-free segment' : 'Access unknown'}</p></div>{selectedIncident && <IncidentBadge status={selectedIncident.status} disputed={selectedIncident.disputed} />}<Link to={selectedIncident ? `/incidents/${selectedIncident.id}` : `/report?edgeId=${selectedEdge.id}`} className="text-sm text-emerald-300 flex gap-2 items-center">{selectedIncident ? 'Inspect evidence' : 'Report this segment'}<ArrowUpRight className="w-4 h-4" aria-hidden="true" /></Link></div>}
          <div aria-live="polite" aria-busy={loading}>{loading ? <div className="surface p-6 flex gap-3 items-center text-sm"><LoaderCircle className="w-5 h-5 animate-spin text-emerald-300" aria-hidden="true" />Checking your route against current incidents…</div> : routeError ? <div className="surface p-5 border-amber-400/30 text-amber-200 text-sm" role="alert">{routeError}</div> : plan ? <RouteItinerary plan={plan} /> : null}</div>
        </div>
      </div>
      <section className="grid sm:grid-cols-3 gap-5 border-t border-slate-800/80 pt-6" aria-label="How RouteShield works">{[{ icon: Camera, title: '01 / First traveler reports', body: 'Spot an obstruction. Share its photo and affected path segment.' }, { icon: ScanEye, title: '02 / Evidence becomes an incident', body: 'Gemini analyzes the photo. Existing verification policy determines route impact.' }, { icon: ShieldCheck, title: '03 / Next traveler is warned', body: 'See the affected segment and alternative before starting your journey.' }].map(({ icon: Icon, title, body }) => <div key={title} className="flex gap-3"><Icon className="w-5 h-5 text-emerald-300 mt-0.5 shrink-0" aria-hidden="true" /><div><h2 className="text-sm font-semibold">{title}</h2><p className="text-xs text-slate-400 leading-relaxed mt-1.5">{body}</p></div></div>)}</section>
    </div>
  );
};
