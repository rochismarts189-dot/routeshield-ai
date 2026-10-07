import React, { useState } from 'react';
import { IncidentDetail } from '../types';
import { api } from '../lib/api';
import { ShieldCheck, CheckCircle2, XCircle, AlertTriangle, UserCheck } from 'lucide-react';

interface VerificationPanelProps {
  incident: IncidentDetail;
  onVerified: () => void;
}

export const VerificationPanel: React.FC<VerificationPanelProps> = ({
  incident,
  onVerified,
}) => {
  const [action, setAction] = useState<'CONFIRM_BLOCKED' | 'CLEAR' | 'DISMISS'>('CONFIRM_BLOCKED');
  const [blockGeneral, setBlockGeneral] = useState(true);
  const [blockStepFree, setBlockStepFree] = useState(true);
  const [attestation, setAttestation] = useState(false);
  const [evidenceReportId, setEvidenceReportId] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (action !== 'DISMISS' && !evidenceReportId) { setError('Select the evidence supporting this action.'); return; }
    if (!reason.trim()) {
      setError('A reason is required for any verification or moderation action');
      return;
    }

    if (action === 'CLEAR' && !attestation) {
      setError('Clearing requires explicit attestation that the whole segment was checked');
      return;
    }

    if (action === 'CONFIRM_BLOCKED' && !blockGeneral && !blockStepFree) {
      setError('At least one profile must be selected as blocked');
      return;
    }

    setSubmitting(true);
    try {
      const blockedProfiles: ('GENERAL_WALK' | 'STEP_FREE')[] = [];
      if (blockGeneral) blockedProfiles.push('GENERAL_WALK');
      if (blockStepFree) blockedProfiles.push('STEP_FREE');

      await api.verifyIncident(incident.id, {
        action,
        evidenceReportId: action === 'DISMISS' ? undefined : evidenceReportId,
        blockedProfiles: action === 'CONFIRM_BLOCKED' ? blockedProfiles : undefined,
        expectedVersion: incident.version,
        attestation: action === 'CLEAR' ? attestation : undefined,
        reason: reason.trim(),
      });

      onVerified();
    } catch (err: any) {
      setError(err.message || 'Verification update failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (incident.status === 'CLEARED' || incident.dismissedAt) return <p className="text-emerald-300">This incident is closed. New obstructions require a new report.</p>;

  return (
    <div className="bg-purple-950/20 border border-purple-900/50 rounded-xl p-5 shadow-xl space-y-4">
      <div className="flex items-center justify-between border-b border-purple-900/40 pb-3">
        <div className="flex items-center gap-2 text-purple-300">
          <UserCheck className="w-5 h-5 text-purple-400" aria-hidden="true" />
          <h3 className="font-bold text-white text-base">Moderator Verification Panel</h3>
        </div>
        <span className="text-xs bg-purple-900/60 text-purple-300 px-2 py-0.5 rounded font-mono border border-purple-700/50">
          Version {incident.version}
        </span>
      </div>

      {error && (
        <div role="alert" className="bg-red-950/60 border border-red-800 text-red-200 p-3 rounded-lg text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Action Selection */}
        <div>
          <label className="text-slate-300 font-semibold block mb-1.5">Action to Apply</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setAction('CONFIRM_BLOCKED')}
              className={`p-2.5 rounded-lg border text-left flex items-center gap-2 transition-colors ${
                action === 'CONFIRM_BLOCKED'
                  ? 'bg-red-950/80 border-red-500 text-red-200'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-red-400 shrink-0" aria-hidden="true" />
              <span className="font-semibold">Confirm Blocked</span>
            </button>

            <button
              type="button"
              onClick={() => setAction('CLEAR')}
              className={`p-2.5 rounded-lg border text-left flex items-center gap-2 transition-colors ${
                action === 'CLEAR'
                  ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
              <span className="font-semibold">Clear Segment</span>
            </button>

            <button
              type="button"
              onClick={() => setAction('DISMISS')}
              disabled={incident.status !== 'UNVERIFIED'}
              className={`p-2.5 rounded-lg border text-left flex items-center gap-2 transition-colors ${
                action === 'DISMISS'
                  ? 'bg-slate-800 border-slate-500 text-slate-200'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed'
              }`}
            >
              <XCircle className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
              <span className="font-semibold">Dismiss Report</span>
            </button>
          </div>
        </div>

        {action !== 'DISMISS' && <div>
          <label htmlFor="verification-evidence" className="block mb-2 text-slate-200">Evidence supporting this action</label>
          <select id="verification-evidence" required value={evidenceReportId} onChange={e => setEvidenceReportId(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white">
            <option value="">Select a fresh, analyzed report</option>
            {incident.reports.filter(r => !r.excludedFromQuorum && r.analysisStatus === 'COMPLETE' && (action === 'CLEAR' ? r.claim === 'CLEAR' : r.claim !== 'CLEAR')).map(r => <option key={r.id} value={r.id}>{r.reporterName} · {r.claim} · {new Date(r.observedAt).toLocaleTimeString()}</option>)}
          </select>
          <p className="mt-2 text-slate-400">The backend checks evidence freshness, apparent passability, and the selected profiles.</p>
        </div>}
        {/* Profile Controls for CONFIRM_BLOCKED */}
        {action === 'CONFIRM_BLOCKED' && (
          <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800 space-y-2">
            <span className="font-semibold text-slate-300 block">Profiles Affected by Block:</span>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={blockGeneral}
                  onChange={(e) => setBlockGeneral(e.target.checked)}
                  className="rounded border-slate-700 text-red-600 focus:ring-red-500"
                />
                <span>General Walking</span>
              </label>

              <label className="flex items-center gap-2 text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={blockStepFree}
                  onChange={(e) => setBlockStepFree(e.target.checked)}
                  className="rounded border-slate-700 text-red-600 focus:ring-red-500"
                />
                <span>Step-Free Access</span>
              </label>
            </div>
          </div>
        )}

        {/* Attestation Checkbox for CLEAR */}
        {action === 'CLEAR' && (
          <div className="bg-emerald-950/40 p-3 rounded-lg border border-emerald-800/60 space-y-2">
            <label className="flex items-start gap-2.5 text-emerald-200 cursor-pointer">
              <input
                type="checkbox"
                required
                checked={attestation}
                onChange={(e) => setAttestation(e.target.checked)}
                className="mt-0.5 rounded border-emerald-700 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-[11px] leading-relaxed">
                <strong>Mandatory Attestation:</strong> I attest that the whole selected pedestrian
                segment was checked and verified clear of obstructions, and not merely the single visible
                angle of a photograph.
              </span>
            </label>
          </div>
        )}

        {/* Reason text */}
        <div>
          <label htmlFor="moderation-reason" className="text-slate-300 font-semibold block mb-1">
            Moderation Reason &amp; Audit Note
          </label>
          <textarea
            id="moderation-reason"
            maxLength={1000}
            required
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Record reason, source of verification, or field check context..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        {/* Submit Button */}
        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg shadow-md transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <ShieldCheck className="w-4 h-4" aria-hidden="true" />
            <span>{submitting ? 'Applying Action...' : 'Submit Verification Action'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
