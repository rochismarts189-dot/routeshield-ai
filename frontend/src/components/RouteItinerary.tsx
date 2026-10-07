import React from 'react';
import { RoutePlan } from '../types';
import { Navigation, AlertTriangle, ArrowRight, ShieldCheck, Check } from 'lucide-react';

interface RouteItineraryProps {
  plan: RoutePlan;
}

export const RouteItinerary: React.FC<RouteItineraryProps> = ({ plan }) => {
  if (plan.status === 'NO_ROUTE' || !plan.route) {
    return (
      <div
        className="bg-amber-950/40 border border-amber-600/40 rounded-xl p-6 text-amber-200 text-center"
        role="alert"
      >
        <div className="w-12 h-12 rounded-full bg-amber-900/60 border border-amber-500/50 flex items-center justify-center mx-auto mb-3">
          <AlertTriangle className="w-6 h-6 text-amber-400" aria-hidden="true" />
        </div>
        <h3 className="font-bold text-lg text-white mb-2">No Suitable Route Found</h3>
        <p className="text-sm max-w-lg mx-auto mb-4">{plan.explanation}</p>
        <div className="text-xs text-amber-300/80 bg-amber-900/30 p-3 rounded-lg border border-amber-800/50 max-w-md mx-auto text-left">
          <strong>Accessibility Notice:</strong> Step-Free excludes stairs, unknown access and
          obstructions covered by the existing avoidance policy. It does not certify physical safety.
        </div>
      </div>
    );
  }

  const { route, baselineDistanceMeters } = plan;
  const isDetour = route.edgeIds.join(',') !== plan.baselineEdgeIds.join(',');

  return (
    <div className="surface p-5 sm:p-6 space-y-5">
      {/* Route Header Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <span className="text-xs uppercase tracking-wider text-emerald-400 font-semibold">
            {isDetour ? 'Recommended alternative' : 'Normal route'} · {plan.profile === 'STEP_FREE' ? 'Step-Free' : 'General Walk'}
          </span>
          <h2 className="text-xl font-bold text-white flex items-center gap-2 mt-0.5">
            <span>{plan.originName}</span>
            <ArrowRight className="w-4 h-4 text-slate-500" aria-hidden="true" />
            <span>{plan.destinationName}</span>
          </h2>
        </div>

        <div className="flex items-center gap-4 bg-slate-950 px-4 py-2 rounded-lg border border-slate-800">
          <div>
            <span className="text-[10px] text-slate-400 uppercase block">Distance</span>
            <span className="text-lg font-bold text-emerald-400 font-mono">
              {route.distanceMeters}m
            </span>
          </div>

          {baselineDistanceMeters !== null && isDetour && (
            <div className="border-l border-slate-800 pl-4">
              <span className="text-[10px] text-amber-400 uppercase block">Detour Added</span>
              <span className="text-lg font-bold text-amber-400 font-mono">
                +{route.distanceDifferenceMeters}m
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Explanation Banner */}
      <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-lg text-sm text-slate-300 flex items-start gap-2.5">
        <Navigation className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <p className="font-medium text-white">{plan.explanation}</p>
          {baselineDistanceMeters && isDetour && (
            <p className="text-xs text-slate-400 mt-1">
              Direct baseline distance was {baselineDistanceMeters}m. The route has been automatically
              adjusted around obstructions or non-step-free barriers.
            </p>
          )}
        </div>
      </div>

      {/* Warnings List (if any) */}
      {plan.warnings.length > 0 && (
        <div className="space-y-2" role="region" aria-label="Route advisories and warnings">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
            <span>Route Advisories</span>
          </h4>
          <ul className="space-y-1.5">
            {plan.warnings.map((warn, i) => (
              <li
                key={i}
                className="text-xs text-amber-200 bg-amber-950/30 border border-amber-800/40 px-3 py-2 rounded-md flex items-start gap-2"
              >
                <span className="text-amber-400 font-bold">•</span>
                <span>{warn}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Step-by-step Text Itinerary */}
      <div>
        <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center justify-between">
          <span>Your text itinerary</span>
          <span className="text-xs text-slate-400 font-normal">
            {route.itinerary.length} segment{route.itinerary.length === 1 ? '' : 's'}
          </span>
        </h3>

        <ol className="divide-y divide-slate-800 border border-slate-800 rounded-lg overflow-hidden bg-slate-950">
          {route.itinerary.map((step) => (
            <li key={step.stepIndex} className="p-3.5 flex items-start gap-3 hover:bg-slate-900/60 transition-colors">
              <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 font-mono text-xs flex items-center justify-center shrink-0 mt-0.5 border border-slate-700">
                {step.stepIndex}
              </span>
              <div className="flex-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <p className="text-sm font-semibold text-white">
                    Walk along {step.edgeName} ({step.fromNodeId} → {step.toNodeId})
                  </p>
                  <span className="text-xs font-mono text-slate-400">
                    {step.distanceMeters}m (Cumulative: {step.cumulativeDistanceMeters}m)
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-slate-400">
                  <span className="inline-flex items-center gap-1 bg-slate-800/70 px-2 py-0.5 rounded text-[11px]">
                    <Check className="w-3 h-3 text-emerald-400" aria-hidden="true" />
                    <span>{step.stepFreeStatus === 'YES' ? 'Step-free' : step.stepFreeStatus === 'UNKNOWN' ? 'Access unknown' : 'Not step-free'}</span>
                  </span>

                  {step.hasSteps && (
                    <span className="inline-flex items-center gap-1 bg-amber-950 text-amber-300 px-2 py-0.5 rounded text-[11px] border border-amber-800/40">
                      Contains stairs
                    </span>
                  )}
                </div>

                {step.warnings.length > 0 && (
                  <div className="mt-2 text-xs text-amber-300 bg-amber-950/40 p-2 rounded border border-amber-800/30">
                    {step.warnings.join(' ')}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
};
