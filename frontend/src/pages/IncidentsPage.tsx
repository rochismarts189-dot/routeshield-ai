import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { IncidentSummary, Edge } from '../types';
import { api } from '../lib/api';
import { IncidentBadge } from '../components/IncidentBadge';
import {
  AlertTriangle,
  RotateCcw,
  Camera,
  Filter,
  ArrowRight,
  Clock,
  Users,
  Shield,
  Layers,
} from 'lucide-react';

export const IncidentsPage: React.FC = () => {
  const [incidents, setIncidents] = useState<IncidentSummary[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [edgeFilter, setEdgeFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIncidents = async () => {
    setLoading(true);
    setError(null);
    try {
      const [incData, netData] = await Promise.all([
        api.getIncidents({
          status: statusFilter || undefined,
          edgeId: edgeFilter || undefined,
        }),
        api.getNetwork(),
      ]);
      setIncidents(incData.incidents);
      setEdges(netData.edges);
    } catch (err: any) {
      setError(err.message || 'Failed to load community incidents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, [statusFilter, edgeFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-amber-400" aria-hidden="true" />
            <span>Community Obstruction Reports &amp; Incidents</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Browse active obstruction reports, corroboration status, and clearance records across the network.
          </p>
        </div>

        <Link
          to="/report"
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow transition-colors"
        >
          <Camera className="w-4 h-4" aria-hidden="true" />
          <span>Report New Evidence</span>
        </Link>
      </div>

      {/* Filters Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col sm:flex-row items-center gap-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 shrink-0">
          <Filter className="w-4 h-4 text-slate-400" aria-hidden="true" />
          <span>Filters:</span>
        </div>

        {/* Status filter */}
        <div className="w-full sm:w-auto flex-1">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            aria-label="Filter by verification status"
          >
            <option value="">All Verification Statuses</option>
            <option value="UNVERIFIED">Unverified Reports</option>
            <option value="CONFIRMED_BLOCKED">Confirmed Blocked</option>
            <option value="CLEARED">Cleared</option>
          </select>
        </div>

        {/* Segment filter */}
        <div className="w-full sm:w-auto flex-1">
          <select
            value={edgeFilter}
            onChange={(e) => setEdgeFilter(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            aria-label="Filter by segment"
          >
            <option value="">All Network Segments</option>
            {edges.map((e) => (
              <option key={e.id} value={e.id}>
                Segment {e.id}: {e.name}
              </option>
            ))}
          </select>
        </div>

        {(statusFilter || edgeFilter) && (
          <button
            onClick={() => {
              setStatusFilter('');
              setEdgeFilter('');
            }}
            className="text-xs text-slate-400 hover:text-white underline shrink-0"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div
          className="bg-red-950/60 border border-red-800 p-4 rounded-xl text-red-200 text-sm flex items-center justify-between gap-3"
          role="alert"
        >
          <span>{error}</span>
          <button
            onClick={fetchIncidents}
            className="px-3 py-1 bg-red-900/60 hover:bg-red-800 text-white rounded text-xs flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-3 animate-pulse">
          <div className="h-28 bg-slate-900 rounded-xl border border-slate-800" />
          <div className="h-28 bg-slate-900 rounded-xl border border-slate-800" />
          <div className="h-28 bg-slate-900 rounded-xl border border-slate-800" />
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && incidents.length === 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-400 space-y-3">
          <Shield className="w-12 h-12 text-slate-600 mx-auto" aria-hidden="true" />
          <h3 className="text-lg font-bold text-white">No Reports Matching Filters</h3>
          <p className="text-xs max-w-sm mx-auto">
            No reports match these filters. An absence of reports does not establish that a path is clear.
          </p>
        </div>
      )}

      {/* Incidents Cards List */}
      {!loading && incidents.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {incidents.map((inc) => (
            <Link
              key={inc.id}
              to={`/incidents/${inc.id}`}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 p-5 rounded-xl shadow-lg transition-all group block space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-xs font-mono text-emerald-400 font-semibold block">
                    Segment {inc.edgeId}
                  </span>
                  <h3 className="text-base font-bold text-white group-hover:text-emerald-300 transition-colors">
                    {inc.edgeName}
                  </h3>
                </div>

                <IncidentBadge
                  status={inc.status}
                  disputed={inc.disputed}
                  requiresReview={inc.requiresReview}
                  size="sm"
                />
              </div>

              {/* Metrics Row */}
              <div className="grid grid-cols-3 gap-2 bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Reports</span>
                  <span className="font-semibold text-white flex items-center gap-1">
                    <Layers className="w-3 h-3 text-slate-400" aria-hidden="true" />
                    <span>{inc.reportsCount} photo{inc.reportsCount === 1 ? '' : 's'}</span>
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Accounts</span>
                  <span className="font-semibold text-white flex items-center gap-1">
                    <Users className="w-3 h-3 text-slate-400" aria-hidden="true" />
                    <span>{inc.distinctAccountsCount}</span>
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Last Evidence</span>
                  <span className="font-semibold text-slate-300 truncate block">
                    {new Date(inc.lastEvidenceAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>

              {/* Footer info */}
              <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                  <span>Updated {new Date(inc.updatedAt).toLocaleDateString()}</span>
                </span>
                <span className="text-emerald-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-1 font-semibold">
                  <span>View Details</span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};
