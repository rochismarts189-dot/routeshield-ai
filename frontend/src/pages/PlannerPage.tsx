import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Node, Edge, RoutePlan, RoutingProfile, IncidentSummary } from '../types';
import { api, ApiError } from '../lib/api';
import { NetworkMap } from '../components/NetworkMap';
import { RouteItinerary } from '../components/RouteItinerary';
import {
  Navigation,
  Accessibility,
  Footprints,
  AlertTriangle,
  RotateCcw,
  Camera,
  ArrowRight,
  Info,
} from 'lucide-react';

export const PlannerPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [incidents, setIncidents] = useState<IncidentSummary[]>([]);
  const [originId, setOriginId] = useState<string>(searchParams.get('origin') || 'A');
  const [destinationId, setDestinationId] = useState<string>(searchParams.get('destination') || 'D');
  const [profile, setProfile] = useState<RoutingProfile>(
    (searchParams.get('profile') as RoutingProfile) || 'STEP_FREE'
  );

  const [plan, setPlan] = useState<RoutePlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [networkLoading, setNetworkLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load network nodes, edges, and active incidents
  const loadNetworkData = async () => {
    setNetworkLoading(true);
    setError(null);
    try {
      const [networkData, incidentsData] = await Promise.all([
        api.getNetwork(),
        api.getIncidents({}),
      ]);
      setNodes(networkData.nodes);
      setEdges(networkData.edges);
      setIncidents(incidentsData.incidents);
    } catch (err: any) {
      setError(err.message || 'Failed to load network graph data.');
    } finally {
      setNetworkLoading(false);
    }
  };

  useEffect(() => {
    loadNetworkData();
  }, []);

  // Compute route when origin, destination, or profile changes
  const handleCalculateRoute = async () => {
    if (!originId || !destinationId) return;
    if (originId === destinationId) {
      setError('Origin and destination must be different points.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await api.planRoute(originId, destinationId, profile);
      setPlan(result);
      setSearchParams({ origin: originId, destination: destinationId, profile });
    } catch (err: any) {
      setError(err.message || 'Failed to compute route.');
      setPlan(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (nodes.length > 0 && originId && destinationId && originId !== destinationId) {
      handleCalculateRoute();
    }
  }, [originId, destinationId, profile, nodes.length]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <Navigation className="w-6 h-6 text-emerald-400" aria-hidden="true" />
            <span>Accessible Route Planner</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Explainable pedestrian route warnings and alternatives powered by community evidence.
          </p>
        </div>

        <Link
          to={`/report?edgeId=${plan?.route?.edgeIds[0] || 'BC'}`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-md transition-colors"
        >
          <Camera className="w-4 h-4" aria-hidden="true" />
          <span>Report Obstruction</span>
        </Link>
      </div>

      {/* Route Parameters Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Origin selector */}
          <div>
            <label htmlFor="origin-select" className="text-xs font-semibold text-slate-300 block mb-1.5">
              Origin Stop / Landmark
            </label>
            <select
              id="origin-select"
              value={originId}
              onChange={(e) => setOriginId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.id}: {n.name}
                </option>
              ))}
            </select>
          </div>

          {/* Destination selector */}
          <div>
            <label htmlFor="dest-select" className="text-xs font-semibold text-slate-300 block mb-1.5">
              Destination Stop / Landmark
            </label>
            <select
              id="dest-select"
              value={destinationId}
              onChange={(e) => setDestinationId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.id}: {n.name}
                </option>
              ))}
            </select>
          </div>

          {/* Profile selector */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Accessibility Profile
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setProfile('STEP_FREE')}
                className={`px-3 py-2 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                  profile === 'STEP_FREE'
                    ? 'bg-emerald-950 border-emerald-500 text-emerald-300 font-bold'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
                aria-pressed={profile === 'STEP_FREE'}
              >
                <Accessibility className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                <span>Step-Free</span>
              </button>

              <button
                type="button"
                onClick={() => setProfile('GENERAL_WALK')}
                className={`px-3 py-2 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                  profile === 'GENERAL_WALK'
                    ? 'bg-blue-950 border-blue-500 text-blue-300 font-bold'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
                aria-pressed={profile === 'GENERAL_WALK'}
              >
                <Footprints className="w-4 h-4 text-blue-400" aria-hidden="true" />
                <span>General Walk</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Service Error Alert with Retry */}
      {error && (
        <div
          className="bg-red-950/60 border border-red-800/80 p-4 rounded-xl text-red-200 text-sm flex items-center justify-between gap-3"
          role="alert"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => handleCalculateRoute()}
            className="px-3 py-1 bg-red-900/60 hover:bg-red-800 text-white rounded text-xs flex items-center gap-1 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {(networkLoading || loading) && (
        <div className="space-y-4 animate-pulse">
          <div className="h-64 bg-slate-900 rounded-xl border border-slate-800" />
          <div className="h-48 bg-slate-900 rounded-xl border border-slate-800" />
        </div>
      )}

      {/* Main Grid: Interactive Map + Route Itinerary */}
      {!networkLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Interactive Map Column */}
          <div className="lg:col-span-6 space-y-4">
            <NetworkMap
              nodes={nodes}
              edges={edges}
              incidents={incidents}
              highlightEdgeIds={plan?.route?.edgeIds || []}
              highlightNodeIds={plan?.route?.nodeIds || []}
              onSelectNode={(nodeId) => {
                if (!originId || originId === nodeId) {
                  setOriginId(nodeId);
                } else {
                  setDestinationId(nodeId);
                }
              }}
            />
          </div>

          {/* Turn-by-turn Itinerary & Advisories Column */}
          <div className="lg:col-span-6 space-y-4">
            {plan ? (
              <RouteItinerary plan={plan} />
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400">
                <Info className="w-8 h-8 text-slate-500 mx-auto mb-2" aria-hidden="true" />
                <p className="text-sm font-medium">Select an origin and destination to compute navigation.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
