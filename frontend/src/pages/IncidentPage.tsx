import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { IncidentDetail } from '../types';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { IncidentBadge } from '../components/IncidentBadge';
import { EvidenceCard } from '../components/EvidenceCard';
import { VerificationPanel } from '../components/VerificationPanel';
import {
  AlertTriangle,
  RotateCcw,
  Camera,
  ArrowLeft,
  Users,
  Clock,
  History,
  ShieldCheck,
  ShieldAlert,
  HelpCircle,
} from 'lucide-react';

export const IncidentPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { isModerator } = useAuth();
  const [searchParams] = useSearchParams();

  const [incident, setIncident] = useState<IncidentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIncident = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getIncident(id);
      setIncident(data.incident);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch incident details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncident();
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse max-w-5xl mx-auto">
        <div className="h-10 bg-slate-900 rounded-lg w-1/3" />
        <div className="h-48 bg-slate-900 rounded-xl" />
        <div className="h-64 bg-slate-900 rounded-xl" />
      </div>
    );
  }

  if (error || !incident) {
    return (
      <div className="max-w-2xl mx-auto bg-slate-900 border border-slate-800 rounded-xl p-8 text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-red-400 mx-auto" aria-hidden="true" />
        <h2 className="text-xl font-bold text-white">Unable to Load Incident</h2>
        <p className="text-sm text-slate-400">{error || 'This incident may have been removed or does not exist.'}</p>
        <div className="pt-2 flex justify-center gap-3">
          <Link
            to="/incidents"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold"
          >
            Back to Incidents List
          </Link>
          <button
            onClick={fetchIncident}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const submittedReport = incident.reports.find(r => r.id === searchParams.get('reportId'));

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Navigation Breadcrumb */}
      <div>
        <Link
          to="/incidents"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Back to All Incidents</span>
        </Link>
      </div>

      {submittedReport && <section className="surface border-emerald-400/30 p-5" role="status"><p className="eyebrow">Your report is now part of this incident</p><h2 className="text-lg font-semibold mt-2">{submittedReport.analysisStatus === 'COMPLETE' ? 'Photo analyzed by Gemini' : 'Photo saved; analysis not complete'}</h2><p className="text-sm text-slate-300 mt-2">See the actual image analysis below. The incident’s verification status controls whether travelers receive a warning or an alternative route.</p></section>}

      {/* Incident Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-emerald-400 font-bold">
                Segment {incident.edgeId}
              </span>
              <span className="text-xs text-slate-500">•</span>
              <span className="text-xs text-slate-400">ID: {incident.id.slice(0, 8)}...</span>
            </div>
            <h1 className="text-2xl font-black text-white">{incident.edgeName}</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <IncidentBadge
              status={incident.status}
              disputed={incident.disputed}
              requiresReview={incident.requiresReview}
              size="lg"
            />
          </div>
        </div>

        {/* Confirmation Basis Banner */}
        {incident.confirmationBasis && (
          <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 text-xs text-slate-300 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <span className="font-semibold text-white">Confirmation Basis: </span>
              <span>{incident.confirmationBasis}</span>
            </div>
          </div>
        )}

        {/* Contradictory Evidence Alert */}
        {incident.disputed && (
          <div className="bg-purple-950/40 border border-purple-800/60 p-4 rounded-lg text-xs text-purple-200 flex items-start gap-2.5">
            <HelpCircle className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <h4 className="font-bold text-white text-sm">Contradictory Community Evidence Reported</h4>
              <p className="mt-1 text-purple-300">
                Fresh block and clear reports have been submitted for this segment. A previously confirmed
                block remains active in routing calculations until a designated moderator conducts a full
                segment review.
              </p>
            </div>
          </div>
        )}

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950 p-3.5 rounded-lg border border-slate-800 text-xs">
          <div>
            <span className="text-[10px] text-slate-400 uppercase block">Total Reports</span>
            <span className="font-bold text-white text-sm">{incident.reports.length} photo(s)</span>
          </div>

          <div>
            <span className="text-[10px] text-slate-400 uppercase block">Distinct Accounts</span>
            <span className="font-bold text-white text-sm flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
              <span>{incident.distinctAccountsCount}</span>
            </span>
          </div>

          <div>
            <span className="text-[10px] text-slate-400 uppercase block">First Reported</span>
            <span className="font-semibold text-slate-300 text-xs">
              {new Date(incident.createdAt).toLocaleDateString()}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-slate-400 uppercase block">Last Evidence</span>
            <span className="font-semibold text-slate-300 text-xs">
              {new Date(incident.lastEvidenceAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>

        {/* Action Row */}
        <div className="pt-2 flex flex-wrap justify-end gap-3">
          <Link to="/plan" className="secondary-button">Check route warnings before travel</Link>
          <Link
            to={`/report?edgeId=${incident.edgeId}${incident.status !== 'CLEARED' && !incident.dismissedAt ? `&incidentId=${incident.id}` : ''}`}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow transition-colors"
          >
            <Camera className="w-4 h-4" aria-hidden="true" />
            <span>{incident.status === 'CLEARED' || incident.dismissedAt ? 'Report a New Obstruction' : 'Add Corroborating / Clear Evidence'}</span>
          </Link>
        </div>
      </div>

      {/* Moderator Verification Panel (shown to moderators) */}
      {isModerator && (
        <VerificationPanel incident={incident} onVerified={fetchIncident} />
      )}

      {/* Evidence Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Camera className="w-5 h-5 text-emerald-400" aria-hidden="true" />
            <span>Submitted Photographic Evidence ({incident.reports.length})</span>
          </h2>
        </div>

        <div className="space-y-4">
          {incident.reports.map((report) => (
            <EvidenceCard key={report.id} report={report} onRefresh={fetchIncident} />
          ))}
        </div>
      </div>

      {/* Audit Trail / Incident Events History */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <History className="w-5 h-5 text-slate-400" aria-hidden="true" />
          <span>Audit Trail &amp; Verification Events History</span>
        </h3>

        {incident.events.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No state transition events logged yet.</p>
        ) : (
          <ol className="divide-y divide-slate-800 border border-slate-800 rounded-lg overflow-hidden bg-slate-950 text-xs">
            {incident.events.map((event) => (
              <li key={event.id} className="p-3.5 flex items-start gap-3 hover:bg-slate-900/60">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 mt-1.5" />
                <div className="flex-1 space-y-1">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <span className="font-semibold text-white">
                      Action: <code className="text-emerald-300 font-mono">{event.reasonCode}</code>
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {new Date(event.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    Actor: <strong>{event.actorName}</strong> | Transition:{' '}
                    <span className="text-slate-300">{event.fromStatus || 'INIT'} → {event.toStatus}</span>
                  </p>
                  {event.metadata && Object.keys(event.metadata).length > 0 && (
                    <pre className="text-[10px] text-slate-400 bg-slate-900 p-2 rounded border border-slate-800 overflow-x-auto font-mono">
                      {JSON.stringify(event.metadata, null, 2)}
                    </pre>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
};
