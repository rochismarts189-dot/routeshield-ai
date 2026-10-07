import React, { useState } from 'react';
import { ReportItem } from '../types';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { analysisFailureMessage } from '../lib/analysis';
import {
  Sparkles,
  AlertTriangle,
  RotateCcw,
  Ban,
  Clock,
  User,
  CheckCircle2,
  XCircle,
  HelpCircle,
} from 'lucide-react';

interface EvidenceCardProps {
  report: ReportItem;
  onRefresh?: () => void;
}

export const EvidenceCard: React.FC<EvidenceCardProps> = ({ report, onRefresh }) => {
  const { isModerator, user } = useAuth();
  const [imageError, setImageError] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [excluding, setExcluding] = useState(false);
  const [excludeReason, setExcludeReason] = useState('');
  const [showExcludeModal, setShowExcludeModal] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleRetry = async () => {
    setRetrying(true);
    setActionError(null);
    try {
      await api.retryAnalysis(report.id);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setActionError(err.message || 'Retry failed');
    } finally {
      setRetrying(false);
    }
  };

  const handleExclude = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!excludeReason.trim()) return;
    setExcluding(true);
    setActionError(null);
    try {
      await api.excludeReport(report.id, excludeReason.trim());
      setShowExcludeModal(false);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setActionError(err.message || 'Exclusion failed');
    } finally {
      setExcluding(false);
    }
  };

  const analysis = report.analysisJson;

  return (
    <div
      className={`border rounded-xl overflow-hidden bg-slate-900/90 shadow-lg transition-all ${
        report.excludedFromQuorum
          ? 'border-red-900/40 opacity-75'
          : 'border-slate-800 hover:border-slate-700'
      }`}
    >
      {/* Exclusion Warning Banner */}
      {report.excludedFromQuorum && (
        <div className="bg-red-950/80 border-b border-red-800/50 px-4 py-2 text-xs text-red-300 flex items-center justify-between">
          <span className="flex items-center gap-1.5 font-medium">
            <Ban className="w-4 h-4 text-red-400" aria-hidden="true" />
            <span>Excluded from quorum by moderator: &ldquo;{report.exclusionNote}&rdquo;</span>
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4">
        {/* Evidence Photo Column */}
        <div className="md:col-span-5 flex flex-col justify-between">
          <div className="relative aspect-[4/3] rounded-lg overflow-hidden bg-slate-950 border border-slate-800 group">
            {report.signedPhotoUrl && !imageError ? <img
              src={report.signedPhotoUrl}
              alt={`Evidence photo submitted by ${report.reporterName}: ${report.description || 'obstruction report'}`}
              className="w-full h-full object-contain transition-transform duration-300"
              loading="lazy"
              onError={() => setImageError(true)}
            /> : <p className="p-6 text-sm text-slate-300">Image link is unavailable or expired. Refresh the incident to request a new link.</p>}
            <div className="absolute top-2 left-2 bg-slate-950/80 backdrop-blur px-2.5 py-1 rounded text-xs font-semibold text-white border border-slate-700">
              Claim: {report.claim}
            </div>
          </div>

          <div className="mt-3 text-xs text-slate-400 space-y-1">
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
              <span>Reported by: <strong>{report.reporterName}</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
              <span>Observed: {new Date(report.observedAt).toLocaleString()}</span>
            </div>
            {report.description && (
              <p className="text-slate-300 italic pt-1">&ldquo;{report.description}&rdquo;</p>
            )}
          </div>
        </div>

        {/* Gemini Analysis Column */}
        <div className="md:col-span-7 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
              <span className="text-xs uppercase font-semibold text-emerald-400 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                <span>Gemini Multimodal Analysis</span>
              </span>

              {report.analysisStatus === 'COMPLETE' && (
                <span className="text-xs bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded border border-emerald-800/40">
                  Analysis Complete
                </span>
              )}
              {report.analysisStatus === 'PENDING' && (
                <span className="text-xs bg-amber-950 text-amber-300 px-2 py-0.5 rounded border border-amber-800/40 animate-pulse">
                  Analysis Pending
                </span>
              )}
              {report.analysisStatus === 'FAILED' && (
                <span className="text-xs bg-red-950 text-red-300 px-2 py-0.5 rounded border border-red-800/40">
                  Analysis Failed
                </span>
              )}
            </div>

            {report.analysisStatus === 'COMPLETE' && analysis ? (
              <div className="space-y-3 text-xs">
                {/* Metric Grid */}
                <div className="grid grid-cols-2 gap-2 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase block">Obstruction</span>
                    <span className="font-semibold text-white">
                      {analysis.obstruction_type.replace('_', ' ')}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase block">Extent</span>
                    <span className="font-semibold text-white">
                      {analysis.visible_extent.replace('_', ' ')}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase block">General Walk</span>
                    <span className="font-semibold text-slate-200">
                      {analysis.passability.general_walk}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase block">Step-Free</span>
                    <span className="font-semibold text-slate-200">
                      {analysis.passability.step_free}
                    </span>
                  </div>
                </div>

                {/* Observations */}
                <div>
                  <span className="font-semibold text-slate-300 block mb-1">Visual Observations:</span>
                  <ul className="space-y-1 list-disc list-inside text-slate-300 text-[11px]">
                    {analysis.observations.map((obs, i) => (
                      <li key={i}>{obs}</li>
                    ))}
                  </ul>
                </div>

                <p className="text-slate-300">Severity: {analysis.severity} · Evidence quality: {analysis.evidence_quality}</p>
                {analysis.uncertainty_reasons.length > 0 && <div><strong>Uncertainties</strong><ul className="list-disc pl-4">{analysis.uncertainty_reasons.map((reason, i) => <li key={i}>{reason}</li>)}</ul></div>}
                <p className="text-slate-400">Confidence is the model’s estimate, not proof of passability or image authenticity.</p>
                {/* Subjective Confidence */}
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                  <span>
                    Model: <code className="text-slate-300">{report.analysisModel || 'Not recorded'}</code>
                  </span>
                  <span>
                    AI Confidence Estimate: <strong>{Math.round(analysis.confidence * 100)}%</strong>
                  </span>
                </div>
              </div>
            ) : report.analysisStatus === 'FAILED' ? (
              <div className="bg-red-950/30 border border-red-800/40 p-3 rounded-lg text-xs space-y-2">
                <div className="flex items-center gap-1.5 text-red-300 font-semibold">
                  <XCircle className="w-4 h-4 text-red-400" aria-hidden="true" />
                  <span>Inference Failed ({report.analysisErrorCode || 'ERROR'})</span>
                </div>
                <p className="text-slate-400">
                  {analysisFailureMessage(report.analysisErrorCode)}
                </p>
                {report.analysisAttempts < 3 && (isModerator || user?.id === report.reporterId) && (
                  <button
                    onClick={handleRetry}
                    disabled={retrying}
                    className="mt-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs flex items-center gap-1.5 transition-colors"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${retrying ? 'animate-spin' : ''}`} aria-hidden="true" />
                    <span>{retrying ? 'Retrying...' : 'Retry AI Analysis'}</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center py-6 text-slate-400 text-xs">
                Processing multimodal visual inference...
              </div>
            )}
          </div>

          {/* Action Row */}
          <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between">
            {actionError && <span role="alert" className="text-xs text-red-400">{actionError}</span>}

            {isModerator && !report.excludedFromQuorum && (
              <button
                onClick={() => setShowExcludeModal(true)}
                className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 ml-auto"
              >
                <Ban className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Exclude from Quorum</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Exclusion Modal */}
      {showExcludeModal && (
        <div className="p-4 border-t border-slate-700">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
              <Ban className="w-4 h-4 text-red-400" aria-hidden="true" />
              <span>Exclude Evidence from Quorum</span>
            </h4>
            <p className="text-xs text-slate-300">
              Excluding this report removes it from automated community corroboration calculation.
            </p>
            <form onSubmit={handleExclude} className="space-y-3">
              <div>
                <label htmlFor={`exclude-${report.id}`} className="text-xs text-slate-400 block mb-1">Reason for exclusion</label>
                <textarea
                  id={`exclude-${report.id}`}
                  maxLength={1000}
                  autoFocus
                  required
                  rows={3}
                  value={excludeReason}
                  onChange={(e) => setExcludeReason(e.target.value)}
                  placeholder="e.g., Unclear segment context, duplicate perspective, or suspicious staging"
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowExcludeModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={excluding}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded text-xs font-semibold"
                >
                  {excluding ? 'Excluding...' : 'Confirm Exclusion'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
