import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { Edge } from '../types';
import {
  Camera,
  Upload,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Clock,
  Shield,
  RotateCcw,
} from 'lucide-react';

export const ReportPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated } = useAuth();

  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string>(searchParams.get('edgeId') || 'BC');
  const [claim, setClaim] = useState<'BLOCKED' | 'CLEAR' | 'UNCERTAIN'>('BLOCKED');
  const [description, setDescription] = useState('');
  const [observedAt, setObservedAt] = useState<string>(
    new Date(Date.now() - 5 * 60 * 1000).toISOString().slice(0, 16)
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [failedAnalysisIncidentId, setFailedAnalysisIncidentId] = useState<string | null>(null);

  useEffect(() => {
    api
      .getNetwork()
      .then((data) => setEdges(data.edges))
      .catch((err) => console.error('Failed to load edges:', err));
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        setError('Selected photograph exceeds the 5MB limit.');
        return;
      }
      setSelectedFile(file);
      setError(null);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFailedAnalysisIncidentId(null);

    if (!isAuthenticated) {
      navigate(`/login?redirect=${encodeURIComponent('/report')}`);
      return;
    }

    if (!selectedFile) {
      setError('Please select or capture a photograph of the pedestrian segment.');
      return;
    }

    if (!selectedEdgeId) {
      setError('Please select a pedestrian segment.');
      return;
    }

    const formData = new FormData();
    formData.append('photo', selectedFile);
    formData.append('edgeId', selectedEdgeId);
    formData.append('claim', claim);
    formData.append('description', description.trim());
    formData.append('observedAt', new Date(observedAt).toISOString());

    setSubmitting(true);
    setUploadProgress('Uploading evidence & running Gemini visual analysis...');

    try {
      const result = await api.submitReport(formData);

      if (result.analysisStatus === 'FAILED') {
        // Report persisted as UNVERIFIED, but AI analysis failed
        setFailedAnalysisIncidentId(result.incidentId);
      } else {
        // Successfully analyzed and evaluated
        navigate(`/incidents/${result.incidentId}`);
      }
    } catch (err: any) {
      setError(err.message || 'Report submission failed. Please try again.');
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          <Camera className="w-6 h-6 text-emerald-400" aria-hidden="true" />
          <span>Submit Visual Community Evidence</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Photographs are analyzed by Gemini multimodal AI to detect obstructions and apparent passability.
        </p>
      </div>

      {!isAuthenticated && (
        <div className="bg-amber-950/40 border border-amber-600/40 p-4 rounded-xl text-amber-200 text-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Shield className="w-5 h-5 text-amber-400 shrink-0" aria-hidden="true" />
            <span>You must be logged in to submit community evidence.</span>
          </div>
          <Link
            to="/login?redirect=/report"
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded font-semibold text-xs transition-colors shrink-0"
          >
            Log In Now
          </Link>
        </div>
      )}

      {/* Analysis Failed Warning State */}
      {failedAnalysisIncidentId && (
        <div className="bg-amber-950/60 border border-amber-600 p-5 rounded-xl text-amber-200 space-y-3">
          <div className="flex items-center gap-2 text-white font-bold text-base">
            <AlertTriangle className="w-5 h-5 text-amber-400" aria-hidden="true" />
            <span>Report Saved — AI Analysis Pending/Failed</span>
          </div>
          <p className="text-xs text-amber-300">
            Your photograph has been safely persisted to private storage and attached to the incident
            as unverified evidence. However, Gemini multimodal visual inference was unable to finish.
          </p>
          <div className="pt-2">
            <Link
              to={`/incidents/${failedAnalysisIncidentId}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold"
            >
              <span>View Incident Details &amp; Retry Options</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      )}

      {/* Main Report Form */}
      <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-5">
        {error && (
          <div className="bg-red-950/60 border border-red-800 text-red-200 p-4 rounded-lg text-sm flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. Photo Upload & Preview */}
        <div>
          <label className="text-xs font-semibold text-slate-300 block mb-2">
            Visual Photograph Evidence (Max 5MB JPEG/PNG) *
          </label>

          <div className="border-2 border-dashed border-slate-700 hover:border-slate-500 rounded-xl p-4 text-center transition-colors bg-slate-950/50">
            {previewUrl ? (
              <div className="space-y-3">
                <div className="max-h-64 aspect-video mx-auto rounded-lg overflow-hidden bg-slate-950 border border-slate-800">
                  <img
                    src={previewUrl}
                    alt="Uploaded evidence preview"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="flex items-center justify-center gap-3">
                  <span className="text-xs text-slate-400 font-mono">{selectedFile?.name}</span>
                  <label className="text-xs text-emerald-400 hover:text-emerald-300 cursor-pointer underline">
                    Change Photo
                    <input
                      type="file"
                      accept="image/jpeg,image/png"
                      onChange={handleFileChange}
                      className="sr-only"
                    />
                  </label>
                </div>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center py-8 cursor-pointer">
                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
                  <Upload className="w-6 h-6" aria-hidden="true" />
                </div>
                <span className="text-sm font-semibold text-white">Click or drag photograph here</span>
                <span className="text-xs text-slate-400 mt-1">JPEG or PNG format up to 5MB</span>
                <input
                  type="file"
                  required
                  accept="image/jpeg,image/png"
                  onChange={handleFileChange}
                  className="sr-only"
                />
              </label>
            )}
          </div>
        </div>

        {/* 2. Pedestrian Segment Selection */}
        <div>
          <label htmlFor="segment-select" className="text-xs font-semibold text-slate-300 block mb-1.5">
            Pedestrian Segment Location *
          </label>
          <select
            id="segment-select"
            value={selectedEdgeId}
            onChange={(e) => setSelectedEdgeId(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {edges.map((e) => (
              <option key={e.id} value={e.id}>
                Segment {e.id}: {e.name} ({e.length_m}m{e.has_steps ? ', contains stairs' : ''})
              </option>
            ))}
          </select>
          <p className="text-[11px] text-slate-400 mt-1">
            Note: Coordinates are assigned to the segment midpoint (SEGMENT_SELECTION mode), not GPS verified.
          </p>
        </div>

        {/* 3. Reporter Claim & Description */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Reporter Claim *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['BLOCKED', 'CLEAR', 'UNCERTAIN'] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setClaim(c)}
                  className={`py-2 px-2 rounded-lg border text-xs font-semibold transition-colors ${
                    claim === c
                      ? c === 'BLOCKED'
                        ? 'bg-red-950 border-red-500 text-red-200'
                        : c === 'CLEAR'
                        ? 'bg-emerald-950 border-emerald-500 text-emerald-200'
                        : 'bg-purple-950 border-purple-500 text-purple-200'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                  aria-pressed={claim === c}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="time-select" className="text-xs font-semibold text-slate-300 block mb-1.5">
              Observation Time *
            </label>
            <input
              id="time-select"
              type="datetime-local"
              required
              value={observedAt}
              onChange={(e) => setObservedAt(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <span className="text-[11px] text-slate-400 block mt-1">Must be within the last 24 hours.</span>
          </div>
        </div>

        {/* Description */}
        <div>
          <label htmlFor="desc-input" className="text-xs font-semibold text-slate-300 block mb-1.5">
            Context / Description (Optional, max 500 chars)
          </label>
          <textarea
            id="desc-input"
            rows={3}
            maxLength={500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Scaffolding set up across entire sidewalk, no ramp provided..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <div className="flex justify-between text-[11px] text-slate-400 mt-1">
            <span>Description is treated as untrusted evidence by Gemini AI.</span>
            <span>{description.length} / 500</span>
          </div>
        </div>

        {/* Submit Progress or Button */}
        <div className="pt-2">
          {submitting ? (
            <div className="p-4 bg-emerald-950/40 border border-emerald-800 rounded-lg flex items-center justify-center gap-3 text-emerald-300 text-sm">
              <Sparkles className="w-5 h-5 animate-spin" aria-hidden="true" />
              <span>{uploadProgress || 'Processing upload...'}</span>
            </div>
          ) : (
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-lg shadow-emerald-900/30 transition-colors flex items-center justify-center gap-2"
            >
              <Camera className="w-5 h-5" aria-hidden="true" />
              <span>Submit Report &amp; Run Gemini Analysis</span>
            </button>
          )}
        </div>
      </form>
    </div>
  );
};
